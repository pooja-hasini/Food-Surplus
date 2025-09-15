'use client';

import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useCallback } from 'react';
import type { Donation } from '@/lib/types';

// Mock data for initial state
const initialDonations: Donation[] = [
  {
    id: '1',
    foodName: 'Fresh Apples',
    expiryTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
    quantity: 10,
  location: 'Greenwood Park, 1520',
  latitude: 12.9716,
  longitude: 77.5946,
    photoUrl: 'https://placehold.co/600x400.png',
    tags: ['fruit', 'fresh', 'healthy'],
    status: 'pending',
    donorId: 'donor1',
  },
  {
    id: '2',
    foodName: 'Homemade Bread Loaves',
    expiryTime: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // 1 day from now
    quantity: 5,
  location: 'Sunnyvale Community Center',
  latitude: 12.9352,
  longitude: 77.6245,
    photoUrl: 'https://placehold.co/600x400.png',
    tags: ['bakery', 'homemade', 'carbs'],
    status: 'pending',
    donorId: 'donor1',
  },
    {
    id: '3',
    foodName: 'Canned Vegetable Soup',
    expiryTime: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 1 month from now
    quantity: 20,
  location: 'Maple Street Food Bank',
  latitude: 12.9279,
  longitude: 77.6271,
    photoUrl: 'https://placehold.co/600x400.png',
    tags: ['canned', 'soup', 'non-perishable'],
    status: 'taken',
    donorId: 'donor1',
  },
];


interface DonationsContextType {
  donations: Donation[];
  addDonation: (donation: Omit<Donation, 'id' | 'status' | 'donorId'>) => void;
  updateDonationStatus: (id: string, status: 'taken') => void;
  getDonationById: (id: string) => Donation | undefined;
}

const DonationsContext = createContext<DonationsContextType | undefined>(undefined);

export const DonationsProvider = ({ children }: { children: ReactNode }) => {
  const [donations, setDonations] = useState<Donation[]>(initialDonations);

  const addDonation = useCallback((donation: Omit<Donation, 'id' | 'status' | 'donorId'>) => {
    const newDonation: Donation = {
      ...donation,
      id: (donations.length + 1).toString(),
      status: 'pending',
      donorId: 'donor1', // Mocked donor ID
    };
    setDonations(prev => [newDonation, ...prev]);
  }, [donations.length]);

  const updateDonationStatus = useCallback((id: string, status: 'taken') => {
    setDonations(prev =>
      prev.map(d => (d.id === id ? { ...d, status } : d))
    );
  }, []);

  const getDonationById = useCallback((id: string) => {
    return donations.find(d => d.id === id);
  }, [donations]);

  return (
    <DonationsContext.Provider value={{ donations, addDonation, updateDonationStatus, getDonationById }}>
      {children}
    </DonationsContext.Provider>
  );
};

export const useDonations = () => {
  const context = useContext(DonationsContext);
  if (context === undefined) {
    throw new Error('useDonations must be used within a DonationsProvider');
  }
  return context;
};
