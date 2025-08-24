'use client';

import { DonationsProvider } from '@/context/DonationsContext';
import { Toaster } from '@/components/ui/toaster';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <DonationsProvider>
      {children}
      <Toaster />
    </DonationsProvider>
  );
}
