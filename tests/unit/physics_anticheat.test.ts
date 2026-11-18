import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MAPS } from '../../shared/maps/index.ts';
import {
  getSurfaceHeightAt,
  raycastMapGeometry,
  raycastPlayerHitbox,
} from '../../shared/physics/ballistics.ts';
import {
  createAntiCheatState,
  startServerReload,
  validateMovementStep,
  validateWeaponShot,
} from '../../server/security/anticheat.ts';

describe('Authoritative Ballistics & Map Geometry', () => {
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
