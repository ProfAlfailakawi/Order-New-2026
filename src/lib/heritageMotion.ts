// Heritage Motion Physics
// نظام حركة موحد وهادئ: spring طبيعي، بدون حركات عشوائية أو تلوث بصري.

export const heritageSpring = {
  page: { type: 'spring', stiffness: 170, damping: 26, mass: 0.8 },
  modalCenter: { type: 'spring', stiffness: 230, damping: 24, mass: 0.78 },
  modalBottom: { type: 'spring', stiffness: 260, damping: 28, mass: 0.82 },
  soft: { type: 'spring', stiffness: 190, damping: 22, mass: 0.72 },
  tap: { type: 'spring', stiffness: 420, damping: 28, mass: 0.55 },
} as const;

export const heritageMotion = {
  page: {
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 10 },
    transition: heritageSpring.page,
  },
  adminModal: {
    initial: { opacity: 0, scale: 0.96, y: 10 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.97, y: 8 },
    transition: heritageSpring.modalCenter,
  },
  customerSheet: {
    initial: { opacity: 0, y: 34, scale: 0.98 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: 24, scale: 0.985 },
    transition: heritageSpring.modalBottom,
  },
  breathe: {
    animate: { opacity: [0.58, 1, 0.58], scale: [0.985, 1.015, 0.985] },
    transition: { duration: 1.45, repeat: Infinity, ease: 'easeInOut' },
  },
  errorShake: {
    animate: { x: [0, -5, 5, -3, 3, 0] },
    transition: { duration: 0.34, ease: 'easeInOut' },
  },
  addToCartPlate: {
    whileTap: { scale: 0.965, rotate: -0.8 },
    transition: heritageSpring.tap,
  },
} as const;
