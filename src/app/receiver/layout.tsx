// ReceiverLayout.tsx
import { Header } from '@/components/header';
import { DonationsProvider } from '@/context/DonationsContext';

export default function ReceiverLayout({ children }: { children: React.ReactNode }) {
  return (
    <DonationsProvider>
      <div className="relative flex min-h-screen flex-col">
        <Header userType="Receiver" />
        <main className="flex-1">{children}</main>
      </div>
    </DonationsProvider>
  );
}
