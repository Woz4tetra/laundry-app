import { useState } from 'react';
import { api } from '../lib/api';
import { useStore } from '../lib/store';
import { Button } from '../components/ui';

export function Login() {
  const { setAuthed } = useStore();
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.login(passcode);
      setAuthed(true);
    } catch {
      setError('Wrong passcode, try again.');
      setPasscode('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full flex-col items-center justify-center px-8">
      <div className="mb-8 text-center">
        <div className="text-7xl">🧺</div>
        <h1 className="mt-4 text-3xl font-bold">Laundry Recipe</h1>
        <p className="mt-1 text-slate-400">Enter the family passcode</p>
      </div>
      <form onSubmit={submit} className="w-full max-w-xs space-y-4">
        <input
          type="password"
          inputMode="text"
          autoFocus
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          placeholder="Passcode"
          className="w-full rounded-2xl bg-slate-800 px-5 py-4 text-center text-xl outline-none ring-1 ring-white/10 focus:ring-sky-500"
        />
        {error && <p className="text-center text-rose-400">{error}</p>}
        <Button type="submit" className="w-full" disabled={busy || !passcode}>
          {busy ? 'Checking…' : 'Enter'}
        </Button>
      </form>
    </div>
  );
}
