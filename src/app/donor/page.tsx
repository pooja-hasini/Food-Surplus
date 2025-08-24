'use client';

import Link from 'next/link';
import { useDonations } from '@/context/DonationsContext';
import { Button } from '@/components/ui/button';
import { DonationCard } from '@/components/donation-card';
import { PlusCircle, Info } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function DonorPage() {
  const { donations } = useDonations();
  const donorDonations = donations.filter(d => d.donorId === 'donor1'); // Mocked donor ID

  return (
    <div className="container py-8">
      <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
        <div>
            <h1 className="text-3xl font-bold tracking-tight">Your Donations</h1>
            <p className="text-muted-foreground">Manage your food donations and see their status.</p>
        </div>
        <Button asChild size="lg">
          <Link href="/donor/donate">
            <PlusCircle className="mr-2 h-5 w-5" />
            Donate Food
          </Link>
        </Button>
      </div>

      {donorDonations.length === 0 ? (
         <div className="mt-8 flex justify-center">
            <Alert className="max-w-md">
                <Info className="h-4 w-4" />
                <AlertTitle>No Donations Yet</AlertTitle>
                <AlertDescription>
                    You haven't made any donations. Click "Donate Food" to get started!
                </AlertDescription>
            </Alert>
         </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {donorDonations.map(donation => (
            <DonationCard key={donation.id} donation={donation} />
          ))}
        </div>
      )}
    </div>
  );
}
