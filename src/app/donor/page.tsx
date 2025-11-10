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
  const [convStatusByDonation, setConvStatusByDonation] = useState<Record<string, any>>({});
  const [systemNotifications, setSystemNotifications] = useState<Array<{id: string; message: string; donationId?: string}>>([]);
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

      // 2️⃣ Fetch all conversations for this donor’s donations (include completion flags)
      const { data: convs } = await supabase
        .from("conversations")
        .select("id, donation_id, donor_complete, receiver_complete")
        .eq("donor_id", user.id);

      const map: Record<string, string> = {};
      const statusMap: Record<string, any> = {};
      convs?.forEach((c: any) => {
        map[c.donation_id] = c.id;
        statusMap[c.donation_id] = c;
      });
      setConvMap(map);
      setConvStatusByDonation(statusMap);

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

  // Keep user on donor home when pressing browser Back while on this page.
  // This traps the back button to stay on /donor as requested.
  useEffect(() => {
    const handlePop = () => {
      try {
        if (typeof window !== 'undefined' && window.location.pathname === '/donor') {
          // re-push the same state so the user stays on this page
          window.history.pushState(null, '', window.location.href);
        }
      } catch (e) {
        // ignore
      }
    };

    if (typeof window !== 'undefined') {
      // ensure there's a history entry we can re-push
      window.history.pushState(null, '', window.location.href);
      window.addEventListener('popstate', handlePop);
    }

    return () => {
      if (typeof window !== 'undefined') window.removeEventListener('popstate', handlePop);
    };
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

          // Only update unread counts here. Global NotificationListener shows the toast with message content.
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

  // subscribe to conversation updates so donor UI reflects completion quickly
  useEffect(() => {
    let convChannel: any = null;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data?.user?.id;
      if (!uid) return;

      convChannel = supabase
        .channel(`conversations:user_id=${uid}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'conversations' },
          (payload: any) => {
            const updated = payload.new;
            if (!updated) return;
            const donationId = updated.donation_id;
            if (!donationId) return;

            setConvStatusByDonation(prev => {
              const prevEntry = prev[donationId];
              const wasCompleted = prevEntry && prevEntry.donor_complete && prevEntry.receiver_complete;
              const nowCompleted = updated.donor_complete && updated.receiver_complete;

              // if it transitioned to completed, add an in-app persistent notification
              if (!wasCompleted && nowCompleted) {
                const id = `completed-${donationId}-${Date.now()}`;
                setSystemNotifications(notifs => [
                  ...notifs,
                  { id, message: `Donation ${donationId} has been marked completed.`, donationId },
                ]);
                // also mark the listing status as completed
                (async () => {
                  try {
                    await supabase.from('food_listings').update({ status: 'completed' }).eq('id', donationId);
                  } catch (err) {
                    console.debug('Failed to update listing status to completed', err);
                  }
                })();
              }

              return { ...prev, [donationId]: updated };
            });
          }
        )
        .subscribe();
    })();

    return () => {
      if (convChannel) supabase.removeChannel(convChannel);
    };
  }, []);

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

      // Check conversation completion server-side to avoid stale UI state allowing chat for closed convs
      const { data: serverConv } = await supabase
        .from('conversations')
        .select('id, donor_complete, receiver_complete')
        .eq('donation_id', donationId)
        .limit(1)
        .maybeSingle();

      if (serverConv && serverConv.donor_complete && serverConv.receiver_complete) {
        toast({ title: 'Conversation closed', description: 'This donation has been completed.' });
        setOpeningChat(null);
        return;
      }

      // Use any existing mapping, but if the server has no conversation (e.g. it was deleted after completion),
      // clear the stale mapping so we can create a fresh conversation when reopening.
      let convId = convMap[donationId];
      if (!serverConv && convId) {
        setConvMap(prev => {
          const copy = { ...prev };
          delete copy[donationId];
          return copy;
        });
        convId = undefined as unknown as string;
      }

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

  // ensure chat back button returns to donor home
  router.push(`/chat/${convId}?returnTo=${encodeURIComponent('/donor')}`);
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

      {/* In-app persistent notifications (e.g., completed conversations) */}
      {systemNotifications.length > 0 && (
        <div className="mt-4 space-y-2">
          {systemNotifications.map(n => (
            <div key={n.id} className="flex items-center justify-between bg-amber-50 border-l-4 border-amber-400 p-3 rounded">
              <div className="text-sm text-amber-800">{n.message}</div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={async () => {
                  // dismiss notification
                  setSystemNotifications(prev => prev.filter(x => x.id !== n.id));
                }}>
                  Dismiss
                </Button>
                <Button size="sm" onClick={() => {
                  // navigate to donation detail/chat if desired
                  if (n.donationId) router.push(`/donor?donation=${n.donationId}`);
                }}>
                  View
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

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
                    {donation.status ? (
                      // show DB-driven status
                      <span className={
                        donation.status === 'completed' ? 'text-green-600' :
                        donation.status === 'taken' ? 'text-red-600' :
                        donation.status === 'expired (Not accepted)' ? 'text-red-600' :
                        'text-yellow-600'
                      }>
                        {donation.status}
                      </span>
                    ) : (
                      // fallback to conversation-completion or taken flag
                      convStatusByDonation[donation.id] && convStatusByDonation[donation.id].donor_complete && convStatusByDonation[donation.id].receiver_complete ? (
                        <span className="text-green-600">Completed</span>
                      ) : (
                        <span className={donation.taken ? 'text-red-600' : 'text-yellow-600'}>
                          {donation.taken ? 'Taken' : 'Pending'}
                        </span>
                      )
                    )}
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
                        <span className="absolute -top-2 -right-2 w-3 h-3 rounded-full bg-red-600" />
                      )}
                    </Button>
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
