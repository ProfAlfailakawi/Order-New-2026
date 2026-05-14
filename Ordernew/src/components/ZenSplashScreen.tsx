import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { DEFAULT_GLOBAL_LOGO } from "../constants";

const INSPIRING_QUOTES = [
  "النكهة هي ذاكرة لا تُنسى",
  "تذوق الفن في كل لقمة.. شغفنا هو رضاؤكم",
  "من قلب التراث الكويتي إلى مائدتكم",
  "نجتمع على حب الخير والطعم الأصيل",
  "كل طبق عندنا حكاية.. ترويها النكهات",
  "جودة تستحقها.. وطعم لا يقاوم",
  "للذوق أصول.. ونحن نحفظها لك"
];

interface ZenSplashScreenProps {
  logo?: string;
}

export const ZenSplashScreen: React.FC<ZenSplashScreenProps> = ({ logo }) => {
  const [quote, setQuote] = useState("");

  useEffect(() => {
    const randomQuote = INSPIRING_QUOTES[Math.floor(Math.random() * INSPIRING_QUOTES.length)];
    setQuote(randomQuote);
  }, []);

  return (
    <motion.div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 1, ease: "easeInOut" } }}
    >
      {/* Silky Background with Emerald & Indigo Waves */}
      <div className="absolute inset-0 bg-[#0a0a0a]">
        <motion.div
          className="absolute inset-0 opacity-40"
          animate={{
            background: [
              "radial-gradient(circle at 20% 30%, #064e3b 0%, transparent 50%)",
              "radial-gradient(circle at 80% 70%, #312e81 0%, transparent 50%)",
              "radial-gradient(circle at 20% 30%, #064e3b 0%, transparent 50%)",
            ],
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
        />
        <div className="absolute inset-0 backdrop-blur-[100px]" />
      </div>

      {/* Content Container */}
      <div className="relative z-10 flex flex-col items-center gap-12 px-6">
        {/* Pulsing Logo */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8, filter: "blur(10px)" }}
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          transition={{ duration: 1.5, ease: "easeOut" }}
        >
          <motion.div
            animate={{ 
              scale: [1, 1.03, 1],
              opacity: [0.9, 1, 0.9]
            }}
            transition={{ 
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="w-32 h-32 md:w-40 md:h-40 p-1 bg-white/5 backdrop-blur-md rounded-[2.5rem] border border-white/10 shadow-2xl overflow-hidden"
          >
            <img 
              referrerPolicy="no-referrer"
              src={logo || DEFAULT_GLOBAL_LOGO} 
              alt="Company Logo" 
              className="w-full h-full object-contain p-4"
              onError={(e) => { 
                e.currentTarget.src = DEFAULT_GLOBAL_LOGO;
              }}
            />
          </motion.div>
        </motion.div>

        {/* Changing Quote */}
        <div className="flex flex-col items-center gap-4 max-w-sm text-center">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 1 }}
            className="text-white/80 text-xl md:text-2xl font-black leading-relaxed tracking-wide"
            dir="rtl"
          >
            {quote}
          </motion.p>
          
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: "40px" }}
            transition={{ delay: 1.5, duration: 1 }}
            className="h-[2px] bg-emerald-500/50 rounded-full"
          />
        </div>
      </div>

      {/* Aesthetic Accents */}
      <motion.div 
        className="absolute bottom-12 text-white/20 text-[10px] font-black uppercase tracking-[0.4em]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2, duration: 0.5 }}
      >
        Kitchen Heritage • مطبخ التراث
      </motion.div>
    </motion.div>
  );
};
