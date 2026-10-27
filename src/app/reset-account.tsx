import { Redirect } from 'expo-router';

import { inDemo } from '@/backend';
import { ResetAccount } from '@/screens/account-danger';

export default function ResetAccountRoute() {
  // Settings hides this in the demo; this also covers opening the URL directly on the website.
  if (inDemo) return <Redirect href="/" />;
  return <ResetAccount />;
}
