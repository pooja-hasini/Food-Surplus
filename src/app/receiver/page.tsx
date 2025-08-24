'use client';

import Link from 'next/link';
import { useDonations } from '@/context/DonationsContext';
import { DonationCard } from '@/components/donation-card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Info, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function ReceiverPage() {
  const { donations } = useDonations();
  const availableDonations = donations.filter(d => d.status === 'pending');

  return (
    <div className="container py-8">
      <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
         <div>
            <h1 className="text-3xl font-bold tracking-tight">Available Donations</h1>
            <p className="text-muted-foreground">Find food donations available in your area.</p>
        </div>
      </div>
      
      <Alert className="mt-4">
        <MapPin className="h-4 w-4"/>
        <AlertTitle>Location Information</AlertTitle>
        <AlertDescription>
          Showing all available donations. In a full app, this would be filtered to your location.
        </AlertDescription>
      </Alert>

      {availableDonations.length === 0 ? (
         <div className="mt-8 flex justify-center text-center">
            <Alert className="max-w-md">
                <Info className="h-4 w-4" />
                <AlertTitle>No Donations Available</AlertTitle>
                <AlertDescription>
                    There are currently no available donations. Please check back later!
                </AlertDescription>
            </Alert>
         </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <AnimatePresence>
                {availableDonations.map((donation, index) => (
                    <motion.div
                        key={donation.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.3, delay: index * 0.05 }}
                    >
                        <Link href={`/receiver/${donation.id}`}>
                            <DonationCard donation={donation} />
                        </Link>
                    </motion.div>
                ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
