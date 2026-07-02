import { useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { login } from './api';
import { SESSION_QUERY_KEY } from './useSession';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const user = await login({ email, password });
      queryClient.setQueryData(SESSION_QUERY_KEY, user);
      navigate('/', { replace: true });
    } catch {
      // Generic message for any failure — avoids user enumeration on the frontend too.
      setError('Invalid email or password');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-4 px-4 py-8">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-100">Log in</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>
          <label
            htmlFor="login-email"
            className="flex flex-col gap-1 text-sm text-slate-700 dark:text-slate-300"
          >
            Email
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus-visible:ring-offset-slate-950"
              required
            />
          </label>
          <label
            htmlFor="login-password"
            className="flex flex-col gap-1 text-sm text-slate-700 dark:text-slate-300"
          >
            Password
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus-visible:ring-offset-slate-950"
              required
            />
          </label>
          {error && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="min-h-11 cursor-pointer rounded bg-indigo-600 px-4 py-2 text-white transition-colors duration-200 hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-400 dark:focus-visible:ring-offset-slate-950"
          >
            Log in
          </button>
        </form>
      </div>
      <p className="text-center text-sm text-slate-600 dark:text-slate-400">
        No account?{' '}
        <Link
          to="/register"
          className="cursor-pointer font-medium text-indigo-600 transition-colors duration-200 hover:underline dark:text-indigo-400"
        >
          Register
        </Link>
      </p>
    </div>
  );
}
