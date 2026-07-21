import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";

export function DynamicEnvironment() {
  const [isRaining, setIsRaining] = useState(false);
  const [drops, setDrops] = useState<{ id: number; left: number; top: number; delay: number }[]>([]);

  useEffect(() => {
    const checkWeather = async () => {
      try {
        // Kuwait coords: lat 29.3759, lon 47.9774
        const res = await fetch("https://api.open-meteo.com/v1/forecast?latitude=29.3759&longitude=47.9774&current_weather=true");
        if (res.ok) {
          const data = await res.json();
          const code = data.current_weather?.weathercode || 0;
          let raining = [51,53,55,56,57,61,63,65,66,67,80,81,82,95,96,99].includes(code);
          
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
      {isRaining && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
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
