import * as React from 'react';
import { BadgePercent, Beef, CookingPot, Drumstick, Fish, Salad, UtensilsCrossed, type LucideIcon } from 'lucide-react';
import { DnaIconTile, type DnaTone } from './index';

const MAP: Array<[string, LucideIcon, DnaTone]> = [
  ['الولائم', UtensilsCrossed, 'amber'],
  ['اللحوم', Beef, 'coral'],
  ['الدجاج', Drumstick, 'amber'],
  ['البحري', Fish, 'sky'],
  ['المقبلات', Salad, 'mint'],
  ['وجبات التوفير', BadgePercent, 'lilac'],
];

export function categoryVisual(category?: string | null): { Icon: LucideIcon; tone: DnaTone } {
  const c = String(category || '');
  const hit = MAP.find(([name]) => c.includes(name));
  return hit ? { Icon: hit[1], tone: hit[2] } : { Icon: CookingPot, tone: 'neutral' };
}

export function CategoryTile({ category, size = 'md', className }: { category?: string | null; size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'; className?: string }) {
  const { Icon, tone } = categoryVisual(category);
  return <DnaIconTile icon={<Icon />} tone={tone} size={size} className={className} />;
}

/** Product image, or a category icon tile when the product has no image (or it fails to load). */
export function ProductVisual({
  product,
  imgClassName,
  tileClassName = 'dna-pv-fill',
  size = 'md',
}: {
  product: { imageUrl?: string; image?: string; name?: string; category?: string };
  imgClassName?: string;
  tileClassName?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}) {
  const src = product?.imageUrl || product?.image || '';
  const [broken, setBroken] = React.useState(false);
  React.useEffect(() => setBroken(false), [src]);
  if (!src || broken) return <CategoryTile category={product?.category} size={size} className={tileClassName} />;
  return <img referrerPolicy="no-referrer" src={src} alt={product?.name || ''} loading="lazy" decoding="async" onError={() => setBroken(true)} className={imgClassName} />;
}
