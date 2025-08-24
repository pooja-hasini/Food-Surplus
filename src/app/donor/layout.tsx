import { Header } from '@/components/header';

export default function DonorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen flex-col">
      <Header userType="Donor" />
      <main className="flex-1">{children}</main>
    </div>
  );
}
