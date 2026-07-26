import assert from "node:assert/strict";
import test from "node:test";
import { robustGetCurrentPosition } from "./src/utils/geolocation";

const position = {
  coords: {
    latitude: 29.3375,
    longitude: 47.9774,
    accuracy: 25,
    altitude: null,
    altitudeAccuracy: null,
    heading: null,
    speed: null,
  },
  timestamp: Date.now(),
} as GeolocationPosition;

const locationError = (code: number) =>
  ({
    code,
    message: code === 1 ? "denied" : "timeout",
    PERMISSION_DENIED: 1,
    POSITION_UNAVAILABLE: 2,
    TIMEOUT: 3,
  }) as GeolocationPositionError;

async function withMockGeolocation(
  geolocation: Partial<Geolocation>,
  assertion: () => Promise<void>,
) {
  const originalNavigator = Object.getOwnPropertyDescriptor(
    globalThis,
    "navigator",
  );
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { geolocation },
  });
  try {
    await assertion();
  } finally {
    if (originalNavigator) {
      Object.defineProperty(
        globalThis,
        "navigator",
        originalNavigator,
      );
    } else {
      delete (globalThis as any).navigator;
    }
  }
}

test("geolocation returns the precise position when available", async () => {
  await withMockGeolocation(
    {
      getCurrentPosition: (success) => {
        setTimeout(() => success(position), 0);
      },
      watchPosition: () => 1,
      clearWatch: () => undefined,
    },
    async () => {
      const result = await robustGetCurrentPosition({
        timeout: 6000,
      });
      assert.equal(result.coords.latitude, position.coords.latitude);
    },
  );
});

test("Safari-style precise timeout falls back to a standard fix", async () => {
  let currentPositionCalls = 0;
  let clearedWatchId: number | null = null;
  await withMockGeolocation(
    {
      getCurrentPosition: (success, error) => {
        currentPositionCalls += 1;
        if (currentPositionCalls === 1) {
          setTimeout(() => error?.(locationError(3)), 0);
        } else {
          setTimeout(() => success(position), 0);
        }
      },
      watchPosition: () => 17,
      clearWatch: (watchId) => {
        clearedWatchId = watchId;
      },
    },
    async () => {
      const result = await robustGetCurrentPosition({
        timeout: 6000,
        enableHighAccuracy: true,
      });
      assert.equal(result.coords.longitude, position.coords.longitude);
      assert.equal(currentPositionCalls, 2);
      assert.equal(clearedWatchId, 17);
    },
  );
});

test("permission denial never retries or starts a watcher", async () => {
  let currentPositionCalls = 0;
  let watcherCalls = 0;
  await withMockGeolocation(
    {
      getCurrentPosition: (_success, error) => {
        currentPositionCalls += 1;
        setTimeout(() => error?.(locationError(1)), 0);
      },
      watchPosition: () => {
        watcherCalls += 1;
        return 1;
      },
      clearWatch: () => undefined,
    },
    async () => {
      await assert.rejects(
        robustGetCurrentPosition({ timeout: 6000 }),
        (error: any) => error?.code === 1,
      );
      assert.equal(currentPositionCalls, 1);
      assert.equal(watcherCalls, 0);
    },
  );
});
