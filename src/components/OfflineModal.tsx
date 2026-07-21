import React from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';

export function OfflineModal({ isOpen }: { isOpen: boolean }) {
  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
    >
      <div className="bg-white rounded-3xl p-8 max-w-xs w-full text-center shadow-2xl flex flex-col items-center">
        <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mb-6">
          <WifiOff className="w-8 h-8 text-stone-500" />
        </div>
        <h2 className="text-2xl font-black text-brand mb-2">لا يوجد اتصال بالإنترنت</h2>
        <p className="text-stone-500 font-medium mb-8">سنعيد الاتصال تلقائياً فور عودة الشبكة.</p>
        <button
          onClick={() => window.location.reload()}
          className="w-full bg-brand text-white font-black py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-brand/90 transition-colors"
        >
          <RefreshCw className="w-5 h-5" />
          إعادة المحاولة
        </button>
      </div>
    </motion.div>
  );
}
