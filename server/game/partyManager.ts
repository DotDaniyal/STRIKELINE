import crypto from 'crypto';
import type { PartyInvite, PartyState, ServerMessage } from '../../shared/types/game.ts';
import { getBlockedIds } from '../persistence/index.ts';

export interface PartyMemberSummary {
  userId: string;
  username: string;
  level: number;
  partyId: string | null;
}

interface InternalParty {
  id: string;
  leaderId: string;
  memberIds: string[];
}

export class PartyManager {
  private parties = new Map<string, InternalParty>();
  private invites = new Map<string, PartyInvite>();

  constructor(
    private getClient: (userId: string) => PartyMemberSummary | undefined,
    private sendToUser: (userId: string, msg: ServerMessage) => void
  ) {}

  public getPartyMemberIds(partyId: string | null): string[] | null {
    if (!partyId) return null;
    const party = this.parties.get(partyId);
    return party ? [...party.memberIds] : null;
  }

  public getPartyLeader(partyId: string | null): string | null {
    if (!partyId) return null;
    return this.parties.get(partyId)?.leaderId ?? null;
  }

  public createParty(client: PartyMemberSummary) {
    if (client.partyId) return;
    const id = 'pty_' + crypto.randomBytes(4).toString('hex');
    const party: InternalParty = { id, leaderId: client.userId, memberIds: [client.userId] };
    this.parties.set(id, party);
    client.partyId = id;
    this.broadcastParty(party);
  }

  public inviteToParty(client: PartyMemberSummary, targetUserId: string) {
    if (!client.partyId) this.createParty(client);
    const party = client.partyId ? this.parties.get(client.partyId) : null;
    if (!party || party.leaderId !== client.userId) return;
    if (party.memberIds.length >= 4) {
      this.sendToUser(client.userId, { type: 'error', message: 'Party is full (max 4).' });
      return;
    }
    const target = this.getClient(targetUserId);
    if (!target) {
      this.sendToUser(client.userId, { type: 'error', message: 'Player is currently offline.' });
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
    this.sendToUser(target.userId, { type: 'party_invite_received', invite });
  }

  public respondPartyInvite(client: PartyMemberSummary, inviteId: string, accept: boolean) {
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

  public leaveParty(client: PartyMemberSummary) {
    if (!client.partyId) return;
    const party = this.parties.get(client.partyId);
    client.partyId = null;
    this.sendToUser(client.userId, { type: 'party_update', party: null });
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

  public kickFromParty(client: PartyMemberSummary, targetUserId: string) {
    const party = client.partyId ? this.parties.get(client.partyId) : null;
    if (!party || party.leaderId !== client.userId || targetUserId === client.userId) return;
    const target = this.getClient(targetUserId);
    if (target) this.leaveParty(target);
  }

  public transferPartyLeader(client: PartyMemberSummary, targetUserId: string) {
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
        const c = this.getClient(id);
        return {
          id,
          username: c?.username ?? 'Operative',
          level: c?.level ?? 1,
          ready: true,
        };
      }),
    };
    for (const mid of party.memberIds) {
      this.sendToUser(mid, { type: 'party_update', party: state });
    }
  }
}
