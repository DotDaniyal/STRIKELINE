import { useEffect, useState } from 'react';
import { Check, Coins, ShoppingBag } from 'lucide-react';
import type { CosmeticCategory, ShopItem, UserProfile } from '../../../shared/types/game.ts';
import { COSMETIC_CATALOG } from '../../../shared/constants/catalog.ts';
import { api } from '../../services/api.ts';
import { audioEngine } from '../../game/audio/AudioEngine.ts';

interface Props {
  profile: UserProfile;
  onProfileUpdated: (next: UserProfile) => void;
}

export function ShopTab({ profile, onProfileUpdated }: Props) {
  const [items, setItems] = useState<ShopItem[]>(COSMETIC_CATALOG.filter((i) => i.price > 0));
  const [filter, setFilter] = useState<'all' | CosmeticCategory>('all');
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    api.getShop()
      .then((res) => setItems(res.items))
      .catch(() => {});
  }, []);

  const filtered = items.filter((i) => (filter === 'all' ? true : i.category === filter));

  const handleBuy = async (item: ShopItem) => {
    audioEngine.playUiClick(760);
    setBuyingId(item.id);
    setFeedback(null);
    try {
      const res = await api.purchaseItem(item.id);
      onProfileUpdated(res.profile);
      setFeedback(`Unlocked ${item.name}. Equip it in Arsenal!`);
    } catch (err: unknown) {
      setFeedback(err instanceof Error ? err.message : 'Purchase failed.');
    } finally {
      setBuyingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="bg-[#0e131c]/95 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-white flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-amber-400" /> Tactical Armory Store
          </h2>
          <p className="text-xs text-slate-400">
            All shop items are strictly cosmetic. Zero pay-to-win stats.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              ['all', 'All Cosmetics'],
              ['weapon_skin', 'Weapon Finishes'],
              ['operator_skin', 'Operator Armor'],
              ['spray', 'Sprays'],
              ['bundle', 'Bundles'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer whitespace-nowrap shrink-0 ${
                filter === id
                  ? 'bg-amber-500 text-slate-950 border-amber-500'
                  : 'bg-[#090d14] text-slate-300 border-slate-700 hover:border-slate-500'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {feedback && (
        <div className="px-4 py-2.5 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-200 text-xs font-medium">
          {feedback}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((item) => {
          const owned = profile.inventory.includes(item.id);
          const canAfford = profile.credits >= item.price;
          const rarityBorder =
            item.rarity === 'apex'
              ? 'border-amber-500/70'
              : item.rarity === 'elite'
              ? 'border-sky-500/60'
              : 'border-slate-800';

          return (
            <div
              key={item.id}
              className={`bg-[#0e131c]/95 border ${rarityBorder} rounded-xl overflow-hidden flex flex-col justify-between`}
            >
              <div>
                <div
                  className="h-24 p-4 flex items-end justify-between relative"
                  style={{
                    background: `linear-gradient(135deg, ${item.previewColor}, ${item.secondaryColor || '#0f172a'})`,
                  }}
                >
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-black/70 text-white">
                    {item.rarity} · {item.category.replace('_', ' ')}
                  </span>
                  {item.featured && (
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-bold">
                      Featured
                    </span>
                  )}
                </div>
                <div className="p-4 space-y-1.5">
                  <h3 className="font-display font-bold text-base text-white">{item.name}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">{item.description}</p>
                </div>
              </div>

              <div className="p-4 pt-0 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 font-mono text-sm font-bold text-amber-400 tabular-nums">
                  <Coins className="w-4 h-4" />
                  {item.price} CR
                </div>
                {owned ? (
                  <span className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-semibold">
                    <Check className="w-3.5 h-3.5" /> Owned
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={!canAfford || buyingId === item.id}
                    onClick={() => handleBuy(item)}
                    className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-display font-bold text-xs uppercase tracking-wider cursor-pointer transition whitespace-nowrap shrink-0"
                  >
                    {buyingId === item.id ? 'Unlocking...' : canAfford ? 'Acquire' : 'Need Credits'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
