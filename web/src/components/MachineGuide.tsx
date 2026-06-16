import { useState } from 'react';
import type { Machine, PanelControl } from '../lib/types';
import { Button } from './ui';

const ACCENT = '#38bdf8';

function Control({
  c,
  active,
  litLabel,
}: {
  c: PanelControl;
  active: boolean;
  litLabel?: string;
}) {
  const stroke = active ? ACCENT : '#475569';
  const strokeWidth = active ? 4 : 2;
  const glow = active ? 'drop-shadow(0 0 8px rgba(56,189,248,0.8))' : 'none';

  if (c.type === 'logo') {
    return (
      <text x={c.x} y={c.y + c.h * 0.7} fill="#94a3b8" fontSize={26} fontWeight={700}>
        {c.label}
      </text>
    );
  }

  if (c.type === 'dial') {
    const cx = c.x + c.w / 2;
    const cy = c.y + c.h / 2;
    const r = c.w / 2;
    return (
      <g style={{ filter: glow }}>
        <circle cx={cx} cy={cy} r={r} fill="#1e293b" stroke={stroke} strokeWidth={strokeWidth} />
        <circle cx={cx} cy={cy} r={r * 0.6} fill="#334155" stroke={stroke} strokeWidth={1} />
        <line x1={cx} y1={cy} x2={cx} y2={c.y + 6} stroke={stroke} strokeWidth={4} />
      </g>
    );
  }

  if (c.type === 'display') {
    return (
      <g style={{ filter: glow }}>
        <rect
          x={c.x}
          y={c.y}
          width={c.w}
          height={c.h}
          rx={6}
          fill="#020617"
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
        <text
          x={c.x + c.w / 2}
          y={c.y + c.h * 0.72}
          fill="#22d3ee"
          fontSize={28}
          fontFamily="monospace"
          textAnchor="middle"
        >
          {c.label}
        </text>
      </g>
    );
  }

  if (c.type === 'button') {
    return (
      <g style={{ filter: glow }}>
        <rect
          x={c.x}
          y={c.y}
          width={c.w}
          height={c.h}
          rx={Math.min(c.h / 2, 16)}
          fill={active ? 'rgba(56,189,248,0.18)' : '#1e293b'}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
        <text
          x={c.x + c.w / 2}
          y={c.y + c.h * 0.66}
          fill={active ? '#e0f2fe' : '#cbd5e1'}
          fontSize={16}
          fontWeight={600}
          textAnchor="middle"
        >
          {c.label}
        </text>
      </g>
    );
  }

  if (c.type === 'ledGroup') {
    const rows = c.labels ?? [];
    const rowH = (c.h - 26) / Math.max(rows.length, 1);
    return (
      <g style={{ filter: glow }}>
        <rect
          x={c.x}
          y={c.y}
          width={c.w}
          height={c.h}
          rx={10}
          fill="#0b1220"
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
        {c.label && (
          <text x={c.x + c.w / 2} y={c.y + c.h - 8} fill="#94a3b8" fontSize={13} textAnchor="middle">
            {c.label}
          </text>
        )}
        {rows.map((label, i) => {
          const lit = active && litLabel === label;
          const cy = c.y + 16 + i * rowH;
          return (
            <g key={label}>
              <circle cx={c.x + 14} cy={cy} r={5} fill={lit ? ACCENT : '#334155'} />
              <text
                x={c.x + 26}
                y={cy + 4}
                fill={lit ? '#e0f2fe' : '#94a3b8'}
                fontSize={14}
                fontWeight={lit ? 700 : 400}
              >
                {label}
              </text>
            </g>
          );
        })}
      </g>
    );
  }

  // text (cycle labels)
  const rows = c.labels ?? [];
  const rowH = c.h / Math.max(rows.length, 1);
  return (
    <g style={{ filter: glow }}>
      {rows.map((label, i) => (
        <text
          key={label}
          x={c.x}
          y={c.y + i * rowH + rowH * 0.6}
          fill={active ? '#e0f2fe' : '#94a3b8'}
          fontSize={15}
          fontWeight={active ? 700 : 400}
        >
          {label}
        </text>
      ))}
    </g>
  );
}

/**
 * Renders a stylized SVG of the machine control panel and walks the user
 * through each operating step, highlighting the relevant controls. `litLeds`
 * lights a specific row inside an LED group (e.g. the chosen temperature).
 */
export function MachineGuide({
  machine,
  litLeds = {},
}: {
  machine: Machine;
  litLeds?: Record<string, string>;
}) {
  const [step, setStep] = useState(0);
  const current = machine.steps[step];
  const hi = new Set(current?.highlight ?? []);

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-2xl bg-slate-900 p-2 ring-1 ring-white/10">
        <svg
          viewBox={`0 0 ${machine.panel.width} ${machine.panel.height}`}
          className="h-auto w-full"
          role="img"
          aria-label={`${machine.name} control panel`}
        >
          <rect
            x={4}
            y={4}
            width={machine.panel.width - 8}
            height={machine.panel.height - 8}
            rx={18}
            fill="#0f172a"
            stroke="#1e293b"
            strokeWidth={2}
          />
          {machine.panel.controls.map((c) => (
            <Control key={c.id} c={c} active={hi.has(c.id)} litLabel={litLeds[c.id]} />
          ))}
        </svg>
      </div>

      <div className="rounded-2xl bg-slate-800/70 p-4">
        <div className="mb-1 flex items-center gap-2 text-sm text-sky-300">
          <span className="font-mono">
            {step + 1}/{machine.steps.length}
          </span>
          <span className="font-semibold">{current?.title}</span>
        </div>
        <p className="text-slate-200">{current?.instruction}</p>
        <div className="mt-3 flex gap-2">
          <Button
            variant="ghost"
            className="flex-1 py-3 text-base"
            disabled={step === 0}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
          >
            ← Back
          </Button>
          <Button
            variant="ghost"
            className="flex-1 py-3 text-base"
            disabled={step >= machine.steps.length - 1}
            onClick={() => setStep((s) => Math.min(machine.steps.length - 1, s + 1))}
          >
            Next →
          </Button>
        </div>
      </div>
    </div>
  );
}
