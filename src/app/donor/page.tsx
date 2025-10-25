'use client';

import Link from 'next/link';
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from '@/components/ui/button';
import { PlusCircle, Info, MessageSquare } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

// --- Main Donor Page Component ---
export default function DonorPage() {
  const [donations, setDonations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { toast } = useToast();
  const [openingChat, setOpeningChat] = useState<string | null>(null);

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

  useEffect(() => {
    let notificationChannel: any = null;
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const uid = data?.user?.id;
        if (!uid) return;

        notificationChannel = supabase
          .channel(`public:notifications:user_id=eq.${uid}`)
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` },
            async (payload: any) => {
              const n = payload.new;
              // show toast with preview and link to conversation
              toast({
                title: 'New message',
                description: n?.preview ?? 'New message received',
                // optional click behavior: navigate to chat
              });
              // optionally you can navigate automatically: router.push(`/chat/${n.conversation_id}`)
            }
          )
          .subscribe();
      } catch (e) {
        // ignore
      }
    })();

    return () => {
      if (notificationChannel) supabase.removeChannel(notificationChannel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openChat = async (donationId: string) => {
    if (openingChat) return;
    setOpeningChat(donationId);

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        toast({ title: 'Sign in required', description: 'Please sign in to use chat.' });
        return;
      }

      // Look for existing conversation
      const { data: existing } = await supabase
        .from('conversations')
        .select('id')
        .eq('donation_id', donationId)
        .maybeSingle();

      if (existing?.id) {
        router.push(`/chat/${existing.id}`);
        return;
      }

      // Create new conversation
      const { data: created, error: createError } = await supabase
        .from('conversations')
        .insert({
          donation_id: donationId,
          donor_id: userData.user.id
        })
        .select()
        .single();

      if (createError) {
        toast({ title: 'Chat Error', description: 'Unable to start chat.' });
        return;
      }

      router.push(`/chat/${created.id}`);
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to open chat.' });
    } finally {
      setOpeningChat(null);
    }
  };

  return (
    <div className="container py-8">
      <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
        <div>
            <h1 className="text-3xl font-bold tracking-tight">Your Donations</h1>
            <p className="text-muted-foreground">Manage your food donations and see their status.</p>
        </div>
        <Button asChild size="lg">
          <Link href="/donor/donate" aria-label="Donate Food">
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
            <div key={donation.id} className="border rounded-lg p-4 bg-card shadow-sm flex flex-col justify-between">
              <div>
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
              {donation.taken && (
                <div className="mt-4 flex flex-col gap-2">
                  <Button 
                    onClick={() => openChat(donation.id)}
                    disabled={openingChat === donation.id}
                    aria-label={openingChat === donation.id ? `Opening chat for ${donation.id}` : `Open chat for ${donation.food_name ?? donation.id}`}
                  >
                    <MessageSquare className="mr-2 h-4 w-4" />
                    {openingChat === donation.id ? 'Opening Chat...' : 'Chat'}
                  </Button>

                  {/* Restored Complete button as requested */}
                  <Button variant="secondary" aria-label={`Mark donation ${donation.id} as complete`}>Complete</Button>
                </div>
              )}
            </div>
                    ))}
                  </div>
                )}
              </div>
            );
          }