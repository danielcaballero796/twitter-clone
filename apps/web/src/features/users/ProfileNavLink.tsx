import { NavLink } from 'react-router-dom';
import { navLinkClassName } from '../../components/nav-link';
import { useSession } from '../auth/useSession';

/** Header link to the session user's own profile — the only nav entry that needs a session. */
export default function ProfileNavLink() {
  const { user } = useSession();

  if (!user) {
    return null;
  }

  return (
    <NavLink to={`/u/${user.username}`} className={navLinkClassName}>
      Profile
    </NavLink>
  );
}
