import { useIsDesktop } from '@/components/dock';
import { DesktopTransactions } from '@/desktop/transactions';
import { TransactionList } from '@/screens/transactions';

export default function TransactionsRoute() {
  return useIsDesktop() ? <DesktopTransactions /> : <TransactionList />;
}
