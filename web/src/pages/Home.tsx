import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store';
import { Button, Card, Header, ProgressBar } from '../components/ui';
import { enableNotifications, notificationsActive, pushSupported } from '../lib/push';

function sessionProgress(loads: { status: string }[]): number {
  if (!loads.length) return 0;
  const done = loads.filter((l) => l.status === 'done').length;
  return done / loads.length;
}

export function Home() {
  const { session, newSession } = useStore();
  const nav = useNavigate();
  const [notif, setNotif] = useState(false);

  useEffect(() => {
    notificationsActive().then(setNotif);
  }, []);

  const start = async () => {
    await newSession();
    nav('/sort');
  };

  const resumeTo =
    session?.step === 'sort' ? '/sort' : session?.step === 'build' ? '/build' : '/overview';

  return (
    <div>
      <Header title="Laundry" />

      <div className="my-6 text-center">
        <div className="text-7xl">🧺</div>
        <p className="mt-2 text-slate-400">Your interactive laundry recipe</p>
      </div>

      {session ? (
        <Card className="mb-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-semibold">In progress</span>
            <span className="text-sm text-slate-400">
              {session.loads.filter((l) => l.status === 'done').length}/{session.loads.length} loads
            </span>
          </div>
          <ProgressBar value={sessionProgress(session.loads)} />
          <Button className="mt-4 w-full" onClick={() => nav(resumeTo)}>
            Resume
          </Button>
          <Button variant="ghost" className="mt-2 w-full py-3 text-base" onClick={start}>
            Start a new session
          </Button>
        </Card>
      ) : (
        <Button className="w-full" onClick={start}>
          Start laundry
        </Button>
      )}

      {pushSupported() && !notif && (
        <Card className="mt-4">
          <p className="mb-3 text-slate-300">
            🔔 Turn on notifications to get pinged when a wash or dry finishes.
          </p>
          <Button
            variant="ghost"
            className="w-full py-3 text-base"
            onClick={async () => {
              const r = await enableNotifications();
              setNotif(r.ok);
              if (!r.ok && r.reason === 'server-disabled')
                alert('Push is not configured on the server (set VAPID keys).');
            }}
          >
            Enable notifications
          </Button>
        </Card>
      )}
    </div>
  );
}
