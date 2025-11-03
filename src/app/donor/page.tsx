'use client';

import Link from 'next/link';
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from '@/components/ui/button';
import { PlusCircle, Info, MessageSquare } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

export default function DonorPage() {
  const [donations, setDonations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [openingChat, setOpeningChat] = useState<string | null>(null);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [convMap, setConvMap] = useState<Record<string, string>>({});
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;
      if (!user) {
        setDonations([]);
        setLoading(false);
        return;
      }

      // 1️⃣ Fetch donations
      const { data: donationsData, error: donationsError } = await supabase
        .from("food_listings")
        .select("*")
        .eq("donor_id", user.id)
        .order("created_at", { ascending: false });
      if (donationsError) console.error(donationsError);

      setDonations(donationsData || []);

      // 2️⃣ Fetch all conversations for this donor’s donations
      const { data: convs } = await supabase
        .from("conversations")
        .select("id, donation_id")
        .eq("donor_id", user.id);

      const map: Record<string, string> = {};
      convs?.forEach((c) => {
        map[c.donation_id] = c.id;
      });
      setConvMap(map);

      // 3️⃣ Fetch unread notifications count grouped by conversation
      const { data: notifs } = await supabase
        .from("notifications")
        .select("conversation_id")
        .eq("user_id", user.id)
        .eq("read", false);

      const counts: Record<string, number> = {};
      notifs?.forEach((n) => {
        counts[n.conversation_id] = (counts[n.conversation_id] || 0) + 1;
      });
      setUnreadCounts(counts);

      setLoading(false);
    };

    fetchData();
  }, []);

  // 🔁 Realtime subscription for new notifications
  useEffect(() => {
  let channel: any = null;
  (async () => {
    const { data } = await supabase.auth.getUser();
    const uid = data?.user?.id;
    if (!uid) return;

    channel = supabase
      .channel(`notifications:user_id=eq.${uid}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` },
        async (payload: any) => {
          const n = payload.new;
          const current = (await supabase.auth.getUser()).data.user?.id;

          // 🚫 Ignore notifications caused by my own message
          if (n.sender_id && n.sender_id === current) return;

          // ✅ Show toast only for messages sent by the other user
          toast({
            title: 'New message',
            description: n?.message ?? 'New message received',
          });

          // 🔢 Update unread count (optional if you have badge logic)
          setUnreadCounts(prev => ({
            ...prev,
            [n.conversation_id]: (prev[n.conversation_id] || 0) + 1,
          }));
        }
      )
      .subscribe();
  })();

  return () => {
    if (channel) supabase.removeChannel(channel);
  };
}, [toast]);

  // 🗨️ Open chat
  const openChat = async (donationId: string) => {
    if (openingChat) return;
    setOpeningChat(donationId);

    try {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;
      if (!user) {
        toast({ title: 'Sign in required', description: 'Please sign in to use chat.' });
        return;
      }

      let convId = convMap[donationId];

      if (!convId) {
        // create conversation if not exists
        const { data: created, error: createError } = await supabase
          .from('conversations')
          .insert({
            donation_id: donationId,
            donor_id: user.id,
          })
          .select()
          .single();

        if (createError || !created) {
          toast({ title: 'Chat Error', description: 'Unable to start chat.' });
          setOpeningChat(null);
          return;
        }

        convId = created.id;
        setConvMap((prev) => ({ ...prev, [donationId]: created.id }));
      }

      // mark notifications as read for that conversation
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('conversation_id', convId)
        .eq('user_id', user.id);

      // reset local unread count
      setUnreadCounts((prev) => {
        const updated = { ...prev };
        delete updated[convId];
        return updated;
      });

      router.push(`/chat/${convId}`);
    } catch (err) {
      console.error(err);
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
          {donations.map((donation) => {
            const convId = convMap[donation.id];
            const unreadCount = convId ? unreadCounts[convId] || 0 : 0;
            return (
              <div
                key={donation.id}
                className="border rounded-lg p-4 bg-card shadow-sm flex flex-col justify-between"
              >
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
                      <span className="font-semibold">Expiry Date:</span>{' '}
                      {new Date(donation.expiry_date).toLocaleDateString()}
                    </p>
                  )}
                  {donation.location && (
                    <p>
                      <span className="font-semibold">Location:</span> {donation.location}
                    </p>
                  )}
                  {donation.photo_url && (
                    <img src={donation.photo_url} alt="Food" className="my-2 max-h-40 rounded" />
                  )}
                  <p className="mt-2 text-sm">
                    Status:{' '}
                    <span className={donation.taken ? 'text-red-600' : 'text-yellow-600'}>
                      {donation.taken ? 'Taken' : 'Pending'}
                    </span>
                  </p>
                </div>

                {donation.taken && (
                  <div className="mt-4 flex flex-col gap-2 relative">
                    <Button
                      onClick={() => openChat(donation.id)}
                      disabled={openingChat === donation.id}
                      className="relative"
                    >
                      <MessageSquare className="mr-2 h-4 w-4" />
                      {openingChat === donation.id ? 'Opening Chat...' : 'Chat'}
                      {unreadCount > 0 && (
                        <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs rounded-full px-2 py-0.5">
                          {unreadCount}
                        </span>
                      )}
                    </Button>

                    {/* Complete button removed for donors - receivers mark completion */}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
