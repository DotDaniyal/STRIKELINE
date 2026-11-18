import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getTeamPalette, getRarityStyle } from '../../src/utils/theme.ts';

describe('theme utilities', () => {
  it('returns distinct colorblind palettes', () => {
    const standard = getTeamPalette('none');
    const deuter = getTeamPalette('deuteranopia');
    const protan = getTeamPalette('protanopia');
    const tritan = getTeamPalette('tritanopia');

    assert.equal(standard.alphaHex, '#38bdf8');
    assert.equal(standard.bravoHex, '#f43f5e');

    assert.equal(deuter.bravoHex, '#fb923c');
    assert.equal(protan.bravoHex, '#fb923c');
    assert.notEqual(deuter.alphaHex, deuter.bravoHex);

    assert.equal(tritan.alphaHex, '#2dd4bf');
    assert.equal(tritan.bravoHex, '#fb7185');
    assert.notEqual(tritan.alphaHex, tritan.bravoHex);
  });

  it('returns rarity styles for all cosmetic tiers', () => {
    assert.equal(getRarityStyle('apex').dotColor, '#f59e0b');
    assert.equal(getRarityStyle('elite').dotColor, '#38bdf8');
    assert.equal(getRarityStyle('tactical').dotColor, '#10b981');
    assert.equal(getRarityStyle('standard').dotColor, '#94a3b8');
  });
});
