/* Presentation only: whether the tracking stepper shows payment (and "paid") as done.
   An order that is being prepared or is on the way is past payment (the same screen's note already says
   "تم الدفع بنجاح"), unless the order is cancelled or failed. Status helpers are not touched. */
export interface TrackPayFlags {
  isPaid: boolean;
  isPreparing: boolean;
  isOnTheWay: boolean;
  isCancelled: boolean;
  isFailed: boolean;
}

export function trackPaymentDone(f: TrackPayFlags): boolean {
  if (f.isCancelled || f.isFailed) return f.isPaid;
  return f.isPaid || f.isPreparing || f.isOnTheWay;
}
