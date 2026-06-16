import { useEffect, useState } from 'react';

/** Live mm:ss countdown to an absolute timestamp. */
export function Countdown({ endsAt, onDone }: { endsAt: number; onDone?: () => void }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (now >= endsAt && onDone) onDone();
  }, [now >= endsAt]); // eslint-disable-line react-hooks/exhaustive-deps

  const remaining = Math.max(0, endsAt - now);
  const total = Math.floor(remaining / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  const done = remaining <= 0;

  return (
    <span className={`font-mono tabular-nums ${done ? 'text-emerald-400' : ''}`}>
      {done ? 'Done!' : `${m}:${s.toString().padStart(2, '0')}`}
    </span>
  );
}
