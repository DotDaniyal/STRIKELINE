import crypto from 'crypto';
import type { WebSocket } from 'ws';
import type {
  ChatMessage,
  ClientMessage,
  GameModeId,
  MapId,
  MatchMutators,
  PartyInvite,
  PartyState,
  RegionId,
  ServerMessage,
  UserProfile,
  WeaponId,
} from '../../shared/types/game.ts';
import { MAPS, MULTIPLAYER_MAPS } from '../../shared/constants/maps.ts';
import { GAME_MODES } from '../../shared/constants/modes.ts';
import { getBlockedIds, getUserBySession } from '../database/db.ts';
import { MatchInstance } from './MatchInstance.ts';

interface ConnectedClient {
  ws: WebSocket;
  userId: string;
  username: string;
  level: number;
  clanTag?: string | null;
  roomId: string | null;
  partyId: string | null;
  queueKey: string | null;
  queueSince: number;
  lastChatAt: number;
  chatBurstCount: number;
  weaponId: WeaponId;
  weaponSkin: string;
  operatorSkin: string;
}

interface InternalParty {
  id: string;
  leaderId: string;
  memberIds: string[];
}

const BANNED_WORDS = ['cheater', 'slur_placeholder']; // Clean extensible profanity filter

function moderateChat(text: string): string {
  let clean = text.trim().slice(0, 220);
  for (const w of BANNED_WORDS) {
    clean = clean.replace(new RegExp(w, 'gi'), '***');
  }
  return clean;
}

export class RoomManager {
  private clientsByWs = new Map<WebSocket, ConnectedClient>();
  private clientsByUser = new Map<string, ConnectedClient>();
  private rooms = new Map<string, MatchInstance>();
  private roomByCode = new Map<string, string>(); // code -> roomId
  private parties = new Map<string, InternalParty>();
  private invites = new Map<string, PartyInvite>();
  private startedAt = Date.now();

  public handleConnection(ws: WebSocket) {
    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as ClientMessage;
        this.handleMessage(ws, msg);
      } catch {
        this.send(ws, { type: 'error', message: 'Malformed protocol payload.' });
      }
    });

    ws.on('close', () => {
      this.handleDisconnect(ws);
    });
  }

  private handleMessage(ws: WebSocket, msg: ClientMessage) {
    if (msg.type === 'ping') {
      this.send(ws, { type: 'pong', clientTime: msg.clientTime, serverTime: Date.now() });
      return;
    }

    if (msg.type === 'auth') {
      const profile = getUserBySession(msg.token);
      if (!profile) {
        this.send(ws, { type: 'auth_error', message: 'Invalid or expired session.' });
        return;
      }

      // Close previous connection if duplicate login
      const prev = this.clientsByUser.get(profile.id);
      if (prev && prev.ws !== ws) {
        this.handleDisconnect(prev.ws);
      }

      const loadout = profile.loadouts.find((l) => l.id === profile.activeLoadoutId) || profile.loadouts[0];
      const weaponId: WeaponId = loadout?.primaryWeapon ?? 'vanguard_ar';
      const weaponSkin = loadout?.weaponSkins?.[weaponId] ?? 'skin_standard_matte';

      const client: ConnectedClient = {
        ws,
        userId: profile.id,
        username: profile.username,
        level: profile.level,
        clanTag: profile.clanTag,
        roomId: null,
        partyId: null,
        queueKey: null,
        queueSince: 0,
        lastChatAt: 0,
        chatBurstCount: 0,
        weaponId,
        weaponSkin,
        operatorSkin: profile.equippedOperator,
      };
      this.clientsByWs.set(ws, client);
      this.clientsByUser.set(profile.id, client);
      this.send(ws, { type: 'auth_ok', userId: profile.id, username: profile.username });
      return;
    }

    const client = this.clientsByWs.get(ws);
    if (!client) {
      this.send(ws, { type: 'error', message: 'Authenticate before sending game commands.' });
      return;
    }

    switch (msg.type) {
      case 'queue_join':
        this.handleQueueJoin(client, msg.mode, msg.mapId, msg.region, msg.ranked);
        break;
      case 'queue_leave':
        this.leaveQueue(client);
        break;
      case 'create_private_room':
        this.handleCreatePrivateRoom(client, msg.mode, msg.mapId, msg.maxPlayers, msg.password, msg.mutators);
        break;
      case 'join_room':
        this.handleJoinRoom(client, msg.roomCode, msg.roomId, msg.password);
        break;
      case 'leave_room':
        this.leaveCurrentRoom(client);
        break;
      case 'update_room_settings': {
        const room = client.roomId ? this.rooms.get(client.roomId) : null;
        room?.updateSettings(client.userId, msg);
        break;
      }
      case 'kick_player': {
        const room = client.roomId ? this.rooms.get(client.roomId) : null;
        room?.kickPlayer(client.userId, msg.targetId);
        break;
      }
      case 'start_private_match': {
        const room = client.roomId ? this.rooms.get(client.roomId) : null;
        if (room && room.hostId === client.userId) {
          room.startMatch();
        }
        break;
      }
      case 'player_input': {
        const room = client.roomId ? this.rooms.get(client.roomId) : null;
        room?.handlePlayerInput(client.userId, msg);
        break;
      }
      case 'player_shoot': {
        const room = client.roomId ? this.rooms.get(client.roomId) : null;
        room?.handleShot(client.userId, msg);
        break;
      }
      case 'player_reload': {
        const room = client.roomId ? this.rooms.get(client.roomId) : null;
        room?.handleReload(client.userId, msg.weaponId);
        break;
      }
      case 'player_swap_weapon': {
        const room = client.roomId ? this.rooms.get(client.roomId) : null;
        room?.handleSwapWeapon(client.userId, msg.weaponId);
        break;
      }
      case 'player_spray': {
        const room = client.roomId ? this.rooms.get(client.roomId) : null;
        room?.handleSpray(client.userId, msg);
        break;
      }
      case 'vote_map': {
        const room = client.roomId ? this.rooms.get(client.roomId) : null;
        room?.handleVoteMap(client.userId, msg.mapId);
        break;
      }
      case 'chat_send':
        this.handleChat(client, msg.channel, msg.text);
        break;
      case 'party_create':
        this.createParty(client);
        break;
      case 'party_invite':
        this.inviteToParty(client, msg.targetUserId);
        break;
      case 'party_respond_invite':
        this.respondPartyInvite(client, msg.inviteId, msg.accept);
        break;
      case 'party_leave':
        this.leaveParty(client);
        break;
      case 'party_kick':
        this.kickFromParty(client, msg.targetUserId);
        break;
      case 'party_transfer_leader':
        this.transferPartyLeader(client, msg.targetUserId);
        break;
      case 'voice_signal': {
        const target = this.clientsByUser.get(msg.targetId);
        if (target) {
          this.send(target.ws, { type: 'voice_signal', fromId: client.userId, signal: msg.signal });
        }
        break;
      }
    }
  }

  public refreshClientLoadout(profile: UserProfile) {
    const client = this.clientsByUser.get(profile.id);
    if (!client) return;
    const loadout = profile.loadouts.find((l) => l.id === profile.activeLoadoutId) || profile.loadouts[0];
    const weaponId = loadout?.primaryWeapon ?? 'vanguard_ar';
    client.weaponId = weaponId;
    client.weaponSkin = loadout?.weaponSkins?.[weaponId] ?? 'skin_standard_matte';
    client.operatorSkin = profile.equippedOperator;
  }

  private handleQueueJoin(
    client: ConnectedClient,
    mode: GameModeId,
    preferredMap: MapId | undefined,
    region: RegionId,
    ranked?: boolean
  ) {
    if (!GAME_MODES[mode]) return;
    this.leaveCurrentRoom(client);

    // Collect party members if leader
    const partyMembers: ConnectedClient[] = [client];
    if (client.partyId) {
      const party = this.parties.get(client.partyId);
      if (party) {
        if (party.leaderId !== client.userId) {
          this.send(client.ws, { type: 'error', message: 'Only the party leader can start matchmaking.' });
          return;
        }
        for (const mid of party.memberIds) {
          if (mid !== client.userId) {
            const mClient = this.clientsByUser.get(mid);
            if (mClient) partyMembers.push(mClient);
          }
        }
      }
    }

    // Look for an open public room matching mode & region (and optionally map) with enough slots
    let targetRoom: MatchInstance | null = null;
    for (const room of this.rooms.values()) {
      if (
        !room.isPrivate &&
        room.mode === mode &&
        room.region === region &&
        room.ranked === Boolean(ranked) &&
        room.state !== 'ended' &&
        room.getHumanCount() + partyMembers.length <= room.maxPlayers &&
        (!preferredMap || room.mapId === preferredMap)
      ) {
        targetRoom = room;
        break;
      }
    }

    if (!targetRoom) {
      const mapId: MapId =
        preferredMap && MAPS[preferredMap]
          ? preferredMap
          : MULTIPLAYER_MAPS[Math.floor(Math.random() * MULTIPLAYER_MAPS.length)].id;
      const roomId = 'pub_' + crypto.randomBytes(4).toString('hex');
      targetRoom = new MatchInstance({
        roomId,
        isPrivate: false,
        ranked: Boolean(ranked),
        hostId: client.userId,
        mode,
        mapId,
        region,
        onEmpty: (rid) => this.cleanupRoom(rid),
      });
      this.rooms.set(roomId, targetRoom);
    }

    for (const member of partyMembers) {
      this.leaveCurrentRoom(member);
      member.roomId = targetRoom.roomId;
      member.queueKey = null;
      targetRoom.addHumanPlayer({
        id: member.userId,
        username: member.username,
        ws: member.ws,
        weaponId: member.weaponId,
        weaponSkin: member.weaponSkin,
        operatorSkin: member.operatorSkin,
        clanTag: member.clanTag,
      });
    }
  }

  private leaveQueue(client: ConnectedClient) {
    client.queueKey = null;
    this.send(client.ws, { type: 'queue_status', searching: false });
  }

  private handleCreatePrivateRoom(
    client: ConnectedClient,
    mode: GameModeId,
    mapId: MapId,
    maxPlayers: number,
    password: string | undefined,
    mutators: MatchMutators
  ) {
    this.leaveCurrentRoom(client);
    const roomId = 'prv_' + crypto.randomBytes(4).toString('hex');
    const roomCode = 'SL-' + crypto.randomBytes(2).toString('hex').toUpperCase();
    const room = new MatchInstance({
      roomId,
      roomCode,
      isPrivate: true,
      password: password?.trim() || undefined,
      hostId: client.userId,
      mode: GAME_MODES[mode] ? mode : 'tdm',
      mapId: MAPS[mapId] ? mapId : 'foundry',
      region: 'na-east',
      maxPlayers: Math.max(2, Math.min(12, maxPlayers || 8)),
      mutators,
      onEmpty: (rid) => this.cleanupRoom(rid),
    });
    this.rooms.set(roomId, room);
    this.roomByCode.set(roomCode, roomId);

    client.roomId = roomId;
    room.addHumanPlayer({
      id: client.userId,
      username: client.username,
      ws: client.ws,
      weaponId: client.weaponId,
      weaponSkin: client.weaponSkin,
      operatorSkin: client.operatorSkin,
      clanTag: client.clanTag,
    });
  }

  private handleJoinRoom(client: ConnectedClient, roomCode?: string, roomId?: string, password?: string) {
    let resolvedId = roomId;
    if (roomCode) {
      resolvedId = this.roomByCode.get(roomCode.trim().toUpperCase());
    }
    const room = resolvedId ? this.rooms.get(resolvedId) : undefined;
    if (!room) {
      this.send(client.ws, { type: 'error', message: 'Room code not found or match has closed.' });
      return;
    }
    if (room.password && room.password !== (password?.trim() || '')) {
      this.send(client.ws, { type: 'error', message: 'Incorrect room password.' });
      return;
    }
    this.leaveCurrentRoom(client);
    const added = room.addHumanPlayer({
      id: client.userId,
      username: client.username,
      ws: client.ws,
      weaponId: client.weaponId,
      weaponSkin: client.weaponSkin,
      operatorSkin: client.operatorSkin,
      clanTag: client.clanTag,
    });
    if (!added) {
      this.send(client.ws, { type: 'error', message: 'Match room is currently full.' });
      return;
    }
    client.roomId = room.roomId;
  }

  private leaveCurrentRoom(client: ConnectedClient) {
    if (!client.roomId) return;
    const room = this.rooms.get(client.roomId);
    if (room) {
      room.removePlayer(client.userId);
    }
    client.roomId = null;
    this.send(client.ws, { type: 'room_left' });
  }

  private cleanupRoom(roomId: string) {
    const room = this.rooms.get(roomId);
    if (room?.roomCode) {
      this.roomByCode.delete(room.roomCode);
    }
    this.rooms.delete(roomId);
  }

  private handleChat(client: ConnectedClient, channel: 'match' | 'team' | 'party', rawText: string) {
    const now = Date.now();
    if (now - client.lastChatAt < 900) {
      client.chatBurstCount += 1;
      if (client.chatBurstCount > 4) {
        this.send(client.ws, { type: 'error', message: 'Chat rate limit reached. Slow down.' });
        return;
      }
    } else {
      client.chatBurstCount = 0;
    }
    client.lastChatAt = now;

    const text = moderateChat(rawText);
    if (!text) return;

    const msg: ChatMessage = {
      id: 'msg_' + crypto.randomBytes(4).toString('hex'),
      channel,
      senderId: client.userId,
      senderName: client.username,
      text,
      timestamp: now,
    };

    if (channel === 'party') {
      if (!client.partyId) return;
      const party = this.parties.get(client.partyId);
      if (!party) return;
      for (const mid of party.memberIds) {
        const target = this.clientsByUser.get(mid);
        if (target) {
          const blocked = getBlockedIds(target.userId);
          if (!blocked.includes(client.userId)) {
            this.send(target.ws, { type: 'chat_message', message: msg });
          }
        }
      }
      return;
    }

    if (!client.roomId) return;
    const room = this.rooms.get(client.roomId);
    if (!room) return;
    const senderTeam = room.getPlayerTeam(client.userId);
    msg.senderTeam = senderTeam;
    room.broadcastChat(msg, senderTeam);
  }

  // Party System
  private createParty(client: ConnectedClient) {
    if (client.partyId) return;
    const id = 'pty_' + crypto.randomBytes(4).toString('hex');
    const party: InternalParty = { id, leaderId: client.userId, memberIds: [client.userId] };
    this.parties.set(id, party);
    client.partyId = id;
    this.broadcastParty(party);
  }

  private inviteToParty(client: ConnectedClient, targetUserId: string) {
    if (!client.partyId) this.createParty(client);
    const party = client.partyId ? this.parties.get(client.partyId) : null;
    if (!party || party.leaderId !== client.userId) return;
    if (party.memberIds.length >= 4) {
      this.send(client.ws, { type: 'error', message: 'Party is full (max 4).' });
      return;
    }
    const target = this.clientsByUser.get(targetUserId);
    if (!target) {
      this.send(client.ws, { type: 'error', message: 'Player is currently offline.' });
      return;
    }
    const blocked = getBlockedIds(target.userId);
    if (blocked.includes(client.userId)) return;

    const invite: PartyInvite = {
      id: 'inv_' + crypto.randomBytes(4).toString('hex'),
      partyId: party.id,
      fromUserId: client.userId,
      fromUsername: client.username,
      expiresAt: Date.now() + 60000,
    };
    this.invites.set(invite.id, invite);
    this.send(target.ws, { type: 'party_invite_received', invite });
  }

  private respondPartyInvite(client: ConnectedClient, inviteId: string, accept: boolean) {
    const invite = this.invites.get(inviteId);
    this.invites.delete(inviteId);
    if (!invite || !accept || invite.expiresAt < Date.now()) return;
    const party = this.parties.get(invite.partyId);
    if (!party || party.memberIds.length >= 4) return;

    this.leaveParty(client);
    party.memberIds.push(client.userId);
    client.partyId = party.id;
    this.broadcastParty(party);
  }

  private leaveParty(client: ConnectedClient) {
    if (!client.partyId) return;
    const party = this.parties.get(client.partyId);
    client.partyId = null;
    this.send(client.ws, { type: 'party_update', party: null });
    if (!party) return;

    party.memberIds = party.memberIds.filter((id) => id !== client.userId);
    if (party.memberIds.length === 0) {
      this.parties.delete(party.id);
      return;
    }
    if (party.leaderId === client.userId) {
      party.leaderId = party.memberIds[0];
    }
    this.broadcastParty(party);
  }

  private kickFromParty(client: ConnectedClient, targetUserId: string) {
    const party = client.partyId ? this.parties.get(client.partyId) : null;
    if (!party || party.leaderId !== client.userId || targetUserId === client.userId) return;
    const target = this.clientsByUser.get(targetUserId);
    if (target) this.leaveParty(target);
  }

  private transferPartyLeader(client: ConnectedClient, targetUserId: string) {
    const party = client.partyId ? this.parties.get(client.partyId) : null;
    if (!party || party.leaderId !== client.userId || !party.memberIds.includes(targetUserId)) return;
    party.leaderId = targetUserId;
    this.broadcastParty(party);
  }

  private broadcastParty(party: InternalParty) {
    const state: PartyState = {
      id: party.id,
      leaderId: party.leaderId,
      members: party.memberIds.map((id) => {
        const c = this.clientsByUser.get(id);
        return {
          id,
          username: c?.username ?? 'Operative',
          level: c?.level ?? 1,
          ready: true,
        };
      }),
    };
    for (const mid of party.memberIds) {
      const c = this.clientsByUser.get(mid);
      if (c) this.send(c.ws, { type: 'party_update', party: state });
    }
  }

  private handleDisconnect(ws: WebSocket) {
    const client = this.clientsByWs.get(ws);
    if (!client) return;
    this.leaveCurrentRoom(client);
    this.leaveParty(client);
    this.clientsByWs.delete(ws);
    if (this.clientsByUser.get(client.userId)?.ws === ws) {
      this.clientsByUser.delete(client.userId);
    }
  }

  public getPresence(userId: string): {
    online: boolean;
    status: 'online' | 'in_match' | 'in_queue' | 'offline';
    roomCode?: string;
  } {
    const c = this.clientsByUser.get(userId);
    if (!c) return { online: false, status: 'offline' };
    if (c.roomId) {
      const room = this.rooms.get(c.roomId);
      return { online: true, status: 'in_match', roomCode: room?.roomCode };
    }
    if (c.queueKey) return { online: true, status: 'in_queue' };
    return { online: true, status: 'online' };
  }

  public getPublicRooms() {
    return Array.from(this.rooms.values()).map((r) => r.getSummary());
  }

  public getMonitoringMetrics() {
    const mem = process.memoryUsage();
    return {
      uptimeSec: Math.floor((Date.now() - this.startedAt) / 1000),
      connectedPlayers: this.clientsByUser.size,
      activeRooms: this.rooms.size,
      memoryMb: Math.round(mem.rss / 1048576),
      rooms: this.getPublicRooms(),
    };
  }

  private send(ws: WebSocket, msg: ServerMessage) {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify(msg));
    }
  }
}
