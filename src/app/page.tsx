'use client';

import React from 'react';
import Link from 'next/link';
import { useDonations } from '@/context/DonationsContext';
import { DonationCard } from '@/components/donation-card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Info, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserTypeSelection } from '@/components/user-type-selection';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <UserTypeSelection />
    </main>
  );
}
