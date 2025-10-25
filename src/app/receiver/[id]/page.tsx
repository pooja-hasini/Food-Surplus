'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDonations } from '@/context/DonationsContext';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  Clock,
  Users,
  MapPin,
  CheckCircle,
  AlertTriangle,
  Loader2,
  HandHeart,
  MessageSquare,
} from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabaseClient';

export default function DonationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { getDonationById, updateDonationStatus } = useDonations();

  const id = typeof params.id === 'string' ? params.id : '';
  const donation = getDonationById(id);

  const [isConfirming, setIsConfirming] = useState(false);
  const [isTaken, setIsTaken] = useState(donation?.status === 'taken');
  const [isProcessing, setIsProcessing] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  // ✅ keep isTaken synced with latest status
  useEffect(() => {
    if (donation?.status === 'taken') setIsTaken(true);
    else setIsTaken(false);
  }, [donation?.status]);

  // reset confirmation timeout
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isConfirming) {
      timer = setTimeout(() => {
        setIsConfirming(false);
      }, 3000);
    }
    return () => clearTimeout(timer);
  }, [isConfirming]);

  // fetch current user
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (!mounted) return;
        setCurrentUser(data?.user ?? null);
        console.log('Receiver page: current user', data?.user);
      } catch (err) {
        console.error('supabase.getUser error', err);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const handleTakeFood = () => {
    if (isTaken || isProcessing) return;

    if (!isConfirming) {
      setIsConfirming(true);
      return;
    }

    setIsProcessing(true);
    setTimeout(() => {
      updateDonationStatus(id, 'taken');
      setIsTaken(true);
      setIsProcessing(false);
      setIsConfirming(false);
      toast({
        title: 'Successfully Claimed!',
        description: 'You have claimed this food donation.',
      });
    }, 1000);
  };

  const openOrCreateChat = async () => {
    setLastError(null);
    if (chatLoading) return;
    setChatLoading(true);

    try {
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      const user = authData?.user ?? currentUser;
      if (authErr) {
        toast({
          title: 'Auth error',
          description: authErr.message ?? 'Unable to verify authentication.',
        });
        setChatLoading(false);
        return;
      }
      if (!user) {
        toast({
          title: 'Sign in required',
          description: 'Please sign in to open chat.',
        });
        setChatLoading(false);
        return;
      }

      const { data: listing, error: listingErr } = await supabase
        .from('food_listings')
        .select('id, donor_id')
        .eq('id', donation?.id ?? id)
        .limit(1)
        .maybeSingle();

      if (listingErr) {
        toast({
          title: 'Listing error',
          description:
            listingErr.message ?? 'Could not load donation details.',
        });
      }
      const donationId = listing?.id ?? donation?.id ?? id;
      if (!donationId) {
        toast({
          title: 'Missing donation',
          description: 'Donation identifier missing.',
        });
        setChatLoading(false);
        return;
      }

      // check existing conversation
      const { data: existing } = await supabase
        .from('conversations')
        .select('id, donor_id, receiver_id')
        .eq('donation_id', donationId)
        .limit(1)
        .maybeSingle();

      if (existing?.id) {
        setConversationId(existing.id);
        toast({
          title: 'Chat opened',
          description: 'Opening existing chat...',
        });
        await router.push(`/chat/${existing.id}`);
        setChatLoading(false);
        return;
      }

      // create new conversation
      const insertPayload: any = { donation_id: donationId, receiver_id: user.id };
      if (listing?.donor_id)
        insertPayload.donor_id = listing.donor_id;
      else if ((donation as any)?.donor_id)
        insertPayload.donor_id = (donation as any).donor_id;

      const { data: created, error: insertError } = await supabase
        .from('conversations')
        .insert(insertPayload)
        .select()
        .single();

      if (insertError) {
        toast({
          title: 'Chat create failed',
          description: insertError.message ?? 'Unable to create chat.',
        });
        setChatLoading(false);
        return;
      }

      setConversationId(created.id);
      toast({ title: 'Chat created', description: 'Opening chat now...' });
      await router.push(`/chat/${created.id}`);
    } catch (err: any) {
      console.error('openOrCreateChat error', err);
      toast({
        title: 'Chat failed',
        description: err?.message ?? 'Unable to open chat.',
      });
    } finally {
      setChatLoading(false);
    }
  };

  // notification listener
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
            {
              event: 'INSERT',
              schema: 'public',
              table: 'notifications',
              filter: `user_id=eq.${uid}`,
            },
            (payload: any) => {
              const n = payload.new;
              toast({
                title: 'New message',
                description: n?.preview ?? 'New message received',
              });
            }
          )
          .subscribe();
      } catch {}
    })();

    return () => {
      if (notificationChannel) supabase.removeChannel(notificationChannel);
    };
  }, []);

  if (!donation) {
    return (
      <div className="container py-8 text-center">
        <AlertTriangle className="mx-auto h-12 w-12 text-destructive" />
        <h1 className="mt-4 text-2xl font-bold">Donation not found</h1>
        <p className="text-muted-foreground">
          This donation may have been removed or the link is incorrect.
        </p>
        <Button onClick={() => router.push('/receiver')} className="mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Donations
        </Button>
      </div>
    );
  }

  const buttonText = isProcessing
    ? 'Processing...'
    : isTaken
    ? 'Claimed'
    : isConfirming
    ? 'Confirm Claim'
    : 'Take Food';

  return (
    <div className="container mx-auto max-w-4xl p-4 py-8">
      <Button
        variant="ghost"
        onClick={() => router.back()}
        className="mb-4"
        aria-label="Go back"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to List
      </Button>

      <Card className="overflow-hidden">
        <div className="grid md:grid-cols-2">
          <div className="relative h-64 md:h-full min-h-[300px]">
            <Image
              src={donation.photoUrl}
              alt={donation.foodName}
              layout="fill"
              objectFit="cover"
              style={{ pointerEvents: 'none' }} // ✅ fix overlay blocking clicks
              data-ai-hint="donated food"
            />
          </div>

          <div className="p-6 md:p-8 flex flex-col relative z-10">
            <div className="flex-grow">
              <Badge
                variant={isTaken ? 'secondary' : 'default'}
                className="capitalize mb-2"
              >
                {donation.status}
              </Badge>
              <h1 className="text-3xl font-bold tracking-tight">
                {donation.foodName}
              </h1>
              <div className="mt-2 flex flex-wrap gap-2">
                {donation.tags.map((tag) => (
                  <Badge key={tag} variant="outline">
                    {tag}
                  </Badge>
                ))}
              </div>

              <div className="mt-6 space-y-4 text-muted-foreground">
                <div className="flex items-start gap-3">
                  <Users className="h-5 w-5 flex-shrink-0 text-primary mt-1" />
                  <span>
                    Serves approximately{' '}
                    <span className="font-bold text-foreground">
                      {donation.quantity}
                    </span>{' '}
                    people.
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <Clock className="h-5 w-5 flex-shrink-0 text-primary mt-1" />
                  <span>
                    Best before{' '}
                    <span className="font-bold text-foreground">
                      {format(donation.expiryTime, 'PPP')}
                    </span>
                    .
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 flex-shrink-0 text-primary mt-1" />
                  <span>
                    Available at:{' '}
                    <span className="font-bold text-foreground">
                      {donation.location}
                    </span>
                    .
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-8">
              <Button
                onClick={handleTakeFood}
                size="lg"
                className="w-full transition-all"
                disabled={isTaken || isProcessing}
                variant={isConfirming ? 'destructive' : 'default'}
              >
                {isProcessing && (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                )}
                {isTaken && <CheckCircle className="mr-2 h-5 w-5" />}
                {!isTaken && !isProcessing && (
                  <HandHeart className="mr-2 h-5 w-5" />
                )}
                {buttonText}
              </Button>
              {isConfirming && (
                <p className="text-center text-sm mt-2 text-destructive-foreground">
                  Click again to confirm. This action cannot be undone.
                </p>
              )}
            </div>
          </div>
        </div>
      </Card>

      {isTaken && (
        <div>
          <Button
            type="button"
            onClick={openOrCreateChat}
            size="lg"
            className="w-full mt-2"
            variant="outline"
            disabled={chatLoading}
            aria-label={chatLoading ? 'Opening chat' : 'Open chat with donor'}
          >
            <MessageSquare className="mr-2 h-4 w-4" />
            {chatLoading ? 'Opening Chat...' : 'Chat with Donor'}
          </Button>

          <div className="mt-2 text-sm text-muted-foreground">
            <div>
              Signed in:{' '}
              {currentUser?.email ??
                (currentUser?.id ? currentUser?.id : 'No')}
            </div>
            <div>ConversationId: {conversationId ?? 'none'}</div>
            {lastError && (
              <div className="text-destructive mt-1">
                Last error: {lastError}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
