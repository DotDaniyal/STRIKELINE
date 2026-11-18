import type { PlayerSettings, ShopItem } from '../../shared/types/game.ts';

export interface TeamPalette {
  alphaHex: string;
  alphaText: string;
  alphaBg: string;
  alphaBorder: string;
  bravoHex: string;
  bravoText: string;
  bravoBg: string;
  bravoBorder: string;
  neutralHex: string;
  headshotHex: string;
}

export function getTeamPalette(mode: PlayerSettings['colorblindMode'] = 'none'): TeamPalette {
  if (mode === 'deuteranopia' || mode === 'protanopia') {
    return {
      alphaHex: '#38bdf8',
      alphaText: 'text-sky-400',
      alphaBg: 'bg-sky-500/20',
      alphaBorder: 'border-sky-400',
      bravoHex: '#fb923c',
      bravoText: 'text-orange-400',
      bravoBg: 'bg-orange-500/20',
      bravoBorder: 'border-orange-400',
      neutralHex: '#facc15',
      headshotHex: '#facc15',
    };
  }
  if (mode === 'tritanopia') {
    return {
      alphaHex: '#2dd4bf',
      alphaText: 'text-teal-400',
      alphaBg: 'bg-teal-500/20',
      alphaBorder: 'border-teal-400',
      bravoHex: '#fb7185',
      bravoText: 'text-rose-400',
      bravoBg: 'bg-rose-500/20',
      bravoBorder: 'border-rose-400',
      neutralHex: '#f8fafc',
      headshotHex: '#fb7185',
    };
  }
  return {
    alphaHex: '#38bdf8',
    alphaText: 'text-sky-400',
    alphaBg: 'bg-sky-500/20',
    alphaBorder: 'border-sky-400',
    bravoHex: '#f43f5e',
    bravoText: 'text-rose-400',
    bravoBg: 'bg-rose-500/20',
    bravoBorder: 'border-rose-400',
    neutralHex: '#f59e0b',
    headshotHex: '#ef4444',
  };
}

export function getRarityStyle(rarity: ShopItem['rarity']) {
  switch (rarity) {
    case 'apex':
      return {
        border: 'border-amber-500/65',
        badgeText: 'text-amber-300',
        dotColor: '#f59e0b',
      };
    case 'elite':
      return {
        border: 'border-sky-500/55',
        badgeText: 'text-sky-300',
        dotColor: '#38bdf8',
      };
    case 'tactical':
      return {
        border: 'border-emerald-500/45',
        badgeText: 'text-emerald-300',
        dotColor: '#10b981',
      };
    default:
      return {
        border: 'border-slate-700/80',
        badgeText: 'text-slate-300',
        dotColor: '#94a3b8',
      };
  }
}
