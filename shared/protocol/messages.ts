import type { ClientMessage, ServerMessage } from '../types/game.ts';

export const PROTOCOL_VERSION = 1 as const;

export const CLIENT_MESSAGE_TYPES: ReadonlySet<ClientMessage['type']> = new Set([
  'auth',
  'ping',
  'queue_join',
  'queue_leave',
  'create_private_room',
  'join_room',
  'leave_room',
  'update_room_settings',
  'kick_player',
  'start_private_match',
  'player_input',
  'player_shoot',
  'player_reload',
  'player_swap_weapon',
  'player_spray',
  'vote_map',
  'chat_send',
  'party_create',
  'party_invite',
  'party_respond_invite',
  'party_leave',
  'party_kick',
  'party_transfer_leader',
  'voice_signal',
]);

export const SERVER_MESSAGE_TYPES: ReadonlySet<ServerMessage['type']> = new Set([
  'auth_ok',
  'auth_error',
  'pong',
  'error',
  'queue_status',
  'room_joined',
  'room_left',
  'match_state',
  'shot_fired',
  'hit_confirm',
  'damage_taken',
  'kill_feed',
  'player_died',
  'player_respawned',
  'spray_placed',
  'match_ended',
  'map_vote_update',
  'chat_message',
  'party_update',
  'party_invite_received',
  'notification',
  'voice_signal',
]);

function isFiniteVec3(v: unknown): boolean {
  if (!v || typeof v !== 'object') return false;
  const rec = v as Record<string, unknown>;
  return (
    typeof rec.x === 'number' &&
    Number.isFinite(rec.x) &&
    typeof rec.y === 'number' &&
    Number.isFinite(rec.y) &&
    typeof rec.z === 'number' &&
    Number.isFinite(rec.z)
  );
}

/**
 * Lightweight runtime validator for incoming WebSocket ClientMessage payloads.
 * Rejects malformed frames before they reach match/room state handlers.
 */
export function isValidClientMessage(raw: unknown): raw is ClientMessage {
  if (!raw || typeof raw !== 'object') return false;
  const msg = raw as Record<string, unknown>;
  if (typeof msg.type !== 'string') return false;
  if (!CLIENT_MESSAGE_TYPES.has(msg.type as ClientMessage['type'])) return false;

  switch (msg.type) {
    case 'auth':
      return typeof msg.token === 'string' && msg.token.length > 0;
    case 'ping':
      return typeof msg.clientTime === 'number' && Number.isFinite(msg.clientTime);
    case 'queue_join':
      return typeof msg.mode === 'string' && typeof msg.region === 'string';
    case 'create_private_room':
      return (
        typeof msg.mode === 'string' &&
        typeof msg.mapId === 'string' &&
        typeof msg.maxPlayers === 'number' &&
        Number.isFinite(msg.maxPlayers) &&
        Boolean(msg.mutators) &&
        typeof msg.mutators === 'object'
      );
    case 'player_input':
      return (
        typeof msg.seq === 'number' &&
        Number.isFinite(msg.seq) &&
        typeof msg.x === 'number' &&
        Number.isFinite(msg.x) &&
        typeof msg.y === 'number' &&
        Number.isFinite(msg.y) &&
        typeof msg.z === 'number' &&
        Number.isFinite(msg.z) &&
        typeof msg.yaw === 'number' &&
        Number.isFinite(msg.yaw) &&
        typeof msg.pitch === 'number' &&
        Number.isFinite(msg.pitch) &&
        typeof msg.weaponId === 'string'
      );
    case 'player_shoot':
      return (
        typeof msg.weaponId === 'string' &&
        isFiniteVec3(msg.origin) &&
        isFiniteVec3(msg.direction) &&
        typeof msg.clientTime === 'number' &&
        Number.isFinite(msg.clientTime)
      );
    case 'player_reload':
    case 'player_swap_weapon':
      return typeof msg.weaponId === 'string';
    case 'player_spray':
      return (
        typeof msg.x === 'number' &&
        typeof msg.y === 'number' &&
        typeof msg.z === 'number' &&
        typeof msg.sprayId === 'string'
      );
    case 'vote_map':
      return typeof msg.mapId === 'string';
    case 'chat_send':
      return (
        (msg.channel === 'match' || msg.channel === 'team' || msg.channel === 'party') &&
        typeof msg.text === 'string'
      );
    case 'kick_player':
    case 'voice_signal':
      return typeof msg.targetId === 'string';
    case 'party_invite':
    case 'party_kick':
    case 'party_transfer_leader':
      return typeof msg.targetUserId === 'string';
    case 'party_respond_invite':
      return typeof msg.inviteId === 'string' && typeof msg.accept === 'boolean';
    default:
      return true;
  }
}
