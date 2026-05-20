import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { DEFAULT_GLOBAL_LOGO } from "../constants";

const INSPIRING_QUOTES = [
  "حياكم… الطلب الطيب يبدأ من هني",
  "نكهة كويتية… وترتيب يليق بذوقكم",
  "من قلب المطبخ إلى باب بيتكم",
  "كل لقمة لها خاطر… وكل طلب له مقام",
  "جهزنا الجو… وباقي تختار اللي بخاطرك",
  "مطعمك حاضر… والذوق عندك",
  "دقايق ونفتح لك المنيو على أصوله"
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
      className="zen-splash fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 1, ease: "easeInOut" } }}
    >
      {/* Cinematic Background with Kuwaiti warm gold + deep green */}
      <div className="absolute inset-0 bg-[#070906]">
        <motion.div
          className="absolute inset-0 opacity-70"
          animate={{
            background: [
              "radial-gradient(circle at 18% 20%, rgba(194,97,21,0.55) 0%, transparent 34%), radial-gradient(circle at 82% 76%, rgba(6,78,59,0.58) 0%, transparent 42%)",
              "radial-gradient(circle at 78% 18%, rgba(212,175,55,0.42) 0%, transparent 38%), radial-gradient(circle at 22% 78%, rgba(15,23,42,0.66) 0%, transparent 46%)",
              "radial-gradient(circle at 18% 20%, rgba(194,97,21,0.55) 0%, transparent 34%), radial-gradient(circle at 82% 76%, rgba(6,78,59,0.58) 0%, transparent 42%)",
            ],
          }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
        />
        <div className="absolute inset-0 backdrop-blur-[90px]" />
        <div className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.7) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.7) 1px, transparent 1px)", backgroundSize: "42px 42px" }} />
      </div>

      {/* Content Container */}
      <div className="relative z-10 flex flex-col items-center gap-9 px-6">
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
            className="w-32 h-32 md:w-40 md:h-40 p-1.5 bg-white/10 backdrop-blur-md rounded-[2.75rem] border border-white/15 shadow-[0_30px_120px_rgba(212,175,55,0.22)] overflow-hidden relative"
          >
            <img 
              referrerPolicy="no-referrer"
              src={logo || DEFAULT_GLOBAL_LOGO} 
              alt="Company Logo" 
              className="w-full h-full object-contain p-4 bg-white/95 rounded-[2.35rem]"
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
            className="text-white text-xl md:text-2xl font-extrabold leading-relaxed tracking-wide drop-shadow-[0_10px_30px_rgba(0,0,0,0.45)]"
            dir="rtl"
          >
            {quote}
          </motion.p>
          
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: "40px" }}
            transition={{ delay: 1.5, duration: 1 }}
            className="h-[3px] bg-gradient-to-r from-transparent via-amber-400 to-transparent rounded-full"
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
        Kitchen Heritage • تجربة الطلب
      </motion.div>
    </motion.div>
  );
};
