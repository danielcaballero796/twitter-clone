import { NavLink } from 'react-router-dom';
import { BellIcon } from '../../components/icons';
import { navLinkClassName } from '../../components/nav-link';
import { useSession } from '../auth/useSession';
import { useUnreadCount } from './useUnreadCount';

function UnreadBadge() {
  const { data } = useUnreadCount();
  const count = data?.count ?? 0;

  if (count === 0) {
    return null;
  }

  return (
    <span
      data-testid="unread-badge"
      className="inline-flex min-w-5 items-center justify-center rounded-full bg-indigo-600 px-1.5 text-xs font-semibold text-white dark:bg-indigo-500"
    >
      {count}
      <span className="sr-only"> unread notifications</span>
    </span>
  );
}

/** Header link to the notifications page — badge shows the unread count while a session exists. */
export default function NotificationsNavLink() {
  const { user } = useSession();

  if (!user) {
    return null;
  }

  return (
    <NavLink to="/notifications" className={navLinkClassName}>
      <BellIcon />
      <span className="sr-only sm:not-sr-only">Notifications</span>
      <UnreadBadge />
    </NavLink>
  );
}
