import { Redirect } from 'expo-router';

import { useSession } from '@/auth/session-store';
import { sessionRoute } from '@/navigation/session-route';

/** The entry URL ("/"): go to the screen the session status belongs on. */
export default function Index() {
  const status = useSession((s) => s.status);
  const role = useSession((s) => s.user?.role);
  const target = sessionRoute(status, role);
  return target ? <Redirect href={target} /> : null;
}
