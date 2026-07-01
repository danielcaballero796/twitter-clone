import { APP_NAME, type HealthStatus } from '@twitterclone/shared';

const shellStatus: HealthStatus = { status: 'ok' };

export default function App() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white px-4 py-3">
        <h1 className="text-xl font-bold">{APP_NAME}</h1>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-8">
        <p className="text-slate-600">
          App shell ready — status: <span data-testid="shell-status">{shellStatus.status}</span>
        </p>
      </main>
    </div>
  );
}
