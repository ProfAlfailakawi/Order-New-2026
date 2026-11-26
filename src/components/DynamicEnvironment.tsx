import React, { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { getKuwaitWeather, isRainCode } from "../lib/kuwaitWeather";

export function DynamicEnvironment() {
  const prefersReducedMotion = useReducedMotion();
  const [isRaining, setIsRaining] = useState(false);
  const [drops, setDrops] = useState<{ id: number; left: number; top: number; delay: number }[]>([]);

  useEffect(() => {
    const checkWeather = async () => {
      try {
        // Shared single Open-Meteo read for Kuwait (also feeds the hero sky).
        const weather = await getKuwaitWeather();
        if (weather) {
          const code = weather.code || 0;
          let raining = isRainCode(code);
          
          // For demo purposes to always show the beauty of it if the user wants it, or we rely purely on weather
          // The prompt says "وإذا كان الجو برا مطر", so strictly real weather.
          setIsRaining(raining);
          
          if (raining) {
            const newDrops = Array.from({ length: 40 }).map((_, i) => ({
              id: i,
              left: Math.random() * 100,
              top: Math.random() * 100,
              delay: Math.random() * 3
            }));
            setDrops(newDrops);
          }
        }
      } catch (e) {
        // Fallback to no rain if the API is blocked or offline.
      }
    };
    checkWeather();
  }, []);

  return (
    <AnimatePresence>
      {isRaining && !prefersReducedMotion && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.45 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 2 }}
          className="fixed inset-0 pointer-events-none z-[50] overflow-hidden mix-blend-overlay"
        >
          {drops.map((drop) => (
            <motion.div
              key={drop.id}
              className="absolute w-1.5 h-2.5 rounded-full bg-blue-100/40 blur-[0.5px] shadow-[inset_0_-2px_4px_rgba(255,255,255,0.6)]"
              style={{ left: `${drop.left}vw`, top: `${drop.top}vh` }}
              initial={{ y: -20, opacity: 0, scale: 0.5 }}
              animate={{ 
                y: [0, 50, 100], 
                opacity: [0, 1, 0]
              }}
              transition={{
                duration: 2.5 + Math.random() * 2,
                delay: drop.delay,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
