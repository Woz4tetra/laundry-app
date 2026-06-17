import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../lib/store';
import { Button, Card, Pill } from '../components/ui';
import { Countdown } from '../components/Countdown';
import { MachineGuide } from '../components/MachineGuide';
import { computeDry, computeWash, prepRulesForLoad } from '../lib/engine';
import { evaluateSchedule, fmtTime } from '../lib/schedule';
import { celebrate } from '../lib/effects';
import { api } from '../lib/api';
import type { FillLevel, Load, LoadStatus, Machine } from '../lib/types';

type Sub = 'prep' | 'load' | 'wash' | 'dry' | 'done';

function subFor(status: LoadStatus, hasPrep: boolean): Sub {
  switch (status) {
    case 'ready_to_wash':
    case 'washing':
      return 'wash';
    case 'wash_done':
    case 'drying':
      return 'dry';
    case 'dry_done':
    case 'done':
      return 'done';
    default:
      return hasPrep ? 'prep' : 'load';
  }
}

const STAGE_ORDER: Sub[] = ['prep', 'load', 'wash', 'dry', 'done'];
// Status a load returns to when you rewind to the start of a given stage.
const ENTRY_STATUS: Record<Sub, LoadStatus> = {
  prep: 'prepping',
  load: 'prepping',
  wash: 'ready_to_wash',
  dry: 'wash_done',
  done: 'done',
};

function CheckRow({
  checked,
  onToggle,
  icon,
  children,
}: {
  checked: boolean;
  onToggle: () => void;
  icon?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onToggle}
      className="flex w-full items-center gap-3 rounded-2xl bg-slate-800/70 p-4 text-left active:scale-[0.99]"
    >
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 ${
          checked ? 'border-emerald-400 bg-emerald-400 text-slate-900' : 'border-slate-500'
        }`}
      >
        {checked ? '✓' : ''}
      </span>
      {icon && <span className="text-xl">{icon}</span>}
      <span className={checked ? 'text-slate-400 line-through' : ''}>{children}</span>
    </button>
  );
}

const DET = (m: 1 | 2) => `up to mark ${m}`;
const minutesLabel = (m: number) => (m >= 55 ? '60 min' : m >= 35 ? '40' : '20');

export function RunLoad() {
  const { loadId } = useParams();
  const nav = useNavigate();
  const { session, config, update, updateLoad } = useStore();

  const load = session?.loads.find((l) => l.id === loadId);
  const prepItems = useMemo(
    () => (load && config ? prepRulesForLoad(load, config.prepRules) : []),
    [load, config],
  );
  const [sub, setSub] = useState<Sub>(() =>
    load ? subFor(load.status, prepItems.length > 0) : 'prep',
  );

  if (!session || !config || !load) {
    return (
      <div className="p-6">
        <p className="text-slate-400">Load not found.</p>
        <Button className="mt-4" onClick={() => nav('/overview')}>
          Back to loads
        </Button>
      </div>
    );
  }

  const byId = new Map(config.categories.map((c) => [c.id, c]));
  const primary = byId.get(load.categoryIds[0])!;
  const washer = config.machines.find((m) => m.id === 'washer') as Machine | undefined;
  const dryer = config.machines.find((m) => m.id === 'dryer') as Machine | undefined;

  const fill = (load.wash?.fill ?? 'half') as FillLevel;
  const wash = computeWash(load, config.categories, config.settings, fill, washer?.tempScale);
  const dry = computeDry(load, config.categories);

  const toggle = (key: string) =>
    updateLoad(load.id, (l) => void (l.checked[key] = !l.checked[key]));
  const setStatus = (status: LoadStatus, extra?: (l: Load) => void) =>
    updateLoad(load.id, (l) => {
      l.status = status;
      extra?.(l);
    });

  // Rewind to the start of an earlier stage: drop any running/scheduled timer
  // and reset status so the target stage renders fresh.
  const goToStage = (target: Sub) => {
    updateLoad(load.id, (l) => {
      delete l.timer;
      l.status = ENTRY_STATUS[target];
    });
    setSub(target);
  };

  // Back out of a running or scheduled timer without leaving the current stage.
  const cancelTimer = (status: LoadStatus) =>
    updateLoad(load.id, (l) => {
      delete l.timer;
      l.status = status;
    });

  const prepDone = prepItems.every((r) => load.checked[r.id]);

  // --- bedtime / quiet-hours check for wash (+ dry if machine) ---
  const totalMinutes =
    config.settings.defaultWashMinutes +
    (dry.method === 'machine' ? dry.minutes ?? config.settings.defaultDryMinutes : 0);
  const schedule = evaluateSchedule(Date.now(), totalMinutes, config.settings.quietHours);

  const startWash = () =>
    setStatus('washing', (l) => {
      l.wash = { fill };
      l.timer = {
        kind: 'wash',
        endsAt: Date.now() + config.settings.defaultWashMinutes * 60_000,
        notified: false,
      };
    });

  const scheduleWash = (startMs: number) =>
    updateLoad(load.id, (l) => {
      l.wash = { fill };
      l.timer = { kind: 'delayed_start', endsAt: startMs, startsPhase: 'wash', notified: false };
    });

  // --- dry settings (machine) with inline adjuster ---
  const memo = config.dryerMemory[primary.id];
  const [dryHeat, setDryHeat] = useState(load.dry?.heat ?? memo?.heat ?? dry.heat ?? 'Low');
  const [dryMin, setDryMin] = useState(load.dry?.minutes ?? memo?.minutes ?? dry.minutes ?? 60);

  const startDry = () => {
    setStatus('drying', (l) => {
      l.dry = { heat: dryHeat, minutes: dryMin };
      l.timer = { kind: 'dry', endsAt: Date.now() + dryMin * 60_000, notified: false };
    });
    api.saveDryerMemory(primary.id, dryHeat, dryMin).catch(() => {});
  };

  const finish = () => {
    setStatus('done');
    celebrate();
    setSub('done');
  };

  const Stepper = () => {
    const visible = STAGE_ORDER.filter((s) => s !== 'prep' || prepItems.length > 0);
    const curIdx = STAGE_ORDER.indexOf(sub);
    return (
      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-slate-400">
        {visible.map((s) => {
          const back = STAGE_ORDER.indexOf(s) < curIdx;
          return (
            <button
              key={s}
              type="button"
              disabled={!back}
              onClick={() => goToStage(s)}
              className={`rounded-full px-2 py-1 capitalize transition ${
                s === sub
                  ? 'bg-sky-500/20 text-sky-300'
                  : back
                    ? 'bg-slate-800 text-slate-300 active:scale-95'
                    : 'bg-slate-800/50 text-slate-600'
              }`}
            >
              {s}
            </button>
          );
        })}
        {curIdx > 0 && <span className="text-[10px] text-slate-500">← tap a step to go back</span>}
      </div>
    );
  };

  return (
    <div className="safe-top px-1">
      <div className="mb-3 flex items-center justify-between">
        <button className="text-slate-400" onClick={() => nav('/overview')}>
          ← Loads
        </button>
        <span className="text-lg font-bold">
          {primary.icon} {load.label}
        </span>
        <span className="w-12" />
      </div>
      <Stepper />

      {/* PREP */}
      {sub === 'prep' && (
        <div className="space-y-3">
          <h2 className="text-xl font-semibold">Prep this load</h2>
          <p className="text-slate-400">Check each one off as you do it.</p>
          {prepItems.map((r) => (
            <CheckRow
              key={r.id}
              icon={r.icon}
              checked={!!load.checked[r.id]}
              onToggle={() => toggle(r.id)}
            >
              {r.text}
            </CheckRow>
          ))}
          <Button className="w-full" disabled={!prepDone} onClick={() => setSub('load')}>
            {prepDone ? 'Next: load the drum →' : 'Check everything to continue'}
          </Button>
        </div>
      )}

      {/* LOAD + 3/4 GATE */}
      {sub === 'load' && (
        <div className="space-y-3">
          <h2 className="text-xl font-semibold">Load the drum</h2>
          <Card>
            <p className="mb-3 text-slate-300">How full is the drum?</p>
            <div className="grid grid-cols-3 gap-2">
              {(['small', 'half', 'full'] as FillLevel[]).map((f) => (
                <button
                  key={f}
                  onClick={() => updateLoad(load.id, (l) => void (l.wash = { fill: f }))}
                  className={`rounded-2xl py-4 text-base font-semibold capitalize ring-1 ${
                    fill === f ? 'bg-sky-500 text-white ring-sky-400' : 'bg-slate-800 ring-white/10'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
            <p className="mt-3 text-sm text-slate-400">
              Detergent will be {DET(wash.detergentMark)}.
            </p>
          </Card>
          <CheckRow checked={!!load.checked.fill_ok} onToggle={() => toggle('fill_ok')} icon="📏">
            Drum is no more than 3/4 full
          </CheckRow>
          <Button
            className="w-full"
            disabled={!load.checked.fill_ok}
            onClick={() => setSub('wash')}
          >
            Next: wash settings →
          </Button>
        </div>
      )}

      {/* WASH */}
      {sub === 'wash' && (
        <div className="space-y-3">
          <h2 className="text-xl font-semibold">Wash settings</h2>

          <Card>
            <div className="grid grid-cols-2 gap-3">
              <Setting label="Temperature" value={wash.tempLabel} hint={`level ${wash.tempLevel}`} />
              <Setting label="Detergent" value={DET(wash.detergentMark)} />
              <Setting label="Extra rinse" value={wash.extraRinse ? 'ON' : 'off'} />
              <Setting label="Vinegar" value={wash.vinegar ? 'Yes' : 'No'} hint="softener tray" />
            </div>
            <p className="mt-3 text-sm text-slate-400">{wash.vinegarNote}.</p>
          </Card>

          {load.status === 'washing' && load.timer ? (
            <Card className="text-center">
              <div className="text-sm text-slate-400">Washing…</div>
              <div className="my-2 text-4xl font-bold">
                <Countdown endsAt={load.timer.endsAt} />
              </div>
              <p className="mb-3 text-sm text-slate-400">
                📲 With notifications on, your phone alerts you when the wash is done. You can close
                the app.
              </p>
              <Button variant="success" className="w-full" onClick={() => { setStatus('wash_done'); setSub('dry'); }}>
                Wash is done →
              </Button>
              <button
                className="mt-2 w-full text-sm text-slate-400 underline"
                onClick={() => cancelTimer('ready_to_wash')}
              >
                ← Cancel & edit wash settings
              </button>
            </Card>
          ) : load.timer?.kind === 'delayed_start' ? (
            <Card className="ring-amber-500/40">
              <div className="font-semibold">⏰ Scheduled to start {fmtTime(load.timer.endsAt)}</div>
              <p className="mt-2 text-sm text-slate-300">
                The app starts this wash automatically at {fmtTime(load.timer.endsAt)}, so set the
                washer's <b>Delay Wash</b> to about{' '}
                <b>{Math.max(1, Math.round((load.timer.endsAt - Date.now()) / 3_600_000))} hr</b> and
                press <b>Start</b> so the machine runs at the same time.
              </p>
              <p className="mt-2 text-sm text-slate-400">
                📲 No need to come back: the wash countdown begins on its own. With notifications on,
                we'll ping you when it starts. (Wash finishes about{' '}
                {fmtTime(load.timer.endsAt + totalMinutes * 60000)}.)
              </p>
              <Button className="mt-3 w-full" onClick={startWash}>
                Start now instead
              </Button>
              <button
                className="mt-2 w-full text-sm text-slate-400 underline"
                onClick={() => cancelTimer('ready_to_wash')}
              >
                ← Back to wash settings (and cancel timer)
              </button>
            </Card>
          ) : (
            <>
              {washer && <MachineGuide machine={washer} litLeds={{ tempLeds: wash.tempLabel }} />}

              {schedule.conflict && schedule.suggestedStartMs && (
                <Card className="ring-amber-500/40">
                  <div className="font-semibold">🌙 Bedtime check</div>
                  <p className="mt-1 text-sm text-slate-300">
                    Starting now finishes around {fmtTime(schedule.finishMs)}, during quiet hours.
                    Use the delay timer below to start at {fmtTime(schedule.suggestedStartMs)} and
                    finish by {fmtTime(schedule.suggestedFinishMs!)}.
                  </p>
                </Card>
              )}

              <DelayTimer
                durationMin={config.settings.defaultWashMinutes}
                defaultHours={
                  schedule.conflict && schedule.suggestedStartMs
                    ? Math.max(1, Math.round((schedule.suggestedStartMs - Date.now()) / 3_600_000))
                    : 0
                }
                onSchedule={scheduleWash}
              />

              <Button variant="success" className="w-full" onClick={startWash}>
                ▶ Start wash now
              </Button>
            </>
          )}
        </div>
      )}

      {/* DRY */}
      {sub === 'dry' && (
        <div className="space-y-3">
          <h2 className="text-xl font-semibold">Dry</h2>

          {dry.method !== 'machine' ? (
            <>
              <Card className="text-center">
                <div className="text-5xl">{dry.method === 'hang' ? '🪝' : '🧺'}</div>
                <p className="mt-3 text-slate-200">{dry.instruction}</p>
              </Card>
              <Button variant="success" className="w-full" onClick={finish}>
                Done 🎉
              </Button>
            </>
          ) : load.status === 'drying' && load.timer ? (
            <Card className="text-center">
              <div className="text-sm text-slate-400">Drying on {load.dry?.heat}…</div>
              <div className="my-2 text-4xl font-bold">
                <Countdown endsAt={load.timer.endsAt} />
              </div>
              <Button variant="success" className="w-full" onClick={finish}>
                Dry is done 🎉
              </Button>
              <button
                className="mt-2 w-full text-sm text-slate-400 underline"
                onClick={() => cancelTimer('wash_done')}
              >
                ← Back to dryer settings
              </button>
            </Card>
          ) : (
            <>
              <CheckRow checked={!!load.checked.lint_ok} onToggle={() => toggle('lint_ok')} icon="🧹">
                Lint trap emptied
              </CheckRow>

              <Card>
                <div className="mb-2 font-semibold">Recommended: {dry.instruction}</div>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs text-slate-400">Heat</div>
                    <select
                      className="mt-1 rounded-xl bg-slate-700 px-3 py-2"
                      value={dryHeat}
                      onChange={(e) => setDryHeat(e.target.value)}
                    >
                      {['Cool', 'Low', 'Medium', 'High'].map((h) => (
                        <option key={h}>{h}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">Minutes</div>
                    <div className="mt-1 flex items-center gap-2">
                      <button
                        className="h-10 w-10 rounded-xl bg-slate-700 text-xl"
                        onClick={() => setDryMin((m) => Math.max(20, m - 5))}
                      >
                        −
                      </button>
                      <span className="w-10 text-center text-lg font-bold">{dryMin}</span>
                      <button
                        className="h-10 w-10 rounded-xl bg-slate-700 text-xl"
                        onClick={() => setDryMin((m) => m + 5)}
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <button
                    className="self-end text-sm text-sky-400 underline"
                    onClick={() => nav('/dryer')}
                  >
                    calculator
                  </button>
                </div>
              </Card>

              {dryer && (
                <MachineGuide
                  machine={dryer}
                  litLeds={{ tempLeds: dryHeat, timeLeds: minutesLabel(dryMin) }}
                />
              )}

              <Button
                variant="success"
                className="w-full"
                disabled={!load.checked.lint_ok}
                onClick={startDry}
              >
                ▶ Start dryer ({dryMin} min)
              </Button>
            </>
          )}
        </div>
      )}

      {/* DONE */}
      {sub === 'done' && (
        <div className="space-y-4 text-center">
          <div className="text-7xl">🎉</div>
          <h2 className="text-2xl font-bold">{load.label} done!</h2>
          <Pill tone="emerald">Folded glory awaits</Pill>
          <Button className="w-full" onClick={() => nav('/overview')}>
            Back to loads
          </Button>
        </div>
      )}
    </div>
  );
}

function Setting({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl bg-slate-900/60 p-3">
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className="text-xl font-bold">{value}</div>
      {hint && <div className="text-xs text-slate-500">{hint}</div>}
    </div>
  );
}

/**
 * Pick how many hours from now the wash should begin. The hour count is the
 * number to dial into the washer's Delay Wash; the card shows the resulting
 * start/finish clock times and the steps to set it.
 */
function DelayTimer({
  durationMin,
  defaultHours,
  onSchedule,
}: {
  durationMin: number;
  defaultHours: number;
  onSchedule: (startMs: number) => void;
}) {
  const [hours, setHours] = useState(defaultHours);
  const startMs = Date.now() + hours * 3_600_000;
  const finishMs = startMs + durationMin * 60_000;

  return (
    <Card>
      <div className="font-semibold">⏲ Delay start</div>
      <p className="mt-1 text-sm text-slate-400">
        Set how many hours from now the wash should begin.
      </p>

      <div className="mt-3 flex items-center justify-center gap-4">
        <button
          className="h-12 w-12 rounded-xl bg-slate-700 text-2xl disabled:opacity-40"
          disabled={hours <= 0}
          onClick={() => setHours((h) => Math.max(0, h - 1))}
          aria-label="fewer hours"
        >
          −
        </button>
        <div className="w-24 text-center">
          <div className="text-4xl font-bold">{hours}</div>
          <div className="text-xs text-slate-400">{hours === 1 ? 'hour' : 'hours'}</div>
        </div>
        <button
          className="h-12 w-12 rounded-xl bg-slate-700 text-2xl disabled:opacity-40"
          disabled={hours >= 24}
          onClick={() => setHours((h) => Math.min(24, h + 1))}
          aria-label="more hours"
        >
          +
        </button>
      </div>

      <div className="mt-3 rounded-xl bg-slate-900/60 p-3 text-sm text-slate-300">
        {hours === 0
          ? `Starts now, done about ${fmtTime(finishMs)}.`
          : `Starts about ${fmtTime(startMs)}, done about ${fmtTime(finishMs)}.`}
      </div>

      {hours > 0 && (
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-slate-300">
          <li>
            On the washer, press <b>Delay Wash</b> and set it to{' '}
            <b>
              {hours} {hours === 1 ? 'hour' : 'hours'}
            </b>
            .
          </li>
          <li>
            Press <b>Start</b> so the delay timer begins.
          </li>
        </ol>
      )}

      <Button className="mt-3 w-full" disabled={hours === 0} onClick={() => onSchedule(startMs)}>
        {hours === 0 ? 'Pick hours to schedule' : `Schedule for ${fmtTime(startMs)}`}
      </Button>
    </Card>
  );
}
