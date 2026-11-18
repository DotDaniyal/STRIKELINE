import { useEffect, useState } from 'react';
import { Check, Coins, ShoppingBag } from 'lucide-react';
import type { CosmeticCategory, ShopItem, UserProfile } from '../../../shared/types/game.ts';
import { COSMETIC_CATALOG } from '../../../shared/constants/catalog.ts';
import { api } from '../../services/api.ts';
import { getRarityStyle } from '../../utils/theme.ts';
import { TacticalPanel } from '../ui/TacticalPanel.tsx';
import { TacticalButton } from '../ui/TacticalButton.tsx';
import { SegmentedControl } from '../ui/SegmentedControl.tsx';

interface Props {
  profile: UserProfile;
  onProfileUpdated: (next: UserProfile) => void;
}

const SHOP_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'weapon_skin', label: 'Weapons' },
  { id: 'operator_skin', label: 'Operators' },
  { id: 'spray', label: 'Sprays' },
  { id: 'bundle', label: 'Bundles' },
] as const;

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
    setBuyingId(item.id);
    setFeedback(null);
    try {
      const res = await api.purchaseItem(item.id);
      onProfileUpdated(res.profile);
      setFeedback(`Unlocked ${item.name}. Equip it in Arsenal.`);
    } catch (err: unknown) {
      setFeedback(err instanceof Error ? err.message : 'Purchase failed.');
    } finally {
      setBuyingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <TacticalPanel accent="amber">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-bold uppercase text-white flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-amber-400" /> Tactical Armory Store
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              All items are strictly cosmetic. Zero pay-to-win stats.
            </p>
          </div>

          <SegmentedControl
            layoutId="shop-filter-tabs"
            options={SHOP_FILTERS}
            value={filter}
            onChange={setFilter}
            size="sm"
          />
        </div>
      </TacticalPanel>

      {feedback && (
        <div className="px-4 py-2.5 sl-chamfer-sm bg-amber-500/15 border border-amber-500/45 text-amber-200 text-xs font-medium">
          {feedback}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((item) => {
          const owned = profile.inventory.includes(item.id);
          const canAfford = profile.credits >= item.price;
          const rarity = getRarityStyle(item.rarity);

          return (
            <div
              key={item.id}
              className={`bg-[#0c1018]/94 border ${rarity.border} sl-chamfer overflow-hidden flex flex-col justify-between`}
            >
              <div>
                <div
                  className="h-24 p-3.5 flex items-end justify-between relative"
                  style={{
                    backgroundColor: item.previewColor,
                    borderBottom: `2px solid ${item.secondaryColor || '#1e293b'}`,
                  }}
                >
                  <div
                    className="absolute inset-0"
                    style={{
                      background:
                        'linear-gradient(to top, rgba(7,9,14,0.86) 0%, rgba(7,9,14,0.18) 100%)',
                    }}
                  />
                  <span className={`relative z-10 text-[10px] font-mono-tabular uppercase px-2 py-0.5 bg-black/80 ${rarity.badgeText}`}>
                    {item.rarity} · {item.category.replace('_', ' ')}
                  </span>
                  {item.featured && (
                    <span className="relative z-10 text-[10px] font-mono-tabular uppercase px-2 py-0.5 bg-amber-500 text-slate-950 font-bold">
                      Featured
                    </span>
                  )}
                </div>
                <div className="p-4 space-y-1.5">
                  <h3 className="font-display font-bold text-base uppercase text-white">{item.name}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">{item.description}</p>
                </div>
              </div>

              <div className="p-4 pt-0 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 font-mono-tabular text-sm font-bold text-amber-400">
                  <Coins className="w-4 h-4" />
                  {item.price} CR
                </div>
                {owned ? (
                  <span className="inline-flex items-center gap-1 px-3 py-1.5 sl-chamfer-sm bg-emerald-500/15 border border-emerald-500/45 text-emerald-300 text-xs font-semibold">
                    <Check className="w-3.5 h-3.5" /> Owned
                  </span>
                ) : (
                  <TacticalButton
                    variant={canAfford ? 'primary' : 'secondary'}
                    size="sm"
                    disabled={!canAfford || buyingId === item.id}
                    onClick={() => handleBuy(item)}
                  >
                    {buyingId === item.id ? 'Unlocking...' : canAfford ? 'Acquire' : 'Need Credits'}
                  </TacticalButton>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
