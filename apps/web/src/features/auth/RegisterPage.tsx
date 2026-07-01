import { useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError, register } from './api';
import { SESSION_QUERY_KEY } from './useSession';

const CONFLICT_STATUS = 409;

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const user = await register({ email, username, password, displayName });
      queryClient.setQueryData(SESSION_QUERY_KEY, user);
      navigate('/', { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === CONFLICT_STATUS) {
        setError(err.message);
      } else if (err instanceof ApiError && err.status === 400) {
        setError('Please check your registration details and try again');
      } else {
        setError('Something went wrong — please try again');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-4 px-4 py-8 sm:max-w-md">
      <h2 className="text-lg font-semibold">Register</h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>
        <label htmlFor="register-email" className="flex flex-col gap-1 text-sm">
          Email
          <input
            id="register-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded border border-slate-300 px-3 py-2"
            required
          />
        </label>
        <label htmlFor="register-username" className="flex flex-col gap-1 text-sm">
          Username
          <input
            id="register-username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="rounded border border-slate-300 px-3 py-2"
            required
          />
        </label>
        <label htmlFor="register-display-name" className="flex flex-col gap-1 text-sm">
          Display name
          <input
            id="register-display-name"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="rounded border border-slate-300 px-3 py-2"
            required
          />
        </label>
        <label htmlFor="register-password" className="flex flex-col gap-1 text-sm">
          Password
          <input
            id="register-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded border border-slate-300 px-3 py-2"
            required
            minLength={8}
          />
        </label>
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50"
        >
          Create account
        </button>
      </form>
      <p className="text-sm text-slate-600">
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </div>
  );
}
