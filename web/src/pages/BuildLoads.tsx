import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store';
import { Button, Card, Header, Pill } from '../components/ui';
import type { Category } from '../lib/types';

function labelFor(ids: string[], byId: Map<string, Category>): string {
  return ids.map((id) => byId.get(id)?.name ?? id).join(' + ');
}

export function BuildLoads() {
  const { session, config, update } = useStore();
  const nav = useNavigate();
  if (!session || !config) return null;

  const byId = new Map(config.categories.map((c) => [c.id, c]));

  // Things to surface that aren't wash loads.
  const service = config.categories.filter(
    (c) => c.routeToService && session.sort[c.id] && session.sort[c.id] !== 'empty',
  );
  const notes = useMemo(() => {
    const out: string[] = [];
    for (const load of session.loads) {
      if (load.categoryIds.length > 1)
        out.push(`${load.label}: small loads combined to save a cycle.`);
      for (const id of load.categoryIds) {
        const c = byId.get(id);
        if (c?.exclusions.length)
          out.push(`${c.name}: don't add ${c.exclusions.join(' or ').replace(/_/g, ' ')}.`);
      }
    }
    return out;
  }, [session.loads]);

  const splitOut = (loadId: string, catId: string) =>
    update((s) => {
      const load = s.loads.find((l) => l.id === loadId);
      if (!load || load.categoryIds.length < 2) return;
      load.categoryIds = load.categoryIds.filter((c) => c !== catId);
      load.label = labelFor(load.categoryIds, byId);
      s.loads.push({
        id: `${loadId}-${catId}`,
        categoryIds: [catId],
        label: byId.get(catId)?.name ?? catId,
        status: 'queued',
        checked: {},
        createdAt: Date.now(),
      });
    });

  const mergeInto = (fromId: string, intoId: string) =>
    update((s) => {
      const from = s.loads.find((l) => l.id === fromId);
      const into = s.loads.find((l) => l.id === intoId);
      if (!from || !into) return;
      into.categoryIds = [...new Set([...into.categoryIds, ...from.categoryIds])];
      into.label = labelFor(into.categoryIds, byId);
      s.loads = s.loads.filter((l) => l.id !== fromId);
    });

  const remove = (loadId: string) =>
    update((s) => {
      s.loads = s.loads.filter((l) => l.id !== loadId);
    });

  const startRunning = () =>
    update((s) => {
      s.step = 'run';
    }).then(() => nav('/overview'));

  return (
    <div>
      <Header title="2 · Loads" />
      <p className="mb-4 text-slate-400">
        Here's how we'll split things up. Merge or separate as needed.
      </p>

      <div className="space-y-3">
        {session.loads.map((load) => {
          const primary = byId.get(load.categoryIds[0]);
          const others = session.loads.filter((l) => l.id !== load.id);
          return (
            <Card key={load.id}>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-lg font-semibold">
                  {primary?.icon} {load.label}
                </span>
                <button
                  onClick={() => remove(load.id)}
                  className="text-sm text-slate-400 underline"
                >
                  remove
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {load.categoryIds.map((id) => (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1 rounded-full bg-slate-700 px-3 py-1 text-sm"
                  >
                    {byId.get(id)?.icon} {byId.get(id)?.name}
                    {load.categoryIds.length > 1 && (
                      <button
                        onClick={() => splitOut(load.id, id)}
                        className="ml-1 text-slate-400"
                        aria-label="split out"
                      >
                        ✕
                      </button>
                    )}
                  </span>
                ))}
              </div>
              {others.length > 0 && (
                <div className="mt-3">
                  <select
                    className="w-full rounded-xl bg-slate-700 px-3 py-2 text-sm"
                    value=""
                    onChange={(e) => e.target.value && mergeInto(load.id, e.target.value)}
                  >
                    <option value="">Merge into…</option>
                    {others.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </Card>
          );
        })}

        {session.loads.length === 0 && (
          <Card>
            <p className="text-slate-400">No wash loads. Add some clothes in sorting first.</p>
          </Card>
        )}
      </div>

      {service.length > 0 && (
        <Card className="mt-4 ring-amber-500/30">
          <div className="mb-1 font-semibold">💎 Cleaning service</div>
          <p className="text-sm text-slate-300">
            Set aside (do not wash): {service.map((c) => c.name).join(', ')}.
          </p>
        </Card>
      )}

      {notes.length > 0 && (
        <Card className="mt-4">
          <div className="mb-2 font-semibold">Heads up</div>
          <ul className="space-y-1 text-sm text-slate-300">
            {notes.map((n, i) => (
              <li key={i}>• {n}</li>
            ))}
          </ul>
        </Card>
      )}

      <div className="mt-6 flex gap-2">
        <Button variant="ghost" className="flex-1" onClick={() => nav('/sort')}>
          ← Sort
        </Button>
        <Button
          className="flex-1"
          disabled={session.loads.length === 0}
          onClick={startRunning}
        >
          Start →
        </Button>
      </div>
    </div>
  );
}
