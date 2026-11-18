import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createGuestAccount,
  initDatabase,
  loginAccount,
  purchaseShopItem,
  registerAccount,
  upgradeGuestAccount,
} from '../../server/persistence/index.ts';
import { MatchInstance } from '../../server/game/MatchInstance.ts';
import { RoomManager } from '../../server/game/RoomManager.ts';

describe('SQLite Persistence, Auth, Guest Upgrade & Shop Integration', () => {
  it('registers, logs in, upgrades guests, and deducts credits safely on purchase', async () => {
    await initDatabase();
    const uniqueSuffix = Date.now().toString(36).slice(-5);
    const uname = `Op_${uniqueSuffix}`;
    const email = `op_${uniqueSuffix}@strikeline.gg`;

    const reg = registerAccount(uname, email, 'SecretPass99!');
    assert.equal(reg.profile.username, uname);
    assert.ok(reg.token.length >= 32);

    const logged = loginAccount(uname, 'SecretPass99!');
    assert.equal(logged.profile.id, reg.profile.id);

    const guest = createGuestAccount('Rookie');
    assert.equal(guest.profile.isGuest, true);
    const upgraded = upgradeGuestAccount(
      guest.profile.id,
      `Pro_${uniqueSuffix}`,
      `pro_${uniqueSuffix}@strikeline.gg`,
      'Pass1234!'
    );
    assert.equal(upgraded.isGuest, false);
    assert.equal(upgraded.credits, 750);

    const updated = purchaseShopItem(upgraded.id, 'skin_amber_forge');
    assert.equal(updated.credits, 300);
    assert.ok(updated.inventory.includes('skin_amber_forge'));
  });
});

describe('Authoritative MatchInstance & RoomManager Lifecycle', () => {
  it('creates a private bot match, spawns bots, and disposes cleanly', () => {
    const match = new MatchInstance({
      roomId: 'test_room_' + Date.now(),
      hostId: 'host_test',
      mode: 'tdm',
      mapId: 'foundry',
      region: 'na-east',
      isPrivate: true,
      maxPlayers: 8,
      mutators: { botsCount: 4, botDifficulty: 'medium' },
    });
    match.startMatch();
    const summary = match.getSummary();
    assert.equal(summary.mode, 'tdm');
    assert.equal(summary.mapId, 'foundry');
    assert.equal(summary.playerCount, 4);
    assert.ok(summary.state === 'countdown' || summary.state === 'active');
    match.dispose();
  });

  it('lists public rooms cleanly', () => {
    const manager = new RoomManager();
    const rooms = manager.getPublicRooms();
    assert.ok(Array.isArray(rooms));
  });
});
