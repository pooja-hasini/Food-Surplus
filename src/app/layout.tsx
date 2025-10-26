import type { Metadata } from 'next';
import { PT_Sans } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';
import { cn } from '@/lib/utils';
import NotificationListenerClient from '@/components/NotificationListenerClient';

const ptSans = PT_Sans({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-sans',
});

export const metadata: Metadata = {
  title: 'FoodBridge',
  description: 'Connecting surplus food with those in need.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn('min-h-screen bg-background font-sans antialiased', ptSans.variable)}>
        <Providers>{children}</Providers>
        {/* Client-side listener mounted via client wrapper */}
        <NotificationListenerClient />
      </body>
    </html>
  );
}
