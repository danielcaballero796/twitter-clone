import { type FormEvent, useState } from 'react';
import { AVATAR_STYLES, type AvatarStyle, type UserProfile } from '@twitterclone/shared';
import { ArrowPathIcon } from '../../components/icons';
import { useUpdateProfile } from './useUpdateProfile';

const MAX_NAME_LENGTH = 50;
const MAX_BIO_LENGTH = 160;

function previewUrlFor(username: string, style: AvatarStyle): string {
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(username)}`;
}

interface EditProfileFormProps {
  profile: UserProfile;
  onClose: () => void;
}

export default function EditProfileForm({ profile, onClose }: EditProfileFormProps) {
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [bio, setBio] = useState(profile.bio ?? '');
  const [avatarStyle, setAvatarStyle] = useState<AvatarStyle>(profile.avatarStyle);
  const updateProfile = useUpdateProfile();

  const trimmedName = displayName.trim();
  const nameInvalid = trimmedName.length === 0 || trimmedName.length > MAX_NAME_LENGTH;
  const bioInvalid = bio.length > MAX_BIO_LENGTH;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (nameInvalid || bioInvalid) {
      return;
    }
    updateProfile.mutate({ displayName: trimmedName, bio, avatarStyle }, { onSuccess: onClose });
  }

  return (
    <form
      data-testid="edit-profile-form"
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 border-t border-slate-200 pt-3 dark:border-slate-800"
    >
      <div className="flex flex-col gap-1">
        <label
          htmlFor="edit-profile-name"
          className="text-sm font-semibold text-slate-700 dark:text-slate-300"
        >
          Name
        </label>
        <input
          id="edit-profile-name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={MAX_NAME_LENGTH}
          aria-invalid={nameInvalid}
          aria-describedby={nameInvalid ? 'edit-profile-name-error' : undefined}
          className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-[15px] text-slate-900 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
        {nameInvalid && (
          <p
            id="edit-profile-name-error"
            role="alert"
            className="text-xs text-red-600 dark:text-red-400"
          >
            Name must be between 1 and {MAX_NAME_LENGTH} characters.
          </p>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <label
          htmlFor="edit-profile-bio"
          className="text-sm font-semibold text-slate-700 dark:text-slate-300"
        >
          Bio
        </label>
        <textarea
          id="edit-profile-bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={MAX_BIO_LENGTH}
          rows={3}
          placeholder="Tell the flock about yourself"
          aria-invalid={bioInvalid}
          aria-describedby={bioInvalid ? 'edit-profile-bio-error' : undefined}
          className="w-full resize-none rounded border border-slate-300 bg-white px-3 py-2 text-[15px] text-slate-900 transition-colors duration-200 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
        />
        <span className="self-end text-xs tabular-nums text-slate-600 dark:text-slate-400">
          {MAX_BIO_LENGTH - bio.length}
        </span>
        {bioInvalid && (
          <p
            id="edit-profile-bio-error"
            role="alert"
            className="text-xs text-red-600 dark:text-red-400"
          >
            Bio must be {MAX_BIO_LENGTH} characters or fewer.
          </p>
        )}
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-semibold text-slate-700 dark:text-slate-300">Avatar</legend>
        <div className="flex flex-wrap gap-2">
          {AVATAR_STYLES.map((style) => (
            <label
              key={style}
              className={`cursor-pointer rounded-full p-1 transition-colors duration-200 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:ring-offset-2 dark:focus-within:ring-offset-slate-950 ${
                avatarStyle === style
                  ? 'ring-2 ring-indigo-600 dark:ring-indigo-400'
                  : 'ring-1 ring-slate-200 hover:ring-slate-400 dark:ring-slate-700 dark:hover:ring-slate-500'
              }`}
            >
              <input
                type="radio"
                name="avatar-style"
                value={style}
                checked={avatarStyle === style}
                onChange={() => setAvatarStyle(style)}
                className="sr-only"
              />
              <img
                src={previewUrlFor(profile.username, style)}
                alt={`${style} avatar`}
                className="h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-800"
              />
            </label>
          ))}
        </div>
      </fieldset>
      {updateProfile.isError && (
        <p id="edit-profile-error" role="alert" className="text-xs text-red-600 dark:text-red-400">
          Could not update your profile. Please try again.
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 cursor-pointer rounded-full border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition-colors duration-200 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:focus-visible:ring-offset-slate-950"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={nameInvalid || bioInvalid || updateProfile.isPending}
          className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full bg-indigo-600 px-4 text-sm font-semibold text-white transition-colors duration-200 hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-400 dark:focus-visible:ring-offset-slate-950"
        >
          {updateProfile.isPending && (
            <ArrowPathIcon className="h-4 w-4 motion-safe:animate-spin" />
          )}
          Save
        </button>
      </div>
    </form>
  );
}
