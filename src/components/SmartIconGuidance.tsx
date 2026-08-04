import React, { useState, useRef, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles } from "lucide-react";
import { useSmartIconGuidance, GLOBAL_OBVIOUS_ICON_IDS } from "../hooks/useSmartIconGuidance";
import { cn } from "../utils";

export interface SmartIconGuidanceProps {
  id: string; // Unique ID for storage tracking, e.g. "sadu_rug_toggle"
  title: string; // Short Arabic title, e.g. "نمط سجاد السدو"
  description?: string; // Short explanation of the tool
  placement?: "top" | "bottom" | "left" | "right";
  disabled?: boolean;
  className?: string;
  children: React.ReactElement;
}

interface CalculatedPosition {
  top: number;
  left: number;
  computedPlacement: "top" | "bottom" | "left" | "right";
  arrowOffset: number; // Offset in px along the edge facing the trigger
}

export function SmartIconGuidance({
  id,
  title,
  description,
  placement = "top",
  disabled = false,
  className,
  children,
}: SmartIconGuidanceProps) {
  const isGlobal = GLOBAL_OBVIOUS_ICON_IDS.has(id.toLowerCase());
  const isDisabled = disabled || isGlobal;

  const {
    hasSeen,
    showTooltip,
    isMobileTooltipActive,
    isTouchDevice,
    setIsHovered,
    handleInterceptedClick,
    dismissTooltip,
  } = useSmartIconGuidance({ id, disabled: isDisabled });

  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const [pos, setPos] = useState<CalculatedPosition | null>(null);

  // Close tooltip when clicking outside on mobile
  useEffect(() => {
    if (!isMobileTooltipActive) return;

    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        dismissTooltip();
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("touchstart", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
    };
  }, [isMobileTooltipActive, dismissTooltip]);

  // Recalculate fixed position in viewport with bounds clamping & dynamic arrow placement
  const updatePosition = () => {
    if (!containerRef.current) return;
    const triggerRect = containerRef.current.getBoundingClientRect();
    if (triggerRect.width === 0 && triggerRect.height === 0) return;

    const tooltipEl = tooltipRef.current;
    const tooltipWidth = tooltipEl ? tooltipEl.offsetWidth : 210;
    const tooltipHeight = tooltipEl ? tooltipEl.offsetHeight : 80;

    const gutter = 12; // Margin from viewport edges
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const targetCenterX = triggerRect.left + triggerRect.width / 2;
    const targetCenterY = triggerRect.top + triggerRect.height / 2;

    let computedPlacement = placement;
    let computedTop = 0;
    let computedLeft = 0;
    let arrowOffset = 0;

    // Flip top/bottom if close to viewport boundaries
    if (placement === "top" && triggerRect.top - tooltipHeight - 8 < gutter) {
      computedPlacement = "bottom";
    } else if (placement === "bottom" && triggerRect.bottom + tooltipHeight + 8 > viewportHeight - gutter) {
      computedPlacement = "top";
    } else if (placement === "left" && triggerRect.left - tooltipWidth - 8 < gutter) {
      computedPlacement = "right";
    } else if (placement === "right" && triggerRect.right + tooltipWidth + 8 > viewportWidth - gutter) {
      computedPlacement = "left";
    }

    if (computedPlacement === "top" || computedPlacement === "bottom") {
      computedTop = computedPlacement === "top"
        ? triggerRect.top - tooltipHeight - 8
        : triggerRect.bottom + 8;

      // Clamp horizontally to stay inside viewport (with gutter)
      const unclampedLeft = targetCenterX - tooltipWidth / 2;
      const minLeft = gutter;
      const maxLeft = Math.max(gutter, viewportWidth - tooltipWidth - gutter);
      computedLeft = Math.max(minLeft, Math.min(unclampedLeft, maxLeft));

      // Arrow position relative to tooltip box left edge
      const relativeArrowX = targetCenterX - computedLeft;
      // Keep arrow away from rounded corners (min 14px, max tooltipWidth - 14px)
      arrowOffset = Math.max(14, Math.min(relativeArrowX, tooltipWidth - 14));
    } else {
      computedLeft = computedPlacement === "left"
        ? triggerRect.left - tooltipWidth - 8
        : triggerRect.right + 8;

      // Clamp vertically
      const unclampedTop = targetCenterY - tooltipHeight / 2;
      const minTop = gutter;
      const maxTop = Math.max(gutter, viewportHeight - tooltipHeight - gutter);
      computedTop = Math.max(minTop, Math.min(unclampedTop, maxTop));

      // Arrow position relative to tooltip box top edge
      const relativeArrowY = targetCenterY - computedTop;
      arrowOffset = Math.max(14, Math.min(relativeArrowY, tooltipHeight - 14));
    }

    setPos({
      top: computedTop,
      left: computedLeft,
      computedPlacement,
      arrowOffset,
    });
  };

  useLayoutEffect(() => {
    if (!showTooltip) return;
    updatePosition();
    // Re-measure after rendered
    const animationFrame = requestAnimationFrame(updatePosition);

    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [showTooltip, placement, title, description]);

  if (isDisabled) {
    return children;
  }

  const handleCaptureClick = (e: React.MouseEvent) => {
    const shouldProceed = handleInterceptedClick(e);
    if (!shouldProceed) {
      // Prevent child elements (like <button>) from executing onClick on 1st tap
      e.stopPropagation();
      e.preventDefault();
    }
  };

  return (
    <div
      ref={containerRef}
      className={cn("relative inline-flex items-center justify-center", className)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClickCapture={handleCaptureClick}
    >
      {/* Target Element with subtle pulse ring on 1st time mobile guidance */}
      <div className={cn("relative transition-transform duration-200", isMobileTooltipActive && "scale-105")}>
        {children}
        {isMobileTooltipActive && (
          <span className="absolute -inset-1 rounded-full border border-amber-400/60 animate-ping pointer-events-none" />
        )}
      </div>

      {/* Floating Guidance Tooltip Card via Portal into document.body */}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {showTooltip && (
              <motion.div
                ref={tooltipRef}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                style={{
                  position: "fixed",
                  top: pos ? `${pos.top}px` : "-9999px",
                  left: pos ? `${pos.left}px` : "-9999px",
                }}
                className="z-[99999] pointer-events-none min-w-[180px] max-w-[240px] px-3 py-2 rounded-xl text-right dir-rtl shadow-2xl border border-amber-500/40 bg-slate-950/95 text-amber-50 backdrop-blur-md"
              >
                {/* Header */}
                <div className="flex items-center gap-1.5 font-bold text-[12px] text-amber-300 mb-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0 animate-pulse" />
                  <span>{title}</span>
                </div>

                {/* Description */}
                {description && (
                  <p className="text-[11px] leading-relaxed text-slate-300 font-normal mb-1.5">
                    {description}
                  </p>
                )}

                {/* Mobile First-Time Hint Footer */}
                {isMobileTooltipActive && (
                  <div className="mt-1 pt-1 border-t border-amber-500/20 flex items-center justify-between text-[10px] text-amber-300/90 font-medium">
                    <span className="bg-amber-500/20 text-amber-200 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                      <span>اضغط مجدداً للتنفيذ</span>
                    </span>
                    <span className="text-[9px] text-slate-400">إرشاد أول مرة</span>
                  </div>
                )}

                {/* Dynamic Arrow pointing accurately at the trigger icon center */}
                {pos && (
                  <div
                    className="absolute w-0 h-0"
                    style={
                      pos.computedPlacement === "top"
                        ? {
                            bottom: "-4px",
                            left: `${pos.arrowOffset}px`,
                            transform: "translateX(-50%)",
                            borderTop: "4px solid rgba(15, 23, 42, 0.95)",
                            borderLeft: "4px solid transparent",
                            borderRight: "4px solid transparent",
                            borderBottom: "0",
                          }
                        : pos.computedPlacement === "bottom"
                        ? {
                            top: "-4px",
                            left: `${pos.arrowOffset}px`,
                            transform: "translateX(-50%)",
                            borderBottom: "4px solid rgba(15, 23, 42, 0.95)",
                            borderLeft: "4px solid transparent",
                            borderRight: "4px solid transparent",
                            borderTop: "0",
                          }
                        : pos.computedPlacement === "left"
                        ? {
                            right: "-4px",
                            top: `${pos.arrowOffset}px`,
                            transform: "translateY(-50%)",
                            borderLeft: "4px solid rgba(15, 23, 42, 0.95)",
                            borderTop: "4px solid transparent",
                            borderBottom: "4px solid transparent",
                            borderRight: "0",
                          }
                        : {
                            left: "-4px",
                            top: `${pos.arrowOffset}px`,
                            transform: "translateY(-50%)",
                            borderRight: "4px solid rgba(15, 23, 42, 0.95)",
                            borderTop: "4px solid transparent",
                            borderBottom: "4px solid transparent",
                            borderLeft: "0",
                          }
                    }
                  />
                )}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
}

