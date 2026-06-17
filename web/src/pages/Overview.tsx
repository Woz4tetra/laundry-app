import { useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store';
import { Button, Card, Header, Pill } from '../components/ui';
import { Countdown } from '../components/Countdown';
import { fmtTime } from '../lib/schedule';
import type { Load, LoadStatus } from '../lib/types';

const STATUS: Record<LoadStatus, { label: string; tone: string }> = {
  queued: { label: 'Queued', tone: 'slate' },
  prepping: { label: 'Prepping', tone: 'sky' },
  ready_to_wash: { label: 'Ready to wash', tone: 'sky' },
  washing: { label: 'Washing', tone: 'sky' },
  wash_done: { label: 'Wash done', tone: 'amber' },
  drying: { label: 'Drying', tone: 'sky' },
  dry_done: { label: 'Dry done', tone: 'amber' },
  done: { label: 'Done', tone: 'emerald' },
};

function actionLabel(l: Load): string {
  if (l.timer?.kind === 'delayed_start') return l.timer.endsAt > Date.now() ? 'View' : 'Start';
  switch (l.status) {
    case 'washing':
      return 'Washing…';
    case 'drying':
      return 'Drying…';
    case 'wash_done':
      return 'Start drying';
    case 'dry_done':
      return 'Finish up';
    case 'done':
      return 'Review';
    default:
      return 'Start';
  }
}

export function Overview() {
  const { session, config, newSession, update } = useStore();
  const nav = useNavigate();
  if (!session || !config) return null;

  const byId = new Map(config.categories.map((c) => [c.id, c]));
  const allDone = session.loads.length > 0 && session.loads.every((l) => l.status === 'done');
  const showDoorReminder =
    config.settings.leaveDoorOpenAfter && allDone && !session.doorOpenAcknowledged;

  return (
    <div>
      <Header
        title="Loads"
        right={
          <button
            className="text-sm text-slate-400 underline"
            onClick={async () => {
              await newSession();
              nav('/sort');
            }}
          >
            new session
          </button>
        }
      />

      {session.loads.length === 0 && (
        <Card>
          <p className="text-slate-400">No loads yet.</p>
          <Button className="mt-3 w-full" onClick={() => nav('/sort')}>
            Start sorting
          </Button>
        </Card>
      )}

      <div className="space-y-3">
        {session.loads.map((load) => {
          const primary = byId.get(load.categoryIds[0]);
          const t = load.timer;
          const scheduled = t?.kind === 'delayed_start';
          const pending = scheduled && t!.endsAt > Date.now();
          // A scheduled wash keeps its pre-wash status, so surface the timer
          // instead of a misleading "Ready to wash".
          const st = scheduled
            ? { label: pending ? 'Scheduled' : 'Time to start', tone: 'amber' }
            : STATUS[load.status];
          return (
            <Card key={load.id} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-lg font-semibold">
                  {primary?.icon} {load.label}
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <Pill tone={st.tone}>{st.label}</Pill>
                  {scheduled ? (
                    <span className="text-sm text-slate-300">
                      🕒 {pending ? `runs ${fmtTime(t!.endsAt)}` : 'ready to start'}
                    </span>
                  ) : (
                    t &&
                    (load.status === 'washing' || load.status === 'drying') && (
                      <span className="text-sm text-slate-300">
                        ⏱ <Countdown endsAt={t.endsAt} />
                      </span>
                    )
                  )}
                </div>
              </div>
              <Button
                className="shrink-0 px-4 py-3 text-base"
                variant={load.status === 'done' ? 'ghost' : 'primary'}
                onClick={() => nav(`/run/${load.id}`)}
              >
                {actionLabel(load)}
              </Button>
            </Card>
          );
        })}
      </div>

      {showDoorReminder && (
        <Card className="mt-5 ring-amber-500/40">
          <div className="mb-1 text-lg font-semibold">🚪 Leave the washer door open</div>
          <p className="text-sm text-slate-300">
            All loads are done. Leave the washer door (and detergent drawer) open so it dries out
            and doesn't grow mold.
          </p>
          <Button
            variant="success"
            className="mt-3 w-full py-3 text-base"
            onClick={() => update((s) => void (s.doorOpenAcknowledged = true))}
          >
            Done, door is open 🎉
          </Button>
        </Card>
      )}
    </div>
  );
}
