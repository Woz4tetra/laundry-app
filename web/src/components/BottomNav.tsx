import { NavLink } from 'react-router-dom';

const tabs = [
  { to: '/', label: 'Home', icon: '🏠' },
  { to: '/overview', label: 'Loads', icon: '🧺' },
  { to: '/dryer', label: 'Dryer', icon: '🔥' },
  { to: '/rules', label: 'Rules', icon: '⚙️' },
];

export function BottomNav() {
  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 mx-auto max-w-xl border-t border-white/10 bg-slate-900/95 px-2 pt-2 backdrop-blur">
      <div className="flex justify-around">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.to === '/'}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-0.5 rounded-xl py-2 text-xs ${
                isActive ? 'text-sky-400' : 'text-slate-400'
              }`
            }
          >
            <span className="text-xl">{t.icon}</span>
            {t.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
