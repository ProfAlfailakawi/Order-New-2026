import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, Trophy, CreditCard, ShieldCheck, RefreshCw, AlertCircle, Info, Volume2, VolumeX } from "lucide-react";
import { cn } from "../utils";

// Synth sound system using Web Audio API
class DallahSynth {
  private ctx: AudioContext | null = null;
  public enabled: boolean = true;

  constructor() {
    // Lazy initialisation on first interaction
  }

  private initCtx() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  // Play coffee cup clinking & brass rattling sound
  public playClink(speedRatio: number = 1.0) {
    if (!this.enabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      
      // Brass resonant element
      const osc1 = this.ctx.createOscillator();
      const gain1 = this.ctx.createGain();
      osc1.type = "sine";
      // High frequency metal ring
      osc1.frequency.setValueAtTime(3200 + Math.random() * 400 * speedRatio, now);
      osc1.frequency.exponentialRampToValueAtTime(1200, now + 0.15);
      
      gain1.gain.setValueAtTime(0.3 * Math.min(1.0, speedRatio), now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      // Ceramic cup ring element
      const osc2 = this.ctx.createOscillator();
      const gain2 = this.ctx.createGain();
      osc2.type = "triangle";
      osc2.frequency.setValueAtTime(1500 + Math.random() * 200, now);
      osc2.frequency.exponentialRampToValueAtTime(800, now + 0.1);
      
      gain2.gain.setValueAtTime(0.15 * Math.min(1.0, speedRatio), now);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

      // Noise sizzle for rough textures
      const bufferSize = this.ctx.sampleRate * 0.02; // Very brief snap
      const bufferSource = this.ctx.createBufferSource();
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      bufferSource.buffer = buffer;
      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.08 * Math.min(1.0, speedRatio), now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);

      // Connect nodes
      osc1.connect(gain1);
      gain1.connect(this.ctx.destination);
      
      osc2.connect(gain2);
      gain2.connect(this.ctx.destination);

      bufferSource.connect(noiseGain);
      noiseGain.connect(this.ctx.destination);

      osc1.start(now);
      osc2.start(now);
      bufferSource.start(now);

      osc1.stop(now + 0.2);
      osc2.stop(now + 0.2);
    } catch (e) {
      console.warn("Audio Context blocked or failed:", e);
    }
  }

  // Play huge red structural earthquake bang & rumble
  public playEarthquake() {
    if (!this.enabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      
      // Low bass boom
      const boom = this.ctx.createOscillator();
      const boomGain = this.ctx.createGain();
      boom.type = "sine";
      boom.frequency.setValueAtTime(90, now);
      boom.frequency.exponentialRampToValueAtTime(25, now + 0.8);
      
      boomGain.gain.setValueAtTime(0.8, now);
      boomGain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

      // Rumbly noise buffer
      const bufferSize = this.ctx.sampleRate * 1.5; // 1.5 seconds rumble
      const bufferSource = this.ctx.createBufferSource();
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      bufferSource.buffer = buffer;
      
      // Bandpass filter for low shake sound
      const filter = this.ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(50, now);
      filter.frequency.exponentialRampToValueAtTime(15, now + 1.2);
      filter.Q.setValueAtTime(2.0, now);

      const rumbleGain = this.ctx.createGain();
      rumbleGain.gain.setValueAtTime(0.5, now);
      rumbleGain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);

      // Connect nodes
      boom.connect(boomGain);
      boomGain.connect(this.ctx.destination);

      bufferSource.connect(filter);
      filter.connect(rumbleGain);
      rumbleGain.connect(this.ctx.destination);

      boom.start(now);
      bufferSource.start(now);

      boom.stop(now + 1.0);
      bufferSource.stop(now + 1.6);
    } catch (e) {
      console.warn("Audio Context blocked or failed:", e);
    }
  }
}

const synth = new DallahSynth();

interface DallahPhysicalGameProps {
  order: any;
  participants: any[];
  loser: string | null;
  loserIndex: number;
  spun: boolean;
  isSpinning: boolean;
  setIsSpinning: (spinning: boolean) => void;
  spin: () => Promise<void>;
  paymentStatus?: string | null;
  urlName?: string | null;
  mySpinName: string;
  mySpinPhone: string;
  handlePay: (name: string, phone: string, amount: string) => void;
  errorMsg: string;
  getPhraseContent: (myName: string, isPaying: boolean, loserName: string) => { title: string; desc: string };
  normalizeArabicName: (name: string) => string;
}

export function DallahPhysicalGame({
  order,
  participants,
  loser,
  loserIndex,
  spun,
  isSpinning,
  setIsSpinning,
  spin,
  paymentStatus,
  urlName,
  mySpinName,
  mySpinPhone,
  handlePay,
  errorMsg,
  getPhraseContent,
  normalizeArabicName,
}: DallahPhysicalGameProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);

  // Sound enablement state
  const [audioEnabled, setAudioEnabled] = useState(true);

  // Dallah rotation state
  const [angle, setAngle] = useState(0);
  const angleRef = useRef(0);

  // Interactive custom drag/spin states
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);
  const dragStartAngleRef = useRef(0);
  const currentRotationOffsetRef = useRef(0);

  // Velocity measurements
  const dragHistoryRef = useRef<{ angle: number; time: number }[]>([]);
  const lastActiveIndexRef = useRef(-1);

  // Earthquake game impact trigger state
  const [earthquake, setEarthquake] = useState(false);
  const [hasTriggeredEarthquake, setHasTriggeredEarthquake] = useState(false);

  // Animation timeline control
  // "idle" | "spinning_free" | "decelerating" | "halted"
  const [gameState, setGameState] = useState<"idle" | "spinning_free" | "decelerating" | "halted">("idle");
  const gameStateRef = useRef<"idle" | "spinning_free" | "decelerating" | "halted">("idle");

  // Deceleration target parameters
  const decelerationStartAngleRef = useRef(0);
  const decelerationTargetAngleRef = useRef(0);
  const decelerationDurationRef = useRef(180); // frames
  const decelerationFrameRef = useRef(0);

  // Fallback spin trigger state so spin animation works even without user interaction
  const prevSpunRef = useRef(spun);

  useEffect(() => {
    synth.enabled = audioEnabled;
  }, [audioEnabled]);

  // Update backend spun status change triggers automated visual spin
  useEffect(() => {
    if (spun && !prevSpunRef.current && gameStateRef.current === "idle") {
      triggerAutomatedSpin(15); // Auto trigger with generous starter sweep speed
    }
    prevSpunRef.current = spun;
  }, [spun]);

  // Handle manual interaction on the spinner
  const getAngleFromCenter = (clientX: number, clientY: number) => {
    if (!containerRef.current) return 0;
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = clientX - centerX;
    const dy = clientY - centerY;
    // convert to degrees in range [-180, 180]
    return Math.atan2(dy, dx) * (180 / Math.PI);
  };

  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (gameStateRef.current !== "idle" && gameStateRef.current !== "halted") return;
    
    // Resume audio context
    synth.playClink(0.2);

    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    
    const clickAngle = getAngleFromCenter(clientX, clientY);
    dragStartAngleRef.current = clickAngle;
    currentRotationOffsetRef.current = angleRef.current;
    
    setIsDragging(true);
    isDraggingRef.current = true;
    dragHistoryRef.current = [{ angle: angleRef.current, time: Date.now() }];
    
    setEarthquake(false);
    setHasTriggeredEarthquake(false);
  };

  const handleDragMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDraggingRef.current) return;
    e.preventDefault();

    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

    const currentAngle = getAngleFromCenter(clientX, clientY);
    const deltaAngle = currentAngle - dragStartAngleRef.current;
    
    // Apply new continuous rotation
    const nextAngle = currentRotationOffsetRef.current + deltaAngle;
    angleRef.current = nextAngle;
    setAngle(nextAngle);

    // Track snapshot to compute momentum velocity upon let-go
    const now = Date.now();
    dragHistoryRef.current.push({ angle: nextAngle, time: now });
    if (dragHistoryRef.current.length > 5) {
      dragHistoryRef.current.shift();
    }

    // Gentle clink feedback when user drag changes segments
    const segmentAngle = 360 / Math.max(2, participants.length);
    const activeSeg = Math.floor(nextAngle / segmentAngle);
    if (activeSeg !== lastActiveIndexRef.current) {
      synth.playClink(0.4);
      lastActiveIndexRef.current = activeSeg;
    }
  };

  const handleDragEnd = () => {
    if (!isDraggingRef.current) return;
    setIsDragging(false);
    isDraggingRef.current = false;

    // Calculate final swipe angular velocity (degrees per millisecond)
    const history = dragHistoryRef.current;
    let computedVelocity = 0;
    if (history.length >= 2) {
      const first = history[0];
      const last = history[history.length - 1];
      const timeDiff = last.time - first.time;
      if (timeDiff > 10) {
        computedVelocity = (last.angle - first.angle) / timeDiff;
      }
    }

    const velocityInDegreesPerFrame = computedVelocity * 16.67; // approx 60fps frame duration
    const speedRatio = Math.abs(velocityInDegreesPerFrame);

    // If swiped hard enough, initiate physics spin. Otherwise reset
    if (speedRatio > 1.5) {
      triggerAutomatedSpin(velocityInDegreesPerFrame);
    } else {
      // Gentle snap or rest
    }
  };

  const triggerAutomatedSpin = (initialVelocity: number = 15) => {
    if (gameStateRef.current === "spinning_free" || gameStateRef.current === "decelerating") return;

    // Enforce speed limitation safeguards
    const sign = Math.sign(initialVelocity) || 1;
    let speed = Math.abs(initialVelocity);
    speed = Math.max(10, Math.min(24, speed)); // Ensure high adrenaline but safe bounds
    const startingVelocity = speed * sign;

    setIsSpinning(true);
    setEarthquake(false);
    setHasTriggeredEarthquake(false);
    setGameState("spinning_free");
    gameStateRef.current = "spinning_free";

    // Play initial heavy rotational rattle sound
    synth.playClink(1.3);

    // Trigger backend lottery selection if it hasn't spun yet
    if (!spun) {
      spin().catch((err) => {
        console.error("Backend spin activation fail:", err);
      });
    }

    startAnimationLoop(startingVelocity);
  };

  const startAnimationLoop = (initialVelocity: number) => {
    let currentVelocity = initialVelocity;
    let freeSpinFrames = 0;
    const maxFreeSpinFrames = 110; // ~ 1.8 seconds of beautiful high velocity spinning

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    const loop = () => {
      const segmentAngle = 360 / Math.max(1, participants.length);

      if (gameStateRef.current === "spinning_free") {
        // Continuous free rotation
        angleRef.current += currentVelocity;
        
        // Very slow deceleration so spin energy persists beautifully
        currentVelocity *= 0.992;
        freeSpinFrames++;

        // Sync local React representation
        setAngle(angleRef.current);

        // Sound sync based on angle segment crosses
        const activeSeg = Math.floor(angleRef.current / segmentAngle);
        if (activeSeg !== lastActiveIndexRef.current) {
          synth.playClink(Math.abs(currentVelocity) / 10);
          lastActiveIndexRef.current = activeSeg;
        }

        // Once the minimum free spin timeout elapsed, check if target (loserIndex) is populated securely
        if (freeSpinFrames >= maxFreeSpinFrames && hasValidTarget()) {
          // Transition to precise targeting deceleration
          prepareDeceleration();
        }

        animationRef.current = requestAnimationFrame(loop);
      } 
      else if (gameStateRef.current === "decelerating") {
        decelerationFrameRef.current++;
        const totalFrames = decelerationDurationRef.current;
        const currentFrame = decelerationFrameRef.current;

        if (currentFrame >= totalFrames) {
          // Finished! Force snap exactly onto targeted index angle
          angleRef.current = decelerationTargetAngleRef.current;
          setAngle(decelerationTargetAngleRef.current);
          handleStopImpact();
        } else {
          // Standard majestic Cubic Ease-Out interpolation
          const t = currentFrame / totalFrames;
          const curve = 1 - Math.pow(1 - t, 3); // cubic ease-out
          
          const nextAngle = decelerationStartAngleRef.current + 
            (decelerationTargetAngleRef.current - decelerationStartAngleRef.current) * curve;
          
          angleRef.current = nextAngle;
          setAngle(nextAngle);

          // As rotation slows down, the tempo of the sound matches the angular delta perfectly
          const currentStepVelocity = (decelerationTargetAngleRef.current - decelerationStartAngleRef.current) * 
            (3 * Math.pow(1 - t, 2)) / totalFrames; // derivative of cubic ease-out

          const activeSeg = Math.floor(nextAngle / segmentAngle);
          if (activeSeg !== lastActiveIndexRef.current) {
            synth.playClink(Math.max(0.12, Math.abs(currentStepVelocity) / 10));
            lastActiveIndexRef.current = activeSeg;
          }

          animationRef.current = requestAnimationFrame(loop);
        }
      }
    };

    animationRef.current = requestAnimationFrame(loop);
  };

  const hasValidTarget = () => {
    // Requires that order.rouletteLoser / loser index points to a validated participant
    return typeof loserIndex === "number" && loserIndex >= 0 && loserIndex < participants.length;
  };

  const prepareDeceleration = () => {
    const segmentAngle = 360 / Math.max(1, participants.length);
    
    // The spout should target exactly: Angle = (loserIndex * segmentAngle)
    const exactTargetRemainder = loserIndex * segmentAngle;

    // Current pointer angle mapped to continuous scale
    const currentAngle = angleRef.current;
    
    // Find next multiples of 360 matching exact target angle with spectacular dramatic rotations (e.g. 2 full extra spins)
    const baseRotations = Math.floor(currentAngle / 360) + 2;
    const finalTargetAngle = baseRotations * 360 + exactTargetRemainder;

    decelerationStartAngleRef.current = currentAngle;
    decelerationTargetAngleRef.current = finalTargetAngle;
    decelerationFrameRef.current = 0;
    // Lower spacing count means faster, more abrupt brake. 
    // High spacing count (150-180) means majestic, movie-like dramatic deceleration
    decelerationDurationRef.current = 140; 

    setGameState("decelerating");
    gameStateRef.current = "decelerating";
  };

  const handleStopImpact = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    setGameState("halted");
    gameStateRef.current = "halted";
    setIsSpinning(false);

    // Safeguard: trigger high-octane earthquake zinzal shockwave once!
    if (!hasTriggeredEarthquake) {
      setEarthquake(true);
      setHasTriggeredEarthquake(true);
      synth.playEarthquake();

      // Clear structural earthquake vibration after 2.5 seconds
      setTimeout(() => {
        setEarthquake(false);
      }, 2500);
    }
  };

  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  // Compute pointer segment angles
  const numParticipants = Math.max(1, participants.length);
  const segmentAngle = 360 / numParticipants;

  // Render variables
  const isLobbyEmpty = participants.length === 0;
  const currentDegrees = angle % 360;
  
  // Highlighting current highlighted index in motion
  const currentPointingIndex = Math.round(currentDegrees / segmentAngle) % numParticipants;
  const highlightIdx = currentPointingIndex >= 0 ? currentPointingIndex : (numParticipants + currentPointingIndex) % numParticipants;

  // Check if we show final results
  const isFinalHalted = gameState === "halted" && spun;

  // Style helper: Translate current physical angle to layout
  // Add 90 offset to account for SVG pointer facing UPwards natively
  const rotatedDegrees = angle - 90;

  return (
    <div className={cn(
      "relative w-full rounded-[38px] p-6 text-center overflow-hidden transition-all duration-700 bg-stone-950 border border-amber-500/10 shadow-2xl shadow-black",
      earthquake && "animate-[shake_0.15s_ease-in-out_infinite]"
    )}>
      {/* Background radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(214,173,75,0.06)_0%,transparent_70%)] pointer-events-none" />

      {/* Embedded CSS rules for the earthquake shaking keyframes & special glow animations */}
      <style>{`
        @keyframes shake {
          0% { transform: translate(1px, 2px) rotate(0deg); }
          10% { transform: translate(-2px, -1px) rotate(-1deg); }
          20% { transform: translate(-3px, 0px) rotate(1deg); }
          30% { transform: translate(0px, 2px) rotate(0deg); }
          40% { transform: translate(1px, -1px) rotate(1deg); }
          50% { transform: translate(-1px, 2px) rotate(-1deg); }
          60% { transform: translate(-3px, 1px) rotate(0deg); }
          70% { transform: translate(2px, 1px) rotate(-1deg); }
          80% { transform: translate(-1px, -1px) rotate(1deg); }
          90% { transform: translate(2px, 2px) rotate(0deg); }
          100% { transform: translate(1px, -2px) rotate(-1deg); }
        }
        @keyframes ringPulse {
          0% { transform: scale(0.95); opacity: 0.15; }
          50% { transform: scale(1.15); opacity: 0.4; }
          100% { transform: scale(0.95); opacity: 0.15; }
        }
        @keyframes earthquakeRipple {
          0% { transform: scale(0.5); opacity: 1; border-width: 8px; }
          10% { transform: scale(0.7); opacity: 1; border-width: 12px; }
          100% { transform: scale(2.8); opacity: 0; border-width: 1px; }
        }
        @keyframes goldenEmbroidery {
          0% { filter: drop-shadow(0 0 8px rgba(214,173,75,0.5)) brightness(1.0); }
          50% { filter: drop-shadow(0 0 16px rgba(214,173,75,0.9)) brightness(1.25); }
          100% { filter: drop-shadow(0 0 8px rgba(214,173,75,0.5)) brightness(1.0); }
        }
        @keyframes lightTrace {
          0% { stroke-dashoffset: 0; }
          100% { stroke-dashoffset: 200; }
        }
      `}</style>

      {/* Header controls layout */}
      <div className="flex items-center justify-between mb-4 relative z-10">
        <button
          onClick={() => setAudioEnabled(!audioEnabled)}
          className="p-2.5 rounded-full bg-stone-900/80 border border-white/5 text-stone-400 hover:text-white transition-all active:scale-95"
          title={audioEnabled ? "كتم الصوت" : "تشغيل الصوت"}
        >
          {audioEnabled ? <Volume2 className="w-4 h-4 text-amber-400 animate-pulse" /> : <VolumeX className="w-4 h-4" />}
        </button>
        <span className="text-[10px] font-bold tracking-widest text-amber-500/80 bg-stone-900 px-3 py-1 rounded-full border border-amber-500/10 inline-flex items-center gap-1.5 font-sans">
          <Sparkles className="w-3 h-3 text-amber-400" />
          لعبة وهّق غيرك الفيزيائية
        </span>
      </div>

      {/* Main Physics Arena Container */}
      <div className="relative w-full max-w-[340px] aspect-square mx-auto flex items-center justify-center py-6">
        
        {/* Dynamic ambient halo ring backdrop */}
        <div 
          className="absolute w-[290px] h-[290px] rounded-full border border-dashed border-amber-500/20" 
          style={{ animation: "ringPulse 4s ease-in-out infinite" }}
        />

        {/* Circular Orbit layout for participants cards */}
        {!isLobbyEmpty ? (
          participants.map((p, idx) => {
            // Calculate absolute rotational angle of each participant seat around the dial
            const itemAngle = idx * segmentAngle - 90; // Align with center rotation
            const radius = 108; // Orbit radius in pixels
            const rad = (itemAngle * Math.PI) / 180;
            const x = Math.cos(rad) * radius;
            const y = Math.sin(rad) * radius;

            const isPointed = highlightIdx === idx;
            const isTargetLoser = spun && idx === loserIndex;
            const isWinnerRevealed = isFinalHalted && isTargetLoser;

            return (
              <div
                key={`${p.phone}-${idx}`}
                className="absolute z-10 transition-all duration-300"
                style={{
                  transform: `translate(${x}px, ${y}px)`,
                }}
              >
                {/* Participant badge card */}
                <div className={cn(
                  "relative flex flex-col items-center justify-center w-[54px] h-[54px] rounded-2xl bg-stone-900/90 border transition-all duration-300 font-sans shadow-lg",
                  isPointed && !isWinnerRevealed && "border-amber-400 bg-amber-950/20 scale-110 shadow-amber-400/20",
                  !isPointed && "border-white/5",
                  isWinnerRevealed && "border-red-500 bg-red-950/40 scale-125 z-30 shadow-2xl shadow-red-500/40 animate-pulse"
                )}>
                  {/* Absolute earthquake impact ripple flash on winner */}
                  {isWinnerRevealed && earthquake && (
                    <div className="absolute inset-0 rounded-2xl border-4 border-red-500 pointer-events-none"
                         style={{ animation: "earthquakeRipple 1.2s cubic-bezier(0.1, 0.8, 0.3, 1) forwards" }} />
                  )}

                  {/* Icon text letter */}
                  <div className={cn(
                    "w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-black font-sans uppercase mb-0.5",
                    isPointed ? "bg-amber-400 text-stone-950" : "bg-stone-800 text-stone-400",
                    isWinnerRevealed && "bg-red-500 text-white animate-bounce"
                  )}>
                    {p.name?.charAt(0) || "؟"}
                  </div>
                  
                  {/* Truncated Name Label */}
                  <span className={cn(
                    "text-[8px] font-bold font-sans truncate max-w-[48px]",
                    isPointed ? "text-amber-300" : "text-stone-400",
                    isWinnerRevealed && "text-red-400 font-black"
                  )}>
                    {p.name}
                  </span>

                  {/* Mini floating Crown or Skull badge labels */}
                  {isWinnerRevealed && (
                    <div className="absolute -top-3.5 bg-red-500 text-white font-black text-[7px] px-1.5 py-0.5 rounded-full border border-red-400 shadow shadow-black flex items-center gap-0.5 animate-bounce">
                      💥 الضحية
                    </div>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-stone-500 text-xs font-sans max-w-[180px] leading-relaxed relative z-20">
            أضف الأسماء باللوبي أولاً ثم اسحب الدلة لتدير اللعبة!
          </div>
        )}

        {/* Central Spinning Golden Dallah Container */}
        <div 
          ref={containerRef}
          onMouseDown={handleDragStart}
          onMouseMove={handleDragMove}
          onMouseUp={handleDragEnd}
          onMouseLeave={handleDragEnd}
          onTouchStart={handleDragStart}
          onTouchMove={handleDragMove}
          onTouchEnd={handleDragEnd}
          className={cn(
            "relative w-[130px] h-[130px] rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing select-none transition-transform z-20",
            isDragging && "scale-[1.02]"
          )}
        >
          {/* Neon pointer glow ring underneath Dallah */}
          <div className="absolute inset-0 rounded-full border border-amber-500/20 bg-stone-900/35 pointer-events-none shadow-inner" />

          {/* Golden energy light trail tracking rotation angle */}
          <div 
            className="absolute inset-2 rounded-full border border-dashed border-amber-400/40 pointer-events-none"
            style={{ 
              transform: `rotate(${rotatedDegrees}deg)`,
              animation: isSpinning ? "lightTrace 1.5s linear infinite" : "none"
            }}
          />

          {/* DALLAH 3D SVG VECTOR REPRESENTATION */}
          <div 
            className="w-full h-full p-2 relative flex items-center justify-center pointer-events-none"
            style={{ 
              transform: `rotate(${rotatedDegrees}deg)`,
              // Custom continuous glowing embroidery filter
              animation: "goldenEmbroidery 3s ease-in-out infinite"
            }}
          >
            {/* Embedded illuminated pointer arrow facing UP (the Spout) */}
            <div className="absolute top-1 left-1/2 -translate-x-1/2 w-4 h-4 flex items-center justify-center text-amber-400 text-[10px] animate-bounce z-10 font-sans">
              ▼
            </div>

            <svg 
              viewBox="0 0 160 160" 
              className="w-full h-full drop-shadow-[0_10px_20px_rgba(0,0,0,0.8)]"
              fill="none" 
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Illuminated glow back layer */}
              <circle cx="80" cy="80" r="44" fill="url(#dallahGlow)" opacity="0.32" />

              {/* Spout vector (فوهة الدلة) */}
              <path 
                d="M 80 44 L 68 25 C 65 18 80 14 80 10 C 80 14 95 18 92 25 Z" 
                fill="url(#goldGradient3D)" 
                stroke="#FFE17D" 
                strokeWidth="1.5"
                strokeLinejoin="round"
              />

              {/* Lid / Peak crescent top (غطاء الدلة) */}
              <path 
                d="M 80 44 C 70 44 64 56 68 62 L 92 62 C 96 56 90 44 80 44 Z" 
                fill="url(#goldGradientDeep)" 
                stroke="#FFE17D" 
                strokeWidth="1.5"
              />
              {/* Crescent crest tip */}
              <circle cx="80" cy="40" r="3.5" fill="#FFF5D6" />

              {/* Traditional curved handle (مقبض الدلة) */}
              <path 
                d="M 92 78 C 114 74 114 104 94 106 C 104 106 102 88 92 86" 
                fill="none" 
                stroke="url(#goldGradient3D)" 
                strokeWidth="4" 
                strokeLinecap="round"
              />

              {/* Main Pear-shaped Body (جرم الدلة) */}
              <path 
                d="M 68 62 L 92 62 C 94 62 98 76 96 82 C 94 88 98 106 90 114 C 80 120 80 120 70 114 C 62 106 66 88 64 82 C 62 76 66 62 68 62 Z" 
                fill="url(#goldGradient3D)" 
                stroke="#FFE17D" 
                strokeWidth="2"
              />

              {/* Embroidered core light panel (تطريز نقوش السدو الكويتي المنورة) */}
              <path 
                d="M 74 74 L 86 74 L 84 94 L 76 94 Z" 
                fill="rgba(15,81,48,0.3)" 
                stroke="#0FFFEB" 
                strokeWidth="1" 
                opacity="0.9"
              />
              
              {/* Sadu inspired bright diamonds sewn into embroidery */}
              <polygon points="80,78 83,82 80,86 77,82" fill="#D6AD4B" />
              <polygon points="80,84 83,88 80,92 77,88" fill="#FF4B4B" />

              {/* Base skirt */}
              <path 
                d="M 70 114 L 90 114 C 86 118 86 122 80 122 C 74 122 74 118 70 114 Z" 
                fill="url(#goldGradientDeep)" 
                stroke="#FFE17D"
              />

              {/* Highlight reflections */}
              <path 
                d="M 72 65 C 70 75 70 95 72 105" 
                fill="none" 
                stroke="#FFF" 
                strokeWidth="1.5" 
                opacity="0.5" 
                strokeLinecap="round"
              />

              {/* Definitions for gorgeous gold gradients and lighting effects */}
              <defs>
                <radialGradient id="dallahGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#D6AD4B" />
                  <stop offset="100%" stopColor="transparent" />
                </radialGradient>
                <linearGradient id="goldGradient3D" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#FFF2B2" />
                  <stop offset="35%" stopColor="#D6AD4B" />
                  <stop offset="70%" stopColor="#B38622" />
                  <stop offset="100%" stopColor="#705210" />
                </linearGradient>
                <linearGradient id="goldGradientDeep" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#D6AD4B" />
                  <stop offset="50%" stopColor="#B38622" />
                  <stop offset="100%" stopColor="#573D07" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>

        {/* Dynamic real-time speed display pointer at the very bottom of the dial */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-stone-900/80 px-3 py-1.5 rounded-2xl border border-white/5 font-mono text-[9px] text-stone-500 font-bold tracking-widest pointer-events-none select-none">
          {isDragging ? "سحب حر..." : isSpinning ? "جاري الدوران 🌀" : "اسحب الدلة لتدور!"}
        </div>
      </div>

      {/* Action triggers and visual logs info */}
      <AnimatePresence mode="wait">
        {!spun && !isSpinning && participants.length >= 2 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mt-2 space-y-3"
          >
            <div className="flex justify-center items-center gap-2 p-3.5 bg-stone-900/60 rounded-2xl border border-amber-500/5 text-right">
              <Info className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-[11px] text-stone-300 font-bold leading-relaxed font-sans">
                دش اللعبة، مرر إصبعك من فوق "فوهة الدلة الذهبية" لتدور بكامل فيزياء العزم والجاذبية، وتختار من يدفع الكي نت! ☕🎰
              </p>
            </div>
            
            <button
              onClick={() => triggerAutomatedSpin(19)}
              className="w-full bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-stone-950 font-black py-4 rounded-2xl shadow-lg shadow-amber-500/10 active:scale-95 transition-all text-xs flex items-center justify-center gap-2 font-sans"
            >
              <RefreshCw className="w-4 h-4 animate-spin-slow" />
              دش النبضة الحين!
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Halted Game Display States & Actions */}
      {isFinalHalted && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-center space-y-5 w-full mt-6"
        >
          {(() => {
            const parsedLoser = normalizeArabicName(loser || "");
            const parsedMySpinName = normalizeArabicName(mySpinName || "");
            const parsedUrlName = normalizeArabicName(urlName || "");
            
            const isLoser = parsedLoser !== "" && (parsedLoser === parsedMySpinName || parsedLoser === parsedUrlName);
            const myDisplayName = mySpinName || urlName || (isLoser ? (loser || "ضيف") : "ضيفنا");
            const resultContent = getPhraseContent(myDisplayName, isLoser, loser || "عضو");

            if (isLoser) {
              return (
                <div className="p-6 bg-red-950/20 border border-red-500/40 rounded-3xl text-red-100 space-y-4 shadow-xl shadow-red-500/5 transition-all">
                  {paymentStatus === "failed" && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      className="bg-gradient-to-br from-red-600 to-rose-700 text-white p-5 justify-center items-center rounded-2xl flex flex-col gap-2.5 border border-white/10 mb-4 font-sans text-right"
                    >
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-white shrink-0 animate-bounce" />
                        <h4 className="text-sm font-black">فشلت عملية الدفع يا بطل! 💔</h4>
                      </div>
                      <p className="text-[11px] text-white/95 font-bold leading-relaxed">{errorMsg}</p>
                    </motion.div>
                  )}

                  <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-1 animate-pulse">
                    <Trophy className="w-6 h-6 text-red-500" />
                  </div>

                  <h3 className="text-xl font-extrabold text-red-400 font-sans leading-snug">
                    {resultContent.title}
                  </h3>
                  
                  <p className="font-bold text-xs text-stone-300 font-sans leading-relaxed">
                    {resultContent.desc}
                  </p>

                  <div className="bg-white/5 p-4 rounded-2xl border border-white/5 text-sm font-sans flex items-center justify-between">
                    <span className="text-stone-400 text-xs font-bold font-sans">إجمالي الحساب:</span>
                    <strong className="text-xl font-black text-white font-sans">{order.total.toFixed(3)} د.ك</strong>
                  </div>

                  <button
                    onClick={() =>
                      handlePay(
                        urlName || mySpinName || loser || "عضو",
                        mySpinPhone || order.customerPhone || "00000000",
                        String(order.total),
                      )
                    }
                    className="w-full bg-white text-stone-950 hover:bg-stone-100 font-black py-4 rounded-xl mt-4 active:scale-95 transition-all flex justify-center items-center gap-2 shadow-lg shadow-white/5 text-xs font-sans"
                  >
                    <CreditCard className="w-4 h-4 text-amber-600" />
                    {paymentStatus === "failed" ? "حاول مجدداً 🔄" : `تأكيد ودفع القطية`}
                  </button>
                </div>
              );
            }

            return (
              <div className="p-6 bg-stone-900/90 border border-green-500/40 rounded-3xl text-stone-200 space-y-4 shadow-xl">
                <div className="w-12 h-12 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center mx-auto mb-1">
                  <ShieldCheck className="w-6 h-6 text-green-400" />
                </div>
                
                <h3 className="text-lg font-extrabold text-white font-sans leading-snug">
                  {resultContent.title}
                </h3>

                <p className="font-bold text-xs text-stone-400 font-sans leading-relaxed">
                  {resultContent.desc}
                </p>

                <div className="pt-3 border-t border-stone-800 text-[10px] text-stone-500 font-bold font-sans">
                  اللوبي بانتظار إتمام الدفع بواسطة {loser || "صاحب الحظ"}
                </div>
              </div>
            );
          })()}
        </motion.div>
      )}
    </div>
  );
}
