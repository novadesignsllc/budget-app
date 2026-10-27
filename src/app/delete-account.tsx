import { Redirect } from 'expo-router';

import { inDemo } from '@/backend';
import { DeleteAccount } from '@/screens/account-danger';

export default function DeleteAccountRoute() {
  // Settings hides this in the demo; this also covers opening the URL directly on the website.
  if (inDemo) return <Redirect href="/" />;
  return <DeleteAccount />;
}
