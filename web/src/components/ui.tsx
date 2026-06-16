import type { ButtonHTMLAttributes, ReactNode } from 'react';

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'success' | 'danger';
}) {
  const base =
    'rounded-2xl px-5 py-4 text-lg font-semibold transition active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100';
  const variants = {
    primary: 'bg-sky-500 text-white shadow-lg shadow-sky-500/20',
    ghost: 'bg-slate-800 text-slate-100',
    success: 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20',
    danger: 'bg-rose-600 text-white',
  };
  return <button className={`${base} ${variants[variant]} ${className}`} {...props} />;
}

export function Card({
  children,
  className = '',
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`rounded-3xl bg-slate-800/70 p-5 ring-1 ring-white/5 ${className}`}
    >
      {children}
    </div>
  );
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-700">
      <div
        className="h-full rounded-full bg-gradient-to-r from-sky-400 to-emerald-400 transition-all"
        style={{ width: `${Math.round(value * 100)}%` }}
      />
    </div>
  );
}

export function Pill({ children, tone = 'slate' }: { children: ReactNode; tone?: string }) {
  const tones: Record<string, string> = {
    slate: 'bg-slate-700 text-slate-200',
    sky: 'bg-sky-500/20 text-sky-300',
    amber: 'bg-amber-500/20 text-amber-300',
    emerald: 'bg-emerald-500/20 text-emerald-300',
    rose: 'bg-rose-500/20 text-rose-300',
  };
  return (
    <span className={`inline-block rounded-full px-3 py-1 text-sm font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function Header({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <div className="safe-top mb-4 flex items-center justify-between gap-3">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      {right}
    </div>
  );
}
