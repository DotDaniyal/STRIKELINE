import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { WEAPON_LIST, WEAPONS } from '../shared/constants/weapons.ts';
import { GAME_MODES, PUBLIC_GAME_MODES } from '../shared/constants/modes.ts';
import { MAPS, MULTIPLAYER_MAPS } from '../shared/constants/maps.ts';
import { COSMETIC_CATALOG } from '../shared/constants/catalog.ts';
import { TRANSLATIONS } from '../shared/constants/i18n.ts';
import {
  getSurfaceHeightAt,
  raycastMapGeometry,
  raycastPlayerHitbox,
} from '../server/game/physics.ts';
import {
  createAntiCheatState,
  startServerReload,
  validateMovementStep,
  validateWeaponShot,
} from '../server/security/anticheat.ts';
import {
  createGuestAccount,
  initDatabase,
  loginAccount,
  purchaseShopItem,
  registerAccount,
  upgradeGuestAccount,
} from '../server/database/db.ts';

describe('STRIKELINE Shared Configuration Integrity', () => {
  it('defines 7 balanced weapons across primary and secondary slots', () => {
    assert.equal(WEAPON_LIST.length, 7);
    for (const w of WEAPON_LIST) {
      assert.ok(w.damageHead > w.damageBody);
      assert.ok(w.damageBody >= w.damageLimb);
      assert.ok(w.rpm > 0);
      assert.ok(w.magSize > 0);
    }
    assert.equal(WEAPONS.longshot_sr.adsFov < 35, true);
    assert.equal(WEAPONS.breacher_sg.pellets, 8);
  });

  it('defines 8 competitive multiplayer modes plus training range', () => {
    assert.equal(PUBLIC_GAME_MODES.length, 8);
    assert.ok(GAME_MODES.training);
    assert.equal(GAME_MODES['2v2'].roundBased, true);
  });

  it('defines 7 maps with valid spawns and colliders', () => {
    assert.equal(MULTIPLAYER_MAPS.length, 6);
    assert.ok(MAPS.training_range);
    for (const map of Object.values(MAPS)) {
      assert.ok(map.colliders.length >= 4);
      assert.ok(map.spawns.length >= 1);
    }
  });

  it('defines 5 localized UI languages and cosmetic-only catalog', () => {
    assert.deepEqual(Object.keys(TRANSLATIONS).sort(), ['de', 'en', 'es', 'fr', 'ja']);
    assert.ok(COSMETIC_CATALOG.length >= 10);
  });
});

describe('Authoritative Server Physics & Hitbox Validation', () => {
  it('detects head, body, and limb hitzones accurately', () => {
    const target = { x: 0, y: 0, z: -10 };
    const headHit = raycastPlayerHitbox({ x: 0, y: 1.56, z: 0 }, { x: 0, y: 0, z: -1 }, target, false, 100);
    assert.equal(headHit?.zone, 'head');

    const bodyHit = raycastPlayerHitbox({ x: 0, y: 1.05, z: 0 }, { x: 0, y: 0, z: -1 }, target, false, 100);
    assert.equal(bodyHit?.zone, 'body');

    const limbHit = raycastPlayerHitbox({ x: 0, y: 0.35, z: 0 }, { x: 0, y: 0, z: -1 }, target, false, 100);
    assert.equal(limbHit?.zone, 'limb');
  });

  it('occludes shots against map wall colliders before distant targets', () => {
    const foundry = MAPS.foundry;
    const wallHit = raycastMapGeometry(
      { x: 0, y: 1.5, z: 0 },
      { x: 0, y: 0, z: 1 },
      foundry,
      new Map(),
      150
    );
    assert.ok(wallHit !== null);
    assert.ok(wallHit.distance < 40);
  });

  it('computes inclined ramp surface heights cleanly', () => {
    const foundry = MAPS.foundry;
    const ramp = foundry.ramps[0];
    assert.ok(ramp);
    const yMid = getSurfaceHeightAt(foundry, ramp.x, ramp.z, 2.0);
    assert.ok(yMid > 0);
  });
});

describe('Server Anti-Cheat Validation', () => {
  it('clamps illegal teleportation speed spikes', () => {
    const ac = createAntiCheatState();
    ac.lastPos = { x: 0, y: 0, z: 0 };
    ac.lastMoveCheckAt = Date.now() - 40;
    const res = validateMovementStep(ac, 'test_user', { x: 25, y: 0, z: 0 }, MAPS.foundry, 1.0);
    assert.equal(res.valid, false);
    assert.ok(res.clampedPos.x < 6);
  });

  it('enforces weapon magazine depletion, fire rate cooldown, and reload lockout', () => {
    const ac = createAntiCheatState();
    const first = validateWeaponShot(ac, 'vanguard_ar', 'test_user');
    assert.equal(first.allowed, true);
    const immediateSpam = validateWeaponShot(ac, 'vanguard_ar', 'test_user');
    assert.equal(immediateSpam.allowed, false);

    startServerReload(ac, 'vanguard_ar');
    const whileReloading = validateWeaponShot(ac, 'vanguard_ar', 'test_user');
    assert.equal(whileReloading.allowed, false);
  });
});

describe('SQLite Database Auth, Guest Upgrade & Cosmetic Economy', () => {
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
