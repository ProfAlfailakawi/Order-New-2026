import React, { useState, useRef, useEffect, useCallback } from "react";
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

interface PositionCoords {
  top: number;
  left: number;
  arrowLeft: number;
  effectivePlacement: "top" | "bottom";
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
    showTooltip,
    isMobileTooltipActive,
    setIsHovered,
    handleInterceptedClick,
    dismissTooltip,
  } = useSmartIconGuidance({ id, disabled: isDisabled });

  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const [coords, setCoords] = useState<PositionCoords>({
    top: 0,
    left: 0,
    arrowLeft: 120,
    effectivePlacement: placement === "bottom" ? "bottom" : "top",
  });

  const updatePosition = useCallback(() => {
    if (!containerRef.current) return;

    const targetRect = containerRef.current.getBoundingClientRect();
    const iconCenterX = targetRect.left + targetRect.width / 2;

    const GUTTER = 12;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Default or measured tooltip width and height
    const tooltipWidth = tooltipRef.current ? tooltipRef.current.offsetWidth : 210;
    const tooltipHeight = tooltipRef.current ? tooltipRef.current.offsetHeight : 80;

    // Ideal centered left position
    const idealLeft = iconCenterX - tooltipWidth / 2;
    // Clamp within screen boundaries with 12px gutter
    const clampedLeft = Math.max(GUTTER, Math.min(viewportWidth - tooltipWidth - GUTTER, idealLeft));

    // Calculate relative arrow position pointing accurately to center of target icon
    const rawArrowLeft = iconCenterX - clampedLeft;
    // Keep arrow inside tooltip card with min padding
    const arrowLeft = Math.max(14, Math.min(tooltipWidth - 14, rawArrowLeft));

    // Check vertical bounds (top vs bottom placement)
    let effPlacement: "top" | "bottom" = placement === "bottom" ? "bottom" : "top";
    let calcTop = 0;

    if (effPlacement === "top") {
      calcTop = targetRect.top - tooltipHeight - 10;
      if (calcTop < GUTTER) {
        effPlacement = "bottom";
        calcTop = targetRect.bottom + 10;
      }
    } else {
      calcTop = targetRect.bottom + 10;
      if (calcTop + tooltipHeight > viewportHeight - GUTTER) {
        effPlacement = "top";
        calcTop = targetRect.top - tooltipHeight - 10;
      }
    }

    setCoords({
      top: Math.max(GUTTER, calcTop),
      left: clampedLeft,
      arrowLeft,
      effectivePlacement: effPlacement,
    });
  }, [placement]);

  // Recalculate position when tooltip opens or on scroll/resize
  useEffect(() => {
    if (!showTooltip) return;

    updatePosition();
    // Second pass after DOM paint to measure exact height/width
    const animationFrame = requestAnimationFrame(() => {
      updatePosition();
    });

    const handleScrollOrResize = () => {
      updatePosition();
    };

    window.addEventListener("scroll", handleScrollOrResize, { capture: true, passive: true });
    window.addEventListener("resize", handleScrollOrResize, { passive: true });

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener("scroll", handleScrollOrResize, { capture: true });
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [showTooltip, updatePosition]);

  // Close tooltip when clicking outside on mobile
  useEffect(() => {
    if (!isMobileTooltipActive) return;

    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (
        containerRef.current && !containerRef.current.contains(e.target as Node) &&
        tooltipRef.current && !tooltipRef.current.contains(e.target as Node)
      ) {
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

  if (isDisabled) {
    return children;
  }

  const handleCaptureClick = (e: React.MouseEvent) => {
    const shouldProceed = handleInterceptedClick(e);
    if (!shouldProceed) {
      e.stopPropagation();
      e.preventDefault();
    }
  };

  const portalContent = (
    <AnimatePresence>
      {showTooltip && (
        <motion.div
          ref={tooltipRef}
          initial={{ opacity: 0, scale: 0.9, y: coords.effectivePlacement === "top" ? 4 : -4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          style={{
            position: "fixed",
            top: `${coords.top}px`,
            left: `${coords.left}px`,
            zIndex: 99999,
          }}
          className="pointer-events-none min-w-[180px] max-w-[240px] px-3 py-2 rounded-xl text-right dir-rtl shadow-2xl border border-amber-500/40 bg-slate-950/95 text-amber-50 backdrop-blur-md"
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

          {/* Tooltip arrow aligned to icon center */}
          <div
            className={cn(
              "absolute w-0 h-0 border-x-transparent border-x-4",
              coords.effectivePlacement === "top"
                ? "bottom-[-5px] border-t-amber-950/90 border-t-4 border-b-0"
                : "top-[-5px] border-b-amber-950/90 border-b-4 border-t-0"
            )}
            style={{
              left: `${coords.arrowLeft}px`,
              transform: "translateX(-50%)",
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <>
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
      </div>

      {/* Render tooltip in document.body via Portal */}
      {typeof document !== "undefined" && createPortal(portalContent, document.body)}
    </>
  );
}
