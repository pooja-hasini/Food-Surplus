'use client';

import Link from 'next/link';
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from '@/components/ui/button';
import { PlusCircle, Info } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function DonorPage() {
  const [donations, setDonations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDonations = async () => {
      setLoading(true);
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) {
        setDonations([]);
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("food_listings")
        .select("*")
        .eq("donor_id", user.id)
        .order("created_at", { ascending: false });
      setDonations(data || []);
      setLoading(false);
    };
    fetchDonations();
  }, []);

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

      {loading ? (
        <div className="mt-8 text-center">Loading...</div>
      ) : donations.length === 0 ? (
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
          {donations.map(donation => (
            <div key={donation.id} className="border rounded-lg p-4 bg-card shadow-sm">

              <h3 className="font-bold text-lg">{donation.food_name || donation.title}</h3>
              <p>{donation.description}</p>
              {donation.quantity && (
                <p>
                  <span className="font-semibold">Quantity:</span> {donation.quantity}
                </p>
              )}
              {donation.expiry_date && (
                <p>
                  <span className="font-semibold">Expiry Date:</span> {new Date(donation.expiry_date).toLocaleDateString()}
                </p>
              )}
              {donation.location && (
                <p>
                  <span className="font-semibold">Location:</span> {donation.location}
                </p>
              )}
              {donation.photo_url && (
                <img
                  src={donation.photo_url}
                  alt="Food"
                  className="my-2 max-h-40 rounded"
                />
              )}
              <p className="mt-2 text-sm">
                Status:{" "}
                <span className={donation.taken ? "text-red-600" : "text-yellow-600"}>
                  {donation.taken ? "Taken" : "Pending"}
                </span>
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}