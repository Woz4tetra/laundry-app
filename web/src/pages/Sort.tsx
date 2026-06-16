import { useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store';
import { Button, Header } from '../components/ui';
import { useWakeLock } from '../lib/effects';
import type { FillLevel } from '../lib/types';

const FILLS: FillLevel[] = ['empty', 'small', 'half', 'full'];
const FILL_LABEL: Record<FillLevel, string> = {
  empty: 'Empty',
  small: 'Small',
  half: 'Half',
  full: 'Full',
};
const FILL_HEIGHT: Record<FillLevel, string> = {
  empty: '0%',
  small: '33%',
  half: '60%',
  full: '90%',
};

export function Sort() {
  const { session, config, update, buildLoads } = useStore();
  const nav = useNavigate();
  useWakeLock(true);

  if (!session || !config) return null;
  const categories = [...config.categories].sort((a, b) => a.order - b.order);

  const cycle = (catId: string) => {
    update((s) => {
      const cur = (s.sort[catId] ?? 'empty') as FillLevel;
      const next = FILLS[(FILLS.indexOf(cur) + 1) % FILLS.length];
      s.sort[catId] = next;
    });
  };

  const anyFilled = categories.some(
    (c) => !c.routeToService && session.sort[c.id] && session.sort[c.id] !== 'empty',
  );

  const proceed = async () => {
    await buildLoads();
    nav('/build');
  };

  return (
    <div>
      <Header title="1 · Sort" />
      <p className="mb-4 text-slate-400">
        Tap a bin each time you add to it to set how full it is. Keep going while you sort, the app
        saves as you go.
      </p>

      <div className="grid grid-cols-2 gap-3">
        {categories.map((c) => {
          const fill = (session.sort[c.id] ?? 'empty') as FillLevel;
          const filled = fill !== 'empty';
          return (
            <button
              key={c.id}
              onClick={() => cycle(c.id)}
              className="relative flex h-36 flex-col items-center justify-end overflow-hidden rounded-3xl p-3 text-center ring-1 ring-white/10 transition active:scale-[0.97]"
              style={{ background: filled ? `${c.color}22` : '#1e293b' }}
            >
              <div
                className="absolute inset-x-0 bottom-0 transition-all"
                style={{ height: FILL_HEIGHT[fill], background: `${c.color}33` }}
              />
              <div className="relative text-4xl">{c.icon}</div>
              <div className="relative mt-1 text-sm font-semibold leading-tight">{c.name}</div>
              <div className="relative mt-1 text-xs text-slate-300">
                {c.routeToService ? '→ cleaning service' : filled ? FILL_LABEL[fill] : 'tap to add'}
              </div>
            </button>
          );
        })}
      </div>

      <Button className="mt-6 w-full" disabled={!anyFilled} onClick={proceed}>
        Build loads →
      </Button>
    </div>
  );
}
