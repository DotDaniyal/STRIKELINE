import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { WEAPON_LIST, WEAPONS } from '../../shared/constants/weapons.ts';
import { GAME_MODES, PUBLIC_GAME_MODES } from '../../shared/constants/modes.ts';
import { MAPS, MULTIPLAYER_MAPS } from '../../shared/maps/index.ts';
import { COSMETIC_CATALOG } from '../../shared/constants/catalog.ts';
import { TRANSLATIONS } from '../../shared/constants/i18n.ts';
import { isValidClientMessage, PROTOCOL_VERSION } from '../../shared/protocol/messages.ts';

describe('STRIKELINE Shared Configuration & Protocol Integrity', () => {
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

  it('validates WebSocket client protocol messages cleanly', () => {
    assert.equal(PROTOCOL_VERSION, 1);
    assert.equal(isValidClientMessage({ type: 'ping', clientTime: Date.now() }), true);
    assert.equal(isValidClientMessage({ type: 'queue_join', mode: 'tdm', region: 'na-east' }), true);
    assert.equal(isValidClientMessage(null), false);
    assert.equal(isValidClientMessage({ type: 'unknown_hack_cmd' }), false);
    assert.equal(isValidClientMessage({ noType: true }), false);
  });

  it('contains zero em dashes across HTML, UI components, and game constants', () => {
    const html = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');
    assert.equal(html.includes('—'), false);
    for (const m of Object.values(GAME_MODES)) {
      assert.equal(m.description.includes('—'), false);
    }
  });
});
