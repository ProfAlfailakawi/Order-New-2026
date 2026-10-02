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

// Display only: calm brand-compatible tints (green, gold, clay, sage, olive), picked
// by a stable hash of the category name so each category keeps its own colour.
const TINTS: Array<[string, string]> = [
  ['#2f6b4f', '#e3efe7'],
  ['#9a7432', '#f5eedf'],
  ['#a0624a', '#f6e7e0'],
  ['#4d7a86', '#e4eef0'],
  ['#6f7a35', '#eef0dc'],
];

export function categoryTint(category?: string | null): React.CSSProperties | undefined {
  const c = String(category || '').trim();
  if (!c) return undefined;
  let h = 0;
  for (let i = 0; i < c.length; i++) h = (h * 31 + c.charCodeAt(i)) >>> 0;
  const [fg, bgl] = TINTS[h % TINTS.length];
  return { ['--t-fg' as string]: fg, ['--t-bgl' as string]: bgl } as React.CSSProperties;
}

export function categoryVisual(category?: string | null): { Icon: LucideIcon; tone: DnaTone } {
  const c = String(category || '');
  const hit = MAP.find(([name]) => c.includes(name));
  return hit ? { Icon: hit[1], tone: hit[2] } : { Icon: CookingPot, tone: 'neutral' };
}

export function CategoryTile({ category, size = 'md', className }: { category?: string | null; size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'; className?: string }) {
  const { Icon, tone } = categoryVisual(category);
  return <DnaIconTile icon={<Icon />} tone={tone} size={size} className={className} style={categoryTint(category)} />;
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
