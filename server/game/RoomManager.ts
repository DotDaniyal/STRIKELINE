import crypto from 'crypto';
import type { WebSocket } from 'ws';
import type {
  ChatMessage,
  ClientMessage,
  GameModeId,
  MapId,
  MatchMutators,
  RegionId,
  ServerMessage,
  UserProfile,
  WeaponId,
} from '../../shared/types/game.ts';
import { MAPS, MULTIPLAYER_MAPS } from '../../shared/maps/index.ts';
import { GAME_MODES } from '../../shared/constants/modes.ts';
import { isValidClientMessage } from '../../shared/protocol/messages.ts';
import { getBlockedIds, getUserBySession } from '../persistence/index.ts';
import { MatchInstance } from './MatchInstance.ts';
import { PartyManager } from './partyManager.ts';

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

const BANNED_WORDS = ['cheater', 'slur_placeholder'];

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
  private roomByCode = new Map<string, string>();
  private partyManager: PartyManager;
  private startedAt = Date.now();

  constructor() {
    this.partyManager = new PartyManager(
      (uid) => this.clientsByUser.get(uid),
      (uid, msg) => {
        const client = this.clientsByUser.get(uid);
        if (client) this.send(client.ws, msg);
      }
    );
  }

  public handleConnection(ws: WebSocket) {
    ws.on('message', (raw) => {
      try {
        const parsed = JSON.parse(raw.toString()) as unknown;
        if (!isValidClientMessage(parsed)) {
          this.send(ws, { type: 'error', message: 'Invalid protocol payload.' });
          return;
        }
        this.handleMessage(ws, parsed);
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
        this.partyManager.createParty(client);
        break;
      case 'party_invite':
        this.partyManager.inviteToParty(client, msg.targetUserId);
        break;
      case 'party_respond_invite':
        this.partyManager.respondPartyInvite(client, msg.inviteId, msg.accept);
        break;
      case 'party_leave':
        this.partyManager.leaveParty(client);
        break;
      case 'party_kick':
        this.partyManager.kickFromParty(client, msg.targetUserId);
        break;
      case 'party_transfer_leader':
        this.partyManager.transferPartyLeader(client, msg.targetUserId);
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

    const partyMembers: ConnectedClient[] = [client];
    const memberIds = this.partyManager.getPartyMemberIds(client.partyId);
    if (memberIds) {
      if (this.partyManager.getPartyLeader(client.partyId) !== client.userId) {
        this.send(client.ws, { type: 'error', message: 'Only the party leader can start matchmaking.' });
        return;
      }
      for (const mid of memberIds) {
        if (mid !== client.userId) {
          const mClient = this.clientsByUser.get(mid);
          if (mClient) partyMembers.push(mClient);
        }
      }
    }

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
      const memberIds = this.partyManager.getPartyMemberIds(client.partyId);
      if (!memberIds) return;
      for (const mid of memberIds) {
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

  private handleDisconnect(ws: WebSocket) {
    const client = this.clientsByWs.get(ws);
    if (!client) return;
    this.leaveCurrentRoom(client);
    this.partyManager.leaveParty(client);
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
