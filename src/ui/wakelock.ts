// Best-effort Wake Lock to prevent the screen from sleeping during a session.

let sentinel: WakeLockSentinel | null = null;

export async function requestWakeLock() {
  try {
    sentinel = await (navigator as any).wakeLock?.request("screen");
    document.addEventListener("visibilitychange", async () => {
      if (document.visibilityState === "visible" && !sentinel) {
        try { sentinel = await (navigator as any).wakeLock?.request("screen"); } catch {}
      }
    });
  } catch {
    // not supported / not granted; ignore.
  }
}

export async function releaseWakeLock() {
  await sentinel?.release().catch(() => {});
  sentinel = null;
}
