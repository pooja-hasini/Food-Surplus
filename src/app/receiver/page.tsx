export const dynamic = "force-dynamic";
'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { Home, ShoppingBag, LogOut, X, Menu, MessageSquare } from 'lucide-react';
import { Input } from '@/components/ui/input';
// 🔔 Notification additions:
import { useToast } from '@/hooks/use-toast';

type View = 'home' | 'taken' | 'detail';

export default function ReceiverDashboard() {
  const router = useRouter();

  const [availableListings, setAvailableListings] = useState<any[]>([]);
  const [takenListings, setTakenListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<View>('home');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedListing, setSelectedListing] = useState<any | null>(null);
  const [claimQuantity, setClaimQuantity] = useState<number | ''>('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [completeListing, setCompleteListing] = useState<any | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [isStoredLocation, setIsStoredLocation] = useState<boolean>(false);

  const searchParams = useSearchParams();

  // if a `view` query param is present (e.g. returning from chat), set the view
  useEffect(() => {
    try {
      const v = searchParams?.get('view');
      if (v === 'home' || v === 'taken' || v === 'detail') {
        setCurrentView(v as View);
      }
    } catch (e) {}
  }, [searchParams]);

  // 🔔 Notification additions - unread counts keyed by donation/listing id
  // track whether a donation has any unread notifications (boolean) and unread counts by conversation
  const [unreadExistsByDonation, setUnreadExistsByDonation] = useState<Record<string, boolean>>({});
  const [unreadByConversation, setUnreadByConversation] = useState<Record<string, number>>({});
  const [conversationsByDonation, setConversationsByDonation] = useState<Record<string, any>>({});
  const { toast } = useToast();

  // helper to create a short friendly address from reverse geocode result
  function extractShortAddress(reverseJson: any) {
    if (!reverseJson) return null;
    const raw = reverseJson.raw || reverseJson;
    const addr = raw.address || null;
    if (addr) {
      const city = addr.city || addr.town || addr.village || addr.hamlet || addr.county || addr.state;
      const state = addr.state || addr.region || addr.county;
      if (city && state) return `${city}, ${state}`;
      if (city) return city;
      if (state) return state;
    }
    if (reverseJson.display_name) {
      const parts = reverseJson.display_name.split(',').map((s: string) => s.trim());
      return parts.slice(0, 2).join(', ');
    }
    return null;
  }

  // reverse geocode when we have coords but not address
  useEffect(() => {
    if (!location || address) return;
    (async () => {
      try {
        const apiRes = await fetch(`/api/reverse?lat=${location.lat}&lon=${location.lng}`);
        if (apiRes.ok) {
          const j = await apiRes.json();
          const short = extractShortAddress(j);
          if (short) {
            setAddress(short);
            return;
          }
          if (j.display_name) {
            setAddress(j.display_name);
            return;
          }
        } else {
          console.error('reverse API failed', apiRes.status);
        }
      } catch (e) {
        console.error('reverse API error', e);
      }
    })();
  }, [location, address]);

  // haversine distance in km
  function getDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  const fetchAvailableListings = async () => {
    setLoading(true);
    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from('food_listings')
      .select('*')
      .eq('taken', false)
      .not('status', 'eq', 'expired (Not accepted)')
      .gte('expiry_date', nowIso)
      .order('created_at', { ascending: false });

    if (error) console.error(error);
    let filtered = data || [];
    if (location) {
      filtered = filtered.filter((listing: any) => {
        if (!listing.latitude || !listing.longitude) return false;
        const dist = getDistanceKm(location.lat, location.lng, listing.latitude, listing.longitude);
  return dist <= 15;
      });
    }
    setAvailableListings(filtered);
    // fetch conversations for these listings to know completion status
    try {
      const ids = (filtered || []).map((l: any) => l.id).filter(Boolean);
      if (ids.length) {
        const { data: convs } = await supabase.from('conversations').select('*').in('donation_id', ids);
        const map: Record<string, any> = {};
        convs?.forEach((c: any) => { if (c?.donation_id) map[c.donation_id] = c; });
        setConversationsByDonation(prev => ({ ...prev, ...map }));
      }
    } catch (e) { console.debug('conv fetch err', e); }
    setLoading(false);
  };

  // request location on mount and attempt stored fallback
  useEffect(() => {
    async function handleLocation() {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            setLocation({ lat, lng });
            setIsStoredLocation(false);
            setLocationError(null);

            try {
              const apiRes = await fetch(`/api/reverse?lat=${lat}&lon=${lng}`);
              if (apiRes.ok) {
                const j = await apiRes.json();
                const short = extractShortAddress(j);
                if (short) setAddress(short);
                else if (j.display_name) setAddress(j.display_name.split(',').slice(0,2).join(', '));
              }
            } catch (e) { console.debug('reverse live error', e); }

            const user = await supabase.auth.getUser();
            if (user && user.data && user.data.user) {
              const userId = user.data.user.id;
              await supabase
                .from('profiles')
                .update({ latest_location: { lat, lng } })
                .eq('id', userId);
            }
          },
          async (err) => {
            // denied: try stored location on profile
            const user = await supabase.auth.getUser();
            if (user && user.data && user.data.user) {
              const userId = user.data.user.id;
              const { data, error } = await supabase
                .from('profiles')
                .select('latest_location')
                .eq('id', userId)
                .single();
              if (data && data.latest_location) {
                let loc = data.latest_location;
                if (typeof loc === 'string') {
                  try { loc = JSON.parse(loc); } catch {}
                }
                if (loc && typeof loc.lat === 'number' && typeof loc.lng === 'number') {
                  setLocation(loc);
                  setIsStoredLocation(true);
                  setLocationError(null);
                  try {
                    const apiRes = await fetch(`/api/reverse?lat=${loc.lat}&lon=${loc.lng}`);
                    if (apiRes.ok) {
                      const j = await apiRes.json();
                      const short = extractShortAddress(j);
                      if (short) setAddress(short);
                      else if (j.display_name) setAddress(j.display_name.split(',').slice(0,2).join(', '));
                    } else {
                      console.debug('reverse api (stored) failed status:', apiRes.status);
                    }
                  } catch (e) { console.debug('reverse stored error', e); }
                } else {
                  setLocationError('Location access denied. Please enable location to view nearby donations.');
                }
              } else {
                setLocationError('Location access denied. Please enable location to view nearby donations.');
              }
            } else {
              setLocationError('Location access denied. Please enable location to view nearby donations.');
            }
          }
        );
      } else {
        setLocationError('Geolocation is not supported by your browser.');
      }
    }
    if (!location) handleLocation();
  }, []);

  // Manage Back button behavior for receiver views:
  // - If on 'home', Back should keep the user on the home page (no navigation away)
  // - If on 'taken', Back should navigate to the 'home' view
  useEffect(() => {
    const handlePop = (event: PopStateEvent) => {
      try {
        if (window.location.pathname.startsWith('/receiver')) {
          if (currentView === 'home') {
            // re-push current URL so the user stays on home
            window.history.pushState(null, '', window.location.href);
          } else if (currentView === 'taken') {
            // navigate to home view within the receiver page
            setCurrentView('home');
            // ensure history reflects the new view
            const newUrl = `/receiver?view=home`;
            window.history.pushState(null, '', newUrl);
          }
        }
      } catch (e) {
        // ignore
      }
    };

    if (typeof window !== 'undefined') {
      // create an initial history entry to allow popstate handling
      window.history.pushState(null, '', window.location.href);
      window.addEventListener('popstate', handlePop);
    }

    return () => {
      if (typeof window !== 'undefined') window.removeEventListener('popstate', handlePop);
    };
  }, [currentView]);

  const fetchTakenListings = async () => {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) return setLoading(false);

    const { data, error } = await supabase
      .from('food_listings')
      .select('*')
      .eq('taken', true)
      .eq('taken_by', user.id)
      .order('created_at', { ascending: false });

    if (error) console.error(error);
    setTakenListings(data || []);
    // fetch conversations for taken listings as well
    try {
      const ids = (data || []).map((l: any) => l.id).filter(Boolean);
      if (ids.length) {
        const { data: convs } = await supabase.from('conversations').select('*').in('donation_id', ids);
        const map: Record<string, any> = {};
        convs?.forEach((c: any) => { if (c?.donation_id) map[c.donation_id] = c; });
        setConversationsByDonation(prev => ({ ...prev, ...map }));
      }
    } catch (e) { console.debug('conv fetch err', e); }
    setLoading(false);
  };

  // helper to refresh conversations for currently displayed listings (both available and taken)
  const refreshConversationsForDisplayedListings = async () => {
    try {
      const ids = [
        ...(availableListings || []).map((l: any) => l.id).filter(Boolean),
        ...(takenListings || []).map((l: any) => l.id).filter(Boolean),
      ];
      const uniq = Array.from(new Set(ids));
      if (!uniq.length) return [];
      const { data: convs } = await supabase.from('conversations').select('*').in('donation_id', uniq);
      const map: Record<string, any> = {};
      (convs || []).forEach((c: any) => { if (c?.donation_id) map[c.donation_id] = c; });
      setConversationsByDonation(prev => ({ ...prev, ...map }));
      return convs || [];
    } catch (e) {
      console.debug('refresh convs failed', e);
      return [];
    }
  };

  useEffect(() => {
    if (currentView === 'home') {
      // only fetch available listings once we have a location (live or stored)
      if (location) fetchAvailableListings();
      else setAvailableListings([]);
    } else if (currentView === 'taken') {
      fetchTakenListings();
    }
  }, [currentView, location]);


  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const handleAcceptConfirm = async () => {
    if (!selectedListing) return;
    // validate quantity
    const maxQty = Number(selectedListing.quantity) || 0;
    const q = typeof claimQuantity === 'number' ? claimQuantity : 0;
    if (!q || q <= 0) {
      alert('Please enter a valid quantity to claim.');
      return;
    }
    if (maxQty > 0 && q > maxQty) {
      alert(`Claim quantity cannot exceed listed quantity (${maxQty}).`);
      return;
    }
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) return alert('Not logged in');

    // Call the server-side RPC which atomically handles partial claims and duplicate creation
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('claim_listing', {
        p_listing_id: selectedListing.id,
        p_taker: user.id,
        p_taken_qty: q,
      });

      if (rpcError) {
        console.error('claim_listing RPC error', rpcError);
        alert('Accept failed: ' + rpcError.message);
        return;
      }

      // rpcData may be an array of rows returned by the function
      const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;

      // refresh listings to reflect changes
      await fetchAvailableListings();
      await fetchTakenListings();

      // ensure the original listing status is set to 'taken'
      try {
        if (row && row.original_id) {
          await supabase.from('food_listings').update({ status: 'taken' }).eq('id', row.original_id);
        }
        // if duplicate was created, make sure it's marked pending
        if (row && row.duplicate_id) {
          await supabase.from('food_listings').update({ status: 'pending' }).eq('id', row.duplicate_id);
        }
      } catch (e) {
        console.debug('Failed to update status after claim RPC', e);
      }

      setShowConfirmDialog(false);
      setSelectedListing(null);
      setClaimQuantity('');
      setCurrentView('taken');

      if (row && row.duplicate_id) {
        toast({ title: 'Partial claim', description: 'You claimed part of the listing. Remaining quantity returned to listings.' });
      } else {
        toast({ title: 'Claimed', description: 'You claimed the item.' });
      }
    } catch (e: any) {
      console.error('Accept RPC error', e);
      alert('Accept failed: ' + (e?.message ?? e));
      return;
    }
  };

  const navigateToView = (view: View) => {
    setCurrentView(view);
    setSelectedListing(null);
  };

  // helper to clear unread when chat opens
  const clearUnread = async (conversationId: string, donationId?: string) => {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth?.user?.id;
    if (!uid) return;

    if (conversationId) {
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('conversation_id', conversationId)
        .eq('user_id', uid);
    }
    if (donationId) {
      setUnreadExistsByDonation(prev => {
        const updated = { ...prev };
        delete updated[donationId];
        return updated;
      });
      // also remove any conversation-level unread for this conversation
      if (conversationId) {
        setUnreadByConversation(prev => {
          const copy = { ...prev };
          delete copy[String(conversationId)];
          return copy;
        });
      }
    }
  };

  // open or create conversation for a listing, then navigate to chat page
  const openChat = async (listing: any) => {
    const { data: userData } = await supabase.auth.getUser();
    const me = userData?.user;
    if (!me) return alert('You must be signed in to chat.');

    try {
      // try find existing conversation by donation/listing id
      const { data: existing, error: findErr } = await supabase
        .from('conversations')
        .select('*')
        .eq('donation_id', listing.id)
        .limit(1)
        .maybeSingle();

      if (findErr) console.debug('conversation find err', findErr);
      let conv = existing;

      // if conversation exists and is already completed, don't allow chat
      if (conv && conv.donor_complete && conv.receiver_complete) {
        alert('This conversation is closed — the donation has been completed.');
        return;
      }

      if (!conv) {
        // best-effort donor id from listing (depends on your schema)
        const donorId = listing.user_id || listing.donor_id || listing.posted_by || null;
        const { data: inserted, error: insertErr } = await supabase
          .from('conversations')
          .insert({
            donation_id: listing.id,
            donor_id: donorId,
            receiver_id: me.id,
          })
          .select()
          .single();

        if (insertErr) {
          console.error('create conversation error', insertErr);
          return alert('Unable to start chat.');
        }
        conv = inserted;
      }

      if (conv?.id) {
        // 🔔 mark notifications read for this conversation and clear badge for this donation
        await clearUnread(conv.id, listing.id);
    // include a returnTo param so chat Back always returns to the Taken Items view
    const returnTo = encodeURIComponent(`/receiver?view=taken`);
    router.push(`/chat/${conv.id}?returnTo=${returnTo}`);
      } else {
        alert('Conversation not available.');
      }
    } catch (e) {
      console.error('openChat error', e);
      alert('Unable to open chat.');
    }
  };

  const handleMarkComplete = async (listing: any) => {
    // find conversation for this listing
    try {
      const { data: conv } = await supabase
        .from('conversations')
        .select('*')
        .eq('donation_id', listing.id)
        .limit(1)
        .maybeSingle();

      if (!conv || !conv.id) {
        alert('No conversation found for this listing.');
        return;
      }

      const { error } = await supabase
        .from('conversations')
        .update({ donor_complete: true, receiver_complete: true })
        .eq('id', conv.id);

      if (error) {
        console.error('complete update error', error);
        alert('Failed to mark complete.');
        return;
      }

      // mark the listing as completed as well (some schemas use `completed` column)
      try {
        await supabase
          .from('food_listings')
          .update({ completed: true, status: 'completed' })
          .eq('id', listing.id);
      } catch (e) {
        console.debug('failed to mark listing.completed (maybe column missing)', e);
      }

      // update local map and refresh listings
      setConversationsByDonation(prev => ({ ...prev, [listing.id]: { ...prev[listing.id], donor_complete: true, receiver_complete: true } }));
      fetchTakenListings();
      fetchAvailableListings();
      alert('Marked as completed — chat closed.');
    } catch (e) {
      console.error('handleMarkComplete error', e);
      alert('Failed to mark complete.');
    }
  };

  const renderContent = () => {
    if (loading) return <div className="text-center py-10">Loading...</div>;
    if (locationError) return <div className="text-center py-10 text-red-600">{locationError}</div>;
    if (!location) return <div className="text-center py-10">Please allow location access to view nearby donations.</div>;

    if (currentView === 'detail' && selectedListing) {
      return (
        <div className="p-4 md:p-6">
          <Button variant="outline" onClick={() => navigateToView('home')}>&larr; Back to list</Button>
          <Card className="mt-4 max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="text-2xl">{selectedListing.food_name}</CardTitle>
            </CardHeader>
            <CardContent>
              {selectedListing.photo_url && (
                <img src={selectedListing.photo_url} alt="Food" className="mb-4 max-h-80 w-full object-cover rounded-md" />
              )}
              <p className="text-lg mb-4">{selectedListing.description}</p>
              <div className="grid grid-cols-2 gap-4 text-md">
                <p><span className="font-semibold">Quantity:</span> {selectedListing.quantity}</p>
                <p><span className="font-semibold">Location:</span> {selectedListing.location}</p>
                <p><span className="font-semibold">Expiry Date:</span> {selectedListing.expiry_date ? new Date(selectedListing.expiry_date).toLocaleDateString() : '—'}</p>
              </div>
              {/* Receiver claim quantity input */}
              <div className="mt-4">
                <label className="block text-sm font-medium text-muted-foreground mb-2">Quantity to claim</label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={selectedListing.quantity}
                    value={claimQuantity === '' ? '' : claimQuantity}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === '') return setClaimQuantity('');
                      const n = parseInt(v, 10);
                      if (Number.isNaN(n)) return setClaimQuantity('');
                      setClaimQuantity(n);
                    }}
                    className="w-32"
                    placeholder={String(selectedListing.quantity || 1)}
                  />
                  <div className="text-sm text-muted-foreground">of {selectedListing.quantity}</div>
                </div>
                {claimQuantity !== '' && typeof claimQuantity === 'number' && claimQuantity > selectedListing.quantity && (
                  <div className="text-sm text-red-600 mt-2">Claim quantity cannot exceed listed quantity.</div>
                )}
              </div>
            </CardContent>
            <CardFooter>
              <div className="w-full grid grid-cols-1 gap-2">
                <Button onClick={() => setShowConfirmDialog(true)}>Accept This Item</Button>
              </div>
            </CardFooter>
          </Card>
        </div>
      );
    }

    // address banner
    let addressBanner = null;
    if (location && (typeof location.lat === 'number' && typeof location.lng === 'number')) {
      const bannerText = isStoredLocation ? 'Showing donations near your latest address:' : 'Showing donations at address:';
      addressBanner = (
        <div className="text-center py-2 text-green-600">
          {bannerText} <br />
          <span className="font-semibold">{address ?? 'Resolving address...'}</span>
        </div>
      );
    }

    const listings = currentView === 'home' ? availableListings : takenListings;
    const isEmpty = listings.length === 0;
    const emptyMessage = currentView === 'home'
      ? 'No food available right now. Check back later!'
      : 'You have not accepted any food items yet.';

    if (isEmpty) {
      return (
        <>
          {addressBanner}
          <div className="text-center py-10">{emptyMessage}</div>
        </>
      );
    }

    return (
      <>
        {addressBanner}
        <div className="p-4 md:p-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {listings.map((listing: any) => (
            <Card key={listing.id} className="flex flex-col">
              <CardHeader>
                <CardTitle>{listing.food_name}</CardTitle>
              </CardHeader>
              <CardContent className="flex-grow">
                {listing.photo_url && (
                  <div className="aspect-video w-full overflow-hidden rounded-md mb-4">
                    <img src={listing.photo_url} alt={listing.food_name} className="h-full w-full object-cover" />
                  </div>
                )}
                <p className="text-sm text-muted-foreground mb-2 line-clamp-2 h-10">{listing.description}</p>
                <div className="space-y-1 text-sm">
                  <p><span className="font-semibold">Quantity:</span> {listing.quantity}</p>
                  <p><span className="font-semibold">Expiry:</span> {listing.expiry_date ? new Date(listing.expiry_date).toLocaleDateString() : '—'}</p>
                </div>
                {/* Prefer the DB `status` when available, fallback to `taken` flag */}
                { (listing.status ? (
                  <p className="font-bold mt-2">Status: <span className={
                    listing.status === 'completed' ? 'text-green-600' :
                    listing.status === 'taken' ? 'text-red-600' :
                    listing.status === 'expired (Not accepted)' ? 'text-red-600' :
                    'text-yellow-600'
                  }>{listing.status}</span></p>
                ) : (
                  listing.taken ? <p className="font-bold text-red-600 mt-2">Status: Taken</p> : null
                ))}
              </CardContent>
              <CardFooter className="flex flex-col items-start gap-2 pt-4">
                {currentView === 'home' ? (
                  <Button className="w-full" onClick={() => { setSelectedListing(listing); setClaimQuantity(listing.quantity ?? ''); setCurrentView('detail'); }}>
                    View & Accept
                  </Button>
                  ) : (
                  <div className="w-full flex flex-col gap-2">
                    <div className="relative w-full">
                      <Button className="w-full" onClick={() => openChat(listing)}>
                        <MessageSquare className="mr-2 h-4 w-4" /> Chat
                      </Button>
                      { (unreadExistsByDonation[listing.id] || (conversationsByDonation[listing.id]?.id && Boolean(unreadByConversation[conversationsByDonation[listing.id].id]))) && (
                        <span className="absolute -top-2 -right-2 w-3 h-3 rounded-full bg-red-600" />
                      )}
                    </div>
                    {conversationsByDonation[listing.id] && conversationsByDonation[listing.id].donor_complete && conversationsByDonation[listing.id].receiver_complete ? (
                      <Button className="w-full" variant="secondary" disabled>Completed</Button>
                    ) : (
                      <Button className="w-full" variant="secondary" onClick={() => { setCompleteListing(listing); setShowCompleteDialog(true); }}>Complete</Button>
                    )}
                  </div>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      </>
    );
  };
    
// ✅ Realtime unread badge + toast for receiver
useEffect(() => {
  const setup = async () => {
    const { data: userData } = await supabase.auth.getUser();
    const me = userData?.user;
    if (!me) return;

    // First, load existing unread notifications for this user and map them to donation ids
    try {
      const { data: notifs } = await supabase
        .from('notifications')
        .select('conversation_id')
        .eq('user_id', me.id)
        .eq('read', false);
      const convIds = Array.from(new Set((notifs || []).map((n: any) => n.conversation_id).filter(Boolean)));
      // counts keyed by conversation id (for direct lookups)
      const convCounts: Record<string, number> = {};
      (notifs || []).forEach((n: any) => {
        if (n?.conversation_id) convCounts[String(n.conversation_id)] = (convCounts[String(n.conversation_id)] || 0) + 1;
      });
      setUnreadByConversation(convCounts);

      if (convIds.length) {
        const { data: convs } = await supabase
          .from('conversations')
          .select('id, donation_id')
          .in('id', convIds as any[]);
        const convMapLocal: Record<string, string> = {};
        (convs || []).forEach((c: any) => { if (c?.id && c?.donation_id) convMapLocal[c.id] = String(c.donation_id); });

        const exists: Record<string, boolean> = {};
        (notifs || []).forEach((n: any) => {
          const did = convMapLocal[n.conversation_id];
          if (did) exists[did] = true;
        });
        setUnreadExistsByDonation(exists);
      }
    } catch (e) {
      console.debug('failed to load unread notifications', e);
    }

    // subscribe to notifications inserts for this receiver to update unreadCounts in realtime
    const channel = supabase
      .channel('receiver-notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${me.id}` },
        async (payload) => {
          const n = payload.new;
          if (!n || !n.conversation_id) return;
          try {

            // increment unread count keyed by conversation id
            setUnreadByConversation(prev => ({ ...prev, [String(n.conversation_id)]: (prev[String(n.conversation_id)] || 0) + 1 }));

            const { data: conv } = await supabase
              .from('conversations')
              .select('donation_id')
              .eq('id', n.conversation_id)
              .limit(1)
              .maybeSingle();
            let donationId: string | null = null;
            if (conv && conv.donation_id) {
              donationId = String(conv.donation_id);
            } else {
              // possible race: conversation not yet present in local map. Refresh conversations for displayed listings and try to find mapping.
              const convs = await refreshConversationsForDisplayedListings();
              const found = (convs || []).find((c: any) => String(c.id) === String(n.conversation_id));
              if (found && found.donation_id) donationId = String(found.donation_id);
            }

            if (donationId) setUnreadExistsByDonation(prev => ({ ...prev, [donationId]: true }));
          } catch (e) { console.debug('notif subscribe conv lookup failed', e); }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  setup();
}, []);


  
  return (
    <div className="flex h-screen bg-background">
      <aside className={`bg-muted/50 border-r transition-all duration-300 ${sidebarOpen ? 'w-64' : 'w-0'} overflow-hidden h-full flex-shrink-0`}>
        <div className="p-4">
          <h2 className="text-xl font-bold mb-8 px-2">Menu</h2>
          <nav className="flex flex-col gap-2">
            <Button variant={currentView === 'home' ? 'secondary' : 'ghost'} className="justify-start" onClick={() => navigateToView('home')}>
              <Home className="mr-2 h-5 w-5" /> Home
            </Button>
            <Button variant={currentView === 'taken' ? 'secondary' : 'ghost'} className="justify-start" onClick={() => navigateToView('taken')}>
              <ShoppingBag className="mr-2 h-5 w-5" /> Taken Items
            </Button>
            <Button variant="ghost" className="w-full justify-start" onClick={handleLogout}>
              <LogOut className="mr-2 h-5 w-5" /> Logout
            </Button>
          </nav>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center p-4 border-b flex-shrink-0">
          <Button variant="outline" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)} className="mr-4">
            {sidebarOpen ? <X /> : <Menu />}
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">ReFeed</h1>
        </header>

        <div className="flex-1 overflow-y-auto">
          {renderContent()}
        </div>
      </main>

      {selectedListing && (
        <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                Do you want to accept this food item: <span className="font-semibold">{selectedListing.food_name}</span>? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleAcceptConfirm}>Yes, Accept</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
      {completeListing && (
        <AlertDialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm completion</AlertDialogTitle>
              <AlertDialogDescription>
                Do you want to mark this donation <span className="font-semibold">{completeListing.food_name}</span> as completed? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => { setShowCompleteDialog(false); setCompleteListing(null); }}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={async () => {
                setShowCompleteDialog(false);
                try {
                  await handleMarkComplete(completeListing);
                } finally {
                  setCompleteListing(null);
                }
              }}>Yes, Mark Complete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}