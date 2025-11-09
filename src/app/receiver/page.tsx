'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
// Notification/toast hook (you already have this)
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
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [isStoredLocation, setIsStoredLocation] = useState<boolean>(false);
  const [unreadListings, setUnreadListings] = useState<Record<string, boolean>>({});
  const notifRef = React.useRef<any>(null);
  const processedNotifsRef = React.useRef<Set<string>>(new Set());
  const { toast } = useToast();

  // Safely log errors (handles Supabase/Postgres Error objects that have non-enumerable props)
  function safeLogError(label: string, err: any) {
    try {
      // prefer explicit properties if present
      const names = Object.getOwnPropertyNames(err || {});
      if (names.length > 0) {
        const out: Record<string, any> = {};
        names.forEach((k) => {
          try {
            out[k] = (err as any)[k];
          } catch {
            out[k] = "[unserializable]";
          }
        });
        console.error(`${label}: ${JSON.stringify(out)}`);
        return;
      }
      // fallback to common fields
      const msg = (err && ((err.message) || (err.error) || String(err))) ?? String(err);
      console.error(`${label}: ${msg}`);
    } catch (e) {
      // ultimate fallback
      try { console.error(`${label}: ${String(err)}`); } catch { /* ignore */ }
    }
  }

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
        safeLogError('reverse API error', e);
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
    const { data, error } = await supabase
      .from('food_listings')
      .select('*')
      .eq('taken', false)
      .order('created_at', { ascending: false });

    if (error) safeLogError('fetchAvailableListings error', error);
    let filtered = data || [];
    if (location) {
      filtered = filtered.filter((listing: any) => {
        if (!listing.latitude || !listing.longitude) return false;
        const dist = getDistanceKm(location.lat, location.lng, listing.latitude, listing.longitude);
        return dist <= 20;
      });
    }
    setAvailableListings(filtered);
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

    if (error) safeLogError('fetchTakenListings error', error);
    setTakenListings(data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (currentView === 'home') fetchAvailableListings();
    else if (currentView === 'taken') fetchTakenListings();
  }, [currentView, location]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const handleAcceptConfirm = async () => {
    if (!selectedListing) return;
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) return alert('Not logged in');

    const { data, error } = await supabase
      .from('food_listings')
      .update({ taken: true, taken_by: user.id })
      .eq('id', selectedListing.id)
      .select();

    if (error) {
      alert('Update failed: ' + error.message);
      return;
    }

    setShowConfirmDialog(false);
    setSelectedListing(null);
    setCurrentView('taken');
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
      setUnreadListings(prev => {
        const updated = { ...prev };
        delete updated[String(donationId)];
        return updated;
      });
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
        // clear local unread flag for this listing (chat page will clear DB notifications)
        setUnreadListings(prev => ({ ...prev, [String(listing.id)]: false }));
        router.push(`/chat/${conv.id}`);
      } else {
        alert('Conversation not available.');
      }
    } catch (e) {
      safeLogError('openChat error', e);
      alert('Unable to open chat.');
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
            </CardContent>
            <CardFooter>
              <div className="w-full grid grid-cols-2 gap-2">
                <Button onClick={() => setShowConfirmDialog(true)}>Accept This Item</Button>
                <div className="relative w-full">
                  <Button variant="ghost" className="w-full" onClick={() => openChat(selectedListing)}>
                    <MessageSquare className="mr-2 h-4 w-4" /> Chat
                  </Button>
                  { unreadListings[String(selectedListing.id)] && (
                    <span className="absolute -top-2 -right-2 h-3 w-3 bg-red-600 rounded-full ring-2 ring-white" aria-hidden />
                  )}
                </div>
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
                {listing.taken && <p className="font-bold text-red-600 mt-2">Status: Taken</p>}
              </CardContent>
              <CardFooter className="flex flex-col items-start gap-2 pt-4">
                {currentView === 'home' ? (
                  <Button className="w-full" onClick={() => { setSelectedListing(listing); setCurrentView('detail'); }}>
                    View & Accept
                  </Button>
                ) : (
                  <div className="w-full flex flex-col gap-2">
                    <div className="relative inline-block w-full">
                      <Button className="w-full" onClick={() => { setUnreadListings(prev => ({ ...prev, [String(listing.id)]: false })); openChat(listing); }}>
                        <MessageSquare className="mr-2 h-4 w-4" /> Chat
                      </Button>
                      {unreadListings[String(listing.id)] && <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-600 rounded-full ring-2 ring-white" aria-hidden />}
                    </div>
                    <Button className="w-full" variant="secondary">Complete</Button>
                  </div>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      </>
    );
  };

  // ========== INITIAL UNREAD FETCH ==========
  // Fetch unread notifications and map to donation booleans (robust when notifications.donation_id may not exist)
  useEffect(() => {
    (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const myUid = auth?.user?.id;
        if (!myUid) return;

        // only select conversation_id (avoid relying on donation_id column)
        const { data: notifs, error: notifsErr } = await supabase
          .from('notifications')
          .select('id, conversation_id, read')
          .eq('user_id', myUid)
          .eq('read', false);

        if (notifsErr) {
          safeLogError('loadUnread: notifications fetch error', notifsErr);
          return;
        }
        if (!notifs || notifs.length === 0) {
          setUnreadListings({});
          return;
        }

        // Resolve conversation -> donation mapping
        const convIds = Array.from(new Set(notifs.map((n: any) => n.conversation_id).filter(Boolean)));
        const map: Record<string, boolean> = {};

        if (convIds.length > 0) {
          const { data: convs, error: convErr } = await supabase
            .from('conversations')
            .select('id, donation_id')
            .in('id', convIds);
          if (convErr) {
            safeLogError('conversations fetch error', convErr);
          } else {
            (convs || []).forEach((c: any) => {
              if (c?.donation_id) map[String(c.donation_id)] = true;
            });
          }
        }

        setUnreadListings(map);
      } catch (e) {
        safeLogError('initial unread fetch error', e);
      }
    })();
    // run once on mount
  }, []);

  // ========== REALTIME SUBSCRIPTION ==========
  // Subscribe to notifications for me (server should insert a notifications row only for recipient)
 // ✅ REALTIME SUBSCRIPTION FIX — accurate unread count + ignore self-sent
useEffect(() => {
  let channelRef: any = null;

  (async () => {
    try {
      const { data: auth } = await supabase.auth.getUser();
      const myUid = auth?.user?.id;
      if (!myUid) return;

      channelRef = supabase
        .channel(`notifications-user-${myUid}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${myUid}`,
          },
          async (payload: any) => {
            const n = payload.new;
            // dedupe by notification id or fallback key
            try {
              const nid = String(n?.id ?? `${n?.conversation_id}-${n?.created_at}`);
              if (processedNotifsRef.current.has(nid)) return;
              processedNotifsRef.current.add(nid);
            } catch { /* ignore dedupe failures */ }

            // toast once
            try { toast({ title: 'New message', description: n?.preview ?? 'New message received' }); } catch {}

            // mark unread: prefer donation_id in payload
            try {
              if (n?.donation_id) {
                setUnreadListings(prev => ({ ...prev, [String(n.donation_id)]: true }));
                return;
              }
              if (!n?.conversation_id) return;
              const { data: conv } = await supabase
                .from('conversations')
                .select('donation_id')
                .eq('id', n.conversation_id)
                .limit(1)
                .maybeSingle();
              if (conv?.donation_id) {
                setUnreadListings(prev => ({ ...prev, [String(conv.donation_id)]: true }));
              }
            } catch { /* ignore */ }
          }
        )
        .subscribe();
    } catch (e) {
      safeLogError('Realtime setup error', e);
    }
  })();

  return () => {
    if (channelRef) {
      try {
        supabase.removeChannel(channelRef);
      } catch (e) {
        safeLogError('Error removing channel', e);
      }
    }
  };
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
    </div>
  );
}
