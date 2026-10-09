import React from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';

export function OfflineModal({ isOpen }: { isOpen: boolean }) {
  if (!isOpen) return null;

  return (
    <motion.div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="offline-title"
      dir="rtl"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-ink/60 backdrop-blur-sm p-4"
    >
      <div className="bg-cream border border-cream-edge rounded-3xl p-8 max-w-xs w-full text-center shadow-2xl flex flex-col items-center">
        <div className="w-16 h-16 bg-white ring-1 ring-cream-edge rounded-full flex items-center justify-center mb-6">
          <WifiOff className="w-8 h-8 text-accent" aria-hidden="true" />
        </div>
        <h2 id="offline-title" className="text-2xl font-extrabold text-brand mb-2">لا يوجد اتصال بالإنترنت</h2>
        <p className="text-stone-600 font-medium mb-8">سنعيد الاتصال تلقائياً فور عودة الشبكة.</p>
        <button
          onClick={() => window.location.reload()}
          className="w-full bg-brand text-white font-bold min-h-12 py-3.5 rounded-xl flex items-center justify-center gap-2 hover:bg-brand/90 transition-colors"
        >
          <RefreshCw className="w-5 h-5" aria-hidden="true" />
          إعادة المحاولة
        </button>
      </div>
    </motion.div>
  );
}
