/**
 * Geolocation fetcher with a lower-accuracy fallback for Safari and devices
 * that cannot acquire a precise GPS fix quickly.
 */

export interface RobustLocationOptions {
  timeout?: number;
  maximumAge?: number;
  enableHighAccuracy?: boolean;
}

export function robustGetCurrentPosition(
  options: RobustLocationOptions = {}
): Promise<GeolocationPosition> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.reject({
      code: 2,
      message: "Geolocation is not supported on this device.",
      PERMISSION_DENIED: 1,
      POSITION_UNAVAILABLE: 2,
      TIMEOUT: 3
    } as GeolocationPositionError);
  }

  const {
    timeout = 15000,
    maximumAge = 30000,
    enableHighAccuracy = true
  } = options;

  return new Promise((resolve, reject) => {
    let settled = false;
    let watchId: number | null = null;
    let safetyTimer: ReturnType<typeof setTimeout> | null = null;

    const finish = (position?: GeolocationPosition, error?: GeolocationPositionError) => {
      if (settled) return;
      settled = true;

      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
      if (safetyTimer !== null) {
        clearTimeout(safetyTimer);
      }

      if (position) {
        resolve(position);
      } else {
        reject(error);
      }
    };

    const startSafariFallback = (initialError: GeolocationPositionError) => {
      let fallbackFailures = 0;
      let lastError = initialError;
      const fallbackFailed = (error: GeolocationPositionError) => {
        fallbackFailures += 1;
        lastError = error;
        if (fallbackFailures >= 2) finish(undefined, lastError);
      };
      const fallbackOptions: PositionOptions = {
        enableHighAccuracy: false,
        timeout: Math.max(5000, Math.floor(timeout / 2)),
        maximumAge: Math.max(maximumAge, 120000),
      };

      navigator.geolocation.getCurrentPosition(
        (position) => finish(position),
        fallbackFailed,
        fallbackOptions,
      );
      watchId = navigator.geolocation.watchPosition(
        (position) => finish(position),
        fallbackFailed,
        fallbackOptions,
      );
    };

    navigator.geolocation.getCurrentPosition(
      (pos) => finish(pos),
      (err) => {
        if (err.code === 1) {
          finish(undefined, err);
          return;
        }
        startSafariFallback(err);
      },
      {
        enableHighAccuracy,
        timeout: Math.max(5000, Math.floor(timeout / 2)),
        maximumAge
      }
    );

    safetyTimer = setTimeout(() => {
      if (!settled) {
        finish(undefined, {
          code: 3,
          message: "Geolocation took too long to respond.",
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3
        } as GeolocationPositionError);
      }
    }, timeout + 1000);
  });
}
