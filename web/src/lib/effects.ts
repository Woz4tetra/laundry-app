import confetti from 'canvas-confetti';
import { useEffect, useRef } from 'react';

export function celebrate(): void {
  confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 } });
  setTimeout(() => confetti({ particleCount: 50, angle: 60, spread: 55, origin: { x: 0 } }), 150);
  setTimeout(
    () => confetti({ particleCount: 50, angle: 120, spread: 55, origin: { x: 1 } }),
    300,
  );
}

/**
 * Keep the screen awake while a screen is mounted (so sorting/loading isn't
 * interrupted by the phone sleeping). No-op where unsupported.
 */
export function useWakeLock(active = true): void {
  const lockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;
    let released = false;

    const acquire = async () => {
      try {
        lockRef.current = await (navigator as Navigator).wakeLock.request('screen');
      } catch {
        /* ignore */
      }
    };
    acquire();

    const onVisible = () => {
      if (document.visibilityState === 'visible' && !released) acquire();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      released = true;
      document.removeEventListener('visibilitychange', onVisible);
      lockRef.current?.release().catch(() => {});
      lockRef.current = null;
    };
  }, [active]);
}
