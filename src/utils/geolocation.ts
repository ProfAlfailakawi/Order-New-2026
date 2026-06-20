/**
 * Robust geolocation fetcher that combines getCurrentPosition with a watchPosition fallback.
 * This pattern is more reliable on mobile devices where GPS locks might take time.
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

    const finish = (position?: GeolocationPosition, error?: GeolocationPositionError) => {
      if (settled) return;
      settled = true;

      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }

      if (position) {
        resolve(position);
      } else {
        reject(error);
      }
    };

    // Attempt standard one-shot fetch first
    navigator.geolocation.getCurrentPosition(
      (pos) => finish(pos),
      (err) => {
        // If it fails (except for "Permission Denied"), try watchPosition fallback
        if (err.code === 1) { // PERMISSION_DENIED
          finish(undefined, err);
          return;
        }

        // Fallback to watchPosition which can be more "persistent" in seeking a lock
        watchId = navigator.geolocation.watchPosition(
          (pos) => {
            // Only resolve if accuracy is "good enough" or if we are nearing the timeout
            // For simplicity, we just resolve on the first successful hit
            finish(pos);
          },
          (watchErr) => {
            // If watchPosition also fails, we're likely truly out of options
            finish(undefined, watchErr);
          },
          {
            enableHighAccuracy,
            timeout,
            maximumAge
          }
        );
      },
      {
        enableHighAccuracy,
        timeout: Math.floor(timeout / 2), // Spend half the time on the one-shot
        maximumAge
      }
    );

    // Hard safety timeout in case navigator.geolocation hangs completely
    setTimeout(() => {
      if (!settled) {
        finish(undefined, {
          code: 3, // TIMEOUT
          message: "Geolocation took too long to respond.",
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3
        } as GeolocationPositionError);
      }
    }, timeout + 1000);
  });
}
