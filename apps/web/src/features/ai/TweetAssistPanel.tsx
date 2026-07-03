import { useState } from 'react';
import { MIN_ASSIST_LENGTH, type TweetAssistAction } from '@twitterclone/shared';
import { ArrowPathIcon, SparklesIcon } from '../../components/icons';
import { ApiError } from '../../lib/api';
import { useTweetAssist } from './useTweetAssist';

/** Friendly, case-specific copy: not configured / quota exhausted / everything else. */
function assistErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 503) {
      return 'AI assistance is not available on this server right now.';
    }
    if (error.status === 429) {
      return 'The AI assistant used up its free quota — please try again in a few minutes.';
    }
  }
  return 'Could not generate a suggestion. Please try again.';
}

const ACTIONS: Array<{ action: TweetAssistAction; label: string }> = [
  { action: 'improve', label: 'Improve' },
  { action: 'shorten', label: 'Shorten' },
  { action: 'fix-grammar', label: 'Fix grammar' },
  { action: 'more-engaging', label: 'More engaging' },
];

interface TweetAssistPanelProps {
  draft: string;
  onReplace: (text: string) => void;
  onInsert: (text: string) => void;
}

/**
 * On-demand AI assistance for the composer (never fires while typing). Owns its
 * own mutation; the composer only provides the draft and receives text back.
 */
export default function TweetAssistPanel({ draft, onReplace, onInsert }: TweetAssistPanelProps) {
  const assist = useTweetAssist();
  const [lastAction, setLastAction] = useState<TweetAssistAction | null>(null);

  const trimmed = draft.trim();
  const tooShort = trimmed.length < MIN_ASSIST_LENGTH;

  function run(action: TweetAssistAction) {
    setLastAction(action);
    assist.mutate({ text: trimmed, action });
  }

  const actionButtonClass =
    'flex min-h-9 cursor-pointer items-center gap-1 rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 transition-colors duration-200 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800';

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <SparklesIcon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
        {ACTIONS.map(({ action, label }) => (
          <button
            key={action}
            type="button"
            disabled={tooShort || assist.isPending}
            onClick={() => run(action)}
            title={tooShort ? `Write at least ${MIN_ASSIST_LENGTH} characters first` : undefined}
            className={actionButtonClass}
          >
            {label}
          </button>
        ))}
      </div>

      {assist.isPending && (
        <p
          data-testid="assist-loading"
          role="status"
          className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400"
        >
          <ArrowPathIcon className="h-4 w-4 motion-safe:animate-spin" />
          Generating suggestion…
        </p>
      )}

      {assist.isError && !assist.isPending && (
        <p
          data-testid="assist-error"
          role="alert"
          className="text-sm text-red-600 dark:text-red-400"
        >
          {assistErrorMessage(assist.error)}
        </p>
      )}

      {assist.data && !assist.isPending && (
        <div
          data-testid="assist-suggestion"
          className="flex flex-col gap-2 rounded-lg border border-indigo-200 bg-indigo-50 p-3 dark:border-indigo-900 dark:bg-indigo-950/40"
        >
          <p className="text-[15px] text-slate-900 dark:text-slate-100">{assist.data.suggestion}</p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onReplace(assist.data.suggestion);
                assist.reset();
              }}
              className={actionButtonClass}
            >
              Use suggestion
            </button>
            <button
              type="button"
              onClick={() => {
                onInsert(assist.data.suggestion);
                assist.reset();
              }}
              className={actionButtonClass}
            >
              Insert
            </button>
            <button
              type="button"
              disabled={lastAction === null}
              onClick={() => lastAction && run(lastAction)}
              className={actionButtonClass}
            >
              Regenerate
            </button>
            <button type="button" onClick={() => assist.reset()} className={actionButtonClass}>
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
