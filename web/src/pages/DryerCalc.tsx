import { useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import { api } from '../lib/api';
import { Button, Card, Header } from '../components/ui';

type Dampness = 'very_damp' | 'damp' | 'almost_dry';
type Weight = 'light' | 'medium' | 'heavy';

const DAMP_ADJ: Record<Dampness, number> = { very_damp: 20, damp: 0, almost_dry: -20 };
const WEIGHT_ADJ: Record<Weight, number> = { heavy: 15, medium: 0, light: -10 };
const HEATS = ['Cool', 'Low', 'Medium', 'High'];

export function DryerCalc() {
  const { config, reloadConfig } = useStore();
  const machineCats = useMemo(
    () => (config ? config.categories.filter((c) => c.dryMethod === 'machine') : []),
    [config],
  );
  const [catId, setCatId] = useState<string>('');
  const [heat, setHeat] = useState('Low');
  const [baseMinutes, setBaseMinutes] = useState(60);
  const [damp, setDamp] = useState<Dampness>('damp');
  const [weight, setWeight] = useState<Weight>('medium');

  if (!config) return null;

  const pickCat = (id: string) => {
    setCatId(id);
    const cat = config.categories.find((c) => c.id === id);
    const memo = config.dryerMemory[id];
    setHeat(memo?.heat ?? cat?.dryDefault?.heat ?? 'Low');
    setBaseMinutes(memo?.minutes ?? cat?.dryDefault?.minutes ?? 60);
  };

  const minutes = Math.max(20, Math.round((baseMinutes + DAMP_ADJ[damp] + WEIGHT_ADJ[weight]) / 5) * 5);

  return (
    <div>
      <Header title="Dryer Calculator" />
      <p className="mb-4 text-slate-400">
        The dryer's auto mode is unreliable. Dial in a manual time and heat here.
      </p>

      <Card className="space-y-4">
        <div>
          <div className="mb-1 text-sm text-slate-400">Start from a load type</div>
          <select
            className="w-full rounded-xl bg-slate-700 px-3 py-3"
            value={catId}
            onChange={(e) => pickCat(e.target.value)}
          >
            <option value="">Custom</option>
            {machineCats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon} {c.name}
              </option>
            ))}
          </select>
        </div>

        <Group label="Heat">
          {HEATS.map((h) => (
            <Choice key={h} active={heat === h} onClick={() => setHeat(h)}>
              {h}
            </Choice>
          ))}
        </Group>

        <div>
          <div className="mb-1 text-sm text-slate-400">Base minutes</div>
          <div className="flex items-center gap-3">
            <button className="h-11 w-11 rounded-xl bg-slate-700 text-2xl" onClick={() => setBaseMinutes((m) => Math.max(10, m - 5))}>−</button>
            <span className="w-12 text-center text-xl font-bold">{baseMinutes}</span>
            <button className="h-11 w-11 rounded-xl bg-slate-700 text-2xl" onClick={() => setBaseMinutes((m) => m + 5)}>+</button>
          </div>
        </div>

        <Group label="How damp?">
          <Choice active={damp === 'very_damp'} onClick={() => setDamp('very_damp')}>Very damp</Choice>
          <Choice active={damp === 'damp'} onClick={() => setDamp('damp')}>Damp</Choice>
          <Choice active={damp === 'almost_dry'} onClick={() => setDamp('almost_dry')}>Almost dry</Choice>
        </Group>

        <Group label="Fabric weight">
          <Choice active={weight === 'light'} onClick={() => setWeight('light')}>Light</Choice>
          <Choice active={weight === 'medium'} onClick={() => setWeight('medium')}>Medium</Choice>
          <Choice active={weight === 'heavy'} onClick={() => setWeight('heavy')}>Heavy</Choice>
        </Group>
      </Card>

      <Card className="mt-4 text-center">
        <div className="text-sm text-slate-400">Recommended</div>
        <div className="my-2 text-4xl font-bold">
          {heat} · {minutes} min
        </div>
        <div className="text-xs text-slate-500">
          base {baseMinutes} {fmtAdj(DAMP_ADJ[damp])} {fmtAdj(WEIGHT_ADJ[weight])} → {minutes}
        </div>
        {catId && (
          <Button
            variant="ghost"
            className="mt-4 w-full py-3 text-base"
            onClick={async () => {
              await api.saveDryerMemory(catId, heat, minutes);
              await reloadConfig();
            }}
          >
            Remember for {config.categories.find((c) => c.id === catId)?.name}
          </Button>
        )}
      </Card>
    </div>
  );
}

const fmtAdj = (n: number) => (n === 0 ? '' : n > 0 ? `+${n}` : `${n}`);

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-sm text-slate-400">{label}</div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Choice({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm font-medium ring-1 ${
        active ? 'bg-sky-500 text-white ring-sky-400' : 'bg-slate-800 ring-white/10'
      }`}
    >
      {children}
    </button>
  );
}
