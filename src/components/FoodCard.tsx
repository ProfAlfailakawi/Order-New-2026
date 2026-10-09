import * as React from 'react';
import { ProductVisual } from './dna/ProductVisual';

/**
 * Shared, purely presentational food-photo frame: fixed aspect ratio, warm
 * vignette (see .food-photo in index.css), no hover-only effects. Used by menu
 * cards, "our picks", Smart Pick and the product modal hero so every dish looks
 * like it belongs to the same table.
 */
export function FoodPhoto({
  product,
  children,
  aspect = '1 / 1',
  className = '',
  imgClassName = 'w-full h-full object-cover',
}: {
  product?: { imageUrl?: string; image?: string; name?: string; category?: string };
  children?: React.ReactNode;
  aspect?: string;
  className?: string;
  imgClassName?: string;
}) {
  return (
    <div className={`food-photo relative overflow-hidden ${className}`} style={{ aspectRatio: aspect }}>
      {children ?? (product ? <ProductVisual product={product} imgClassName={imgClassName} /> : null)}
    </div>
  );
}

/** Price chip: 13px+ digits, brass currency, readable on any photo. */
export function PriceChip({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`food-price-chip inline-flex items-center gap-1 rounded-full bg-white/95 px-3 py-1 text-[13px] font-extrabold text-brand shadow-sm ring-1 ring-cream-edge ${className}`}>
      {children}
    </span>
  );
}
