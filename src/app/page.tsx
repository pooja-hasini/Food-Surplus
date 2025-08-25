import { UserTypeSelection } from '@/components/user-type-selection';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <UserTypeSelection />
    </main>
  );
}