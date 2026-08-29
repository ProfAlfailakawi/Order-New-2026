import React from 'react';
import { useState, useEffect, useCallback } from "react";

const GUIDANCE_STORAGE_PREFIX = "alturath_icon_guidance_v1_";

// Global / Standard obvious icons that should NOT have guidance tooltips
export const GLOBAL_OBVIOUS_ICON_IDS = new Set([
  "search",
  "back",
  "close",
  "delete",
  "remove",
  "play",
  "stop",
  "share",
  "download",
  "print",
  "menu",
  "settings",
  "cart",
  "home",
  "user",
  "phone",
  "location_pin",
  "refresh",
  "check",
  "cancel",
]);

/**
 * Check if the user has already seen guidance for a given icon ID
 */
export const hasSeenGuidance = (id: string): boolean => {
  if (typeof window === "undefined" || !id) return true;
  if (GLOBAL_OBVIOUS_ICON_IDS.has(id.toLowerCase())) return true;
  try {
    return window.localStorage.getItem(`${GUIDANCE_STORAGE_PREFIX}${id}`) === "seen";
  } catch {
    return false;
  }
};

/**
 * Mark guidance as seen for a given icon ID
 */
export const markGuidanceAsSeen = (id: string): void => {
  if (typeof window === "undefined" || !id) return;
  try {
    window.localStorage.setItem(`${GUIDANCE_STORAGE_PREFIX}${id}`, "seen");
  } catch {
    // Ignore storage issues in private browsing
  }
};

/**
 * Helper to check if current device is touch-based / mobile
 */
export const checkIsTouchDevice = (): boolean => {
  if (typeof window === "undefined") return false;
  return (
    "ontouchstart" in window ||
    navigator.maxTouchPoints > 0 ||
    window.matchMedia("(pointer: coarse)").matches
  );
};

export interface UseSmartIconGuidanceOptions {
  id: string;
  disabled?: boolean;
  autoDismissMs?: number;
}

export function useSmartIconGuidance({
  id,
  disabled = false,
  autoDismissMs = 4000,
}: UseSmartIconGuidanceOptions) {
  const isGlobalIcon = GLOBAL_OBVIOUS_ICON_IDS.has(id.toLowerCase());
  const isDisabled = disabled || isGlobalIcon;

  const [hasSeen, setHasSeen] = useState<boolean>(() => {
    if (isDisabled) return true;
    return hasSeenGuidance(id);
  });

  const [showTooltip, setShowTooltip] = useState<boolean>(false);
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const [isTouchDevice, setIsTouchDevice] = useState<boolean>(false);

  useEffect(() => {
    setIsTouchDevice(checkIsTouchDevice());
  }, []);

  // Auto dismiss timer for active mobile tooltip
  useEffect(() => {
    if (!showTooltip) return;
    const timer = setTimeout(() => {
      setShowTooltip(false);
    }, autoDismissMs);
    return () => clearTimeout(timer);
  }, [showTooltip, autoDismissMs]);

  /**
   * Intercept click for touch devices on first tap
   * Returns true if action should execute, false if intercepted by guidance
   */
  const handleInterceptedClick = useCallback(
    (e?: React.MouseEvent): boolean => {
      // If disabled or global icon, allow immediate action
      if (isDisabled) return true;

      const touchDevice = checkIsTouchDevice();
      const alreadySeen = hasSeenGuidance(id);

      // On desktop: direct click always works
      if (!touchDevice) {
        setShowTooltip(false);
        return true;
      }

      // On mobile / touch device:
      if (!alreadySeen) {
        if (!showTooltip) {
          // 1st tap: Show guidance, mark as seen, block action
          markGuidanceAsSeen(id);
          setHasSeen(true);
          setShowTooltip(true);
          if (e) {
            e.stopPropagation();
            e.preventDefault();
          }
          return false;
        } else {
          // 2nd tap while tooltip active: Dismiss & allow action
          setShowTooltip(false);
          return true;
        }
      }

      // If already seen in past sessions: allow action directly
      setShowTooltip(false);
      return true;
    },
    [id, isDisabled, showTooltip]
  );

  const dismissTooltip = useCallback(() => {
    setShowTooltip(false);
  }, []);

  return {
    hasSeen,
    showTooltip: showTooltip || (isHovered && !isTouchDevice),
    isMobileTooltipActive: showTooltip,
    isHovered,
    isTouchDevice,
    setIsHovered,
    handleInterceptedClick,
    dismissTooltip,
  };
}
