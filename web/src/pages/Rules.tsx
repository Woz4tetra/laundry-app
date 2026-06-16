import { useEffect, useState } from 'react';
import { useStore } from '../lib/store';
import { api } from '../lib/api';
import { Button, Card, Header } from '../components/ui';
import { enableNotifications, notificationsActive, pushSupported } from '../lib/push';
import type { Category, GlobalSettings, Machine, PrepRule } from '../lib/types';

export function Rules() {
  const { config, reloadConfig } = useStore();
  const [settings, setSettings] = useState<GlobalSettings | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [prep, setPrep] = useState<PrepRule[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [saved, setSaved] = useState(false);
  const [notif, setNotif] = useState(false);

  useEffect(() => {
    if (config) {
      setSettings(structuredClone(config.settings));
      setCategories(structuredClone(config.categories));
      setPrep(structuredClone(config.prepRules));
      setMachines(structuredClone(config.machines));
    }
  }, [config]);
  useEffect(() => {
    notificationsActive().then(setNotif);
  }, []);

  if (!settings) return null;

  const save = async () => {
    await api.putConfig({ settings, categories, prepRules: prep, machines });
    await reloadConfig();
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const patchCat = (id: string, patch: Partial<Category>) =>
    setCategories((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  return (
    <div className="pb-4">
      <Header title="Rules" />
      <p className="mb-4 text-slate-400">Tweak the recipe as you learn. Changes apply next load.</p>

      {/* Notifications */}
      {pushSupported() && (
        <Card className="mb-4">
          <div className="flex items-center justify-between">
            <span>🔔 Notifications</span>
            {notif ? (
              <span className="text-emerald-400">On</span>
            ) : (
              <button
                className="text-sky-400 underline"
                onClick={async () => setNotif((await enableNotifications()).ok)}
              >
                Enable
              </button>
            )}
          </div>
        </Card>
      )}

      {/* Quiet hours + global */}
      <Section title="Quiet hours & global">
        <Toggle
          label="Quiet hours (bedtime guard)"
          checked={settings.quietHours.enabled}
          onChange={(v) =>
            setSettings({ ...settings, quietHours: { ...settings.quietHours, enabled: v } })
          }
        />
        <div className="flex items-center gap-3">
          <TimeField
            label="From"
            value={settings.quietHours.start}
            onChange={(v) =>
              setSettings({ ...settings, quietHours: { ...settings.quietHours, start: v } })
            }
          />
          <TimeField
            label="To"
            value={settings.quietHours.end}
            onChange={(v) =>
              setSettings({ ...settings, quietHours: { ...settings.quietHours, end: v } })
            }
          />
        </div>
        <Toggle
          label="Always extra rinse"
          checked={settings.extraRinseAlways}
          onChange={(v) => setSettings({ ...settings, extraRinseAlways: v })}
        />
        <Toggle
          label="Vinegar in softener tray"
          checked={settings.vinegarInSoftenerTray}
          onChange={(v) => setSettings({ ...settings, vinegarInSoftenerTray: v })}
        />
        <Toggle
          label="Leave washer door open after"
          checked={settings.leaveDoorOpenAfter}
          onChange={(v) => setSettings({ ...settings, leaveDoorOpenAfter: v })}
        />
        <Toggle
          label="Empty lint trap before drying"
          checked={settings.emptyLintTrapBeforeDry}
          onChange={(v) => setSettings({ ...settings, emptyLintTrapBeforeDry: v })}
        />
        <NumField
          label="Default wash minutes"
          value={settings.defaultWashMinutes}
          onChange={(v) => setSettings({ ...settings, defaultWashMinutes: v })}
        />
        <NumField
          label="Default dry minutes"
          value={settings.defaultDryMinutes}
          onChange={(v) => setSettings({ ...settings, defaultDryMinutes: v })}
        />
      </Section>

      {/* Categories */}
      <Section title="Categories">
        {categories.map((c) => (
          <div key={c.id} className="rounded-2xl bg-slate-900/60 p-3">
            <div className="mb-2 font-semibold">
              {c.icon} {c.name}
            </div>
            {!c.routeToService && (
              <div className="grid grid-cols-2 gap-2 text-sm">
                <label className="flex flex-col gap-1">
                  <span className="text-slate-400">Wash temp (1-5)</span>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={c.washTemp ?? ''}
                    onChange={(e) =>
                      patchCat(c.id, { washTemp: e.target.value ? Number(e.target.value) : null })
                    }
                    className="rounded-lg bg-slate-700 px-2 py-2"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-slate-400">Dry method</span>
                  <select
                    value={c.dryMethod}
                    onChange={(e) => patchCat(c.id, { dryMethod: e.target.value as any })}
                    className="rounded-lg bg-slate-700 px-2 py-2"
                  >
                    {['machine', 'hang', 'rack', 'none'].map((m) => (
                      <option key={m}>{m}</option>
                    ))}
                  </select>
                </label>
                {c.dryMethod === 'machine' && (
                  <>
                    <label className="flex flex-col gap-1">
                      <span className="text-slate-400">Dry heat</span>
                      <select
                        value={c.dryDefault?.heat ?? 'Low'}
                        onChange={(e) =>
                          patchCat(c.id, {
                            dryDefault: { heat: e.target.value, minutes: c.dryDefault?.minutes ?? 60 },
                          })
                        }
                        className="rounded-lg bg-slate-700 px-2 py-2"
                      >
                        {['Cool', 'Low', 'Medium', 'High'].map((h) => (
                          <option key={h}>{h}</option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-slate-400">Dry minutes</span>
                      <input
                        type="number"
                        value={c.dryDefault?.minutes ?? 60}
                        onChange={(e) =>
                          patchCat(c.id, {
                            dryDefault: { heat: c.dryDefault?.heat ?? 'Low', minutes: Number(e.target.value) },
                          })
                        }
                        className="rounded-lg bg-slate-700 px-2 py-2"
                      />
                    </label>
                  </>
                )}
              </div>
            )}
            {c.routeToService && <div className="text-sm text-slate-400">→ cleaning service</div>}
          </div>
        ))}
      </Section>

      {/* Prep rules */}
      <Section title="Prep reminders">
        {prep.map((r, i) => (
          <div key={r.id} className="flex items-center gap-2">
            <input
              value={r.text}
              onChange={(e) =>
                setPrep((p) => p.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))
              }
              className="flex-1 rounded-lg bg-slate-700 px-3 py-2 text-sm"
            />
            <button
              className="text-rose-400"
              onClick={() => setPrep((p) => p.filter((_, j) => j !== i))}
            >
              ✕
            </button>
          </div>
        ))}
        <Button
          variant="ghost"
          className="w-full py-2 text-sm"
          onClick={() =>
            setPrep((p) => [
              ...p,
              { id: `rule_${p.length + 1}_${Date.now()}`, text: 'New reminder', icon: '📝', appliesTo: categories.filter((c) => !c.routeToService).map((c) => c.id) },
            ])
          }
        >
          + Add reminder (applies to all loads)
        </Button>
      </Section>

      {/* Machines */}
      <Section title="Machines">
        {machines.map((m, mi) => (
          <div key={m.id} className="rounded-2xl bg-slate-900/60 p-3">
            <div className="mb-2 flex items-center gap-2">
              <span className="font-semibold capitalize">{m.id}</span>
              <input
                value={m.model}
                onChange={(e) =>
                  setMachines((ms) => ms.map((x, j) => (j === mi ? { ...x, model: e.target.value } : x)))
                }
                className="flex-1 rounded-lg bg-slate-700 px-3 py-1 text-sm"
              />
            </div>
            <details>
              <summary className="cursor-pointer text-sm text-slate-400">Edit step text</summary>
              <div className="mt-2 space-y-2">
                {m.steps.map((s, si) => (
                  <input
                    key={s.id}
                    value={s.instruction}
                    onChange={(e) =>
                      setMachines((ms) =>
                        ms.map((x, j) =>
                          j === mi
                            ? {
                                ...x,
                                steps: x.steps.map((y, k) =>
                                  k === si ? { ...y, instruction: e.target.value } : y,
                                ),
                              }
                            : x,
                        ),
                      )
                    }
                    className="w-full rounded-lg bg-slate-700 px-2 py-2 text-xs"
                  />
                ))}
              </div>
            </details>
          </div>
        ))}
      </Section>

      <div className="sticky bottom-24 mt-6">
        <Button className="w-full" onClick={save}>
          {saved ? 'Saved ✓' : 'Save changes'}
        </Button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="mb-4">
      <div className="mb-3 text-lg font-semibold">{title}</div>
      <div className="space-y-3">{children}</div>
    </Card>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between"
    >
      <span>{label}</span>
      <span
        className={`flex h-7 w-12 items-center rounded-full p-1 transition ${
          checked ? 'bg-emerald-500' : 'bg-slate-600'
        }`}
      >
        <span
          className={`h-5 w-5 rounded-full bg-white transition ${checked ? 'translate-x-5' : ''}`}
        />
      </span>
    </button>
  );
}

function TimeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-1 flex-col gap-1 text-sm">
      <span className="text-slate-400">{label}</span>
      <input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg bg-slate-700 px-3 py-2"
      />
    </label>
  );
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex items-center justify-between text-sm">
      <span>{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-24 rounded-lg bg-slate-700 px-3 py-2"
      />
    </label>
  );
}
