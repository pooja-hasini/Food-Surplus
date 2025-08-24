import Link from 'next/link';
import { HandHeart } from 'lucide-react';

interface HeaderProps {
  userType: 'Donor' | 'Receiver';
}

export function Header({ userType }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur-sm">
      <div className="container flex h-16 items-center space-x-4 sm:justify-between sm:space-x-0">
        <Link href="/" className="flex items-center gap-2 text-xl font-bold text-primary-foreground">
          <HandHeart className="h-7 w-7 text-primary" />
          FoodBridge
        </Link>
        <div className="flex flex-1 items-center justify-end space-x-4">
          <nav className="flex items-center space-x-6 text-sm font-medium">
            <span className="font-semibold text-muted-foreground">{userType} View</span>
            <Link href="/" className="transition-colors hover:text-primary">
              Switch Role
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
