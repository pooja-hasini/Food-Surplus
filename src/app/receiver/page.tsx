'use client';
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Menu, Home, ShoppingBag, LogOut, X, MessageSquare } from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

type View = 'home' | 'taken' | 'detail';

export default function ReceiverDashboard() {
  const [availableListings, setAvailableListings] = useState<any[]>([]);
  const [takenListings, setTakenListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<View>('home');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedListing, setSelectedListing] = useState<any | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [isStoredLocation, setIsStoredLocation] = useState<boolean>(false);

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

  // Ensure we attempt reverse-geocoding when location is present but address wasn't set
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

  const router = useRouter();

  // Haversine formula for distance in km
  function getDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
    const R = 6371; // Radius of earth in km
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
      .from("food_listings")
      .select("*")
      .eq("taken", false)
      .order("created_at", { ascending: false });

    if (error) console.error(error);
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
  // Request location on mount
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

            // Reverse-geocode to get human-readable address (using Nominatim)
              try {
                const apiRes = await fetch(`/api/reverse?lat=${lat}&lon=${lng}`);
                if (apiRes.ok) {
                  const j = await apiRes.json();
                  console.debug('reverse api (live) response:', j);
                  const short = extractShortAddress(j);
                  if (short) {
                    setAddress(short);
                    console.debug('address set from live coords (short):', short);
                  } else if (j.display_name) {
                    const shortFallback = j.display_name.split(',').slice(0,2).join(', ');
                    setAddress(shortFallback);
                    console.debug('address set from live coords (display_name fallback):', shortFallback);
                  }
                }
              } catch (e) { console.debug('reverse live error', e); }

            // Save latest location to profiles table
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
            // On denied, check for previous location
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
                // If Supabase returns as string, parse it
                if (typeof loc === 'string') {
                  try {
                    loc = JSON.parse(loc);
                  } catch {}
                }
                if (loc && typeof loc.lat === 'number' && typeof loc.lng === 'number') {
                  setLocation(loc);
                  setIsStoredLocation(true);
                  setLocationError(null);
                  // reverse-geocode stored coords
                  try {
                    const apiRes = await fetch(`/api/reverse?lat=${loc.lat}&lon=${loc.lng}`);
                    if (apiRes.ok) {
                      const j = await apiRes.json();
                      console.debug('reverse api (stored) response:', j);
                      const short = extractShortAddress(j);
                      if (short) {
                        setAddress(short);
                        console.debug('address set from stored coords (short):', short);
                      } else if (j.display_name) {
                        const shortFallback = j.display_name.split(',').slice(0,2).join(', ');
                        setAddress(shortFallback);
                        console.debug('address set from stored coords (display_name fallback):', shortFallback);
                      }
                    } else {
                      console.debug('reverse api (stored) failed status:', apiRes.status);
                    }
                  } catch (e) { console.debug('reverse stored error', e); }
                } else {
                  setLocationError("Location access denied. Please enable location to view nearby donations.");
                }
              } else {
                setLocationError("Location access denied. Please enable location to view nearby donations.");
              }
            } else {
              setLocationError("Location access denied. Please enable location to view nearby donations.");
            }
          }
        );
      } else {
        setLocationError("Geolocation is not supported by your browser.");
      }
    }
    if (!location) {
      handleLocation();
    }
  }, []);

  const fetchTakenListings = async () => {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) return setLoading(false);

    const { data, error } = await supabase
      .from("food_listings")
      .select("*")
      .eq("taken", true)
      .eq("taken_by", user.id)
      .order("created_at", { ascending: false });

    if (error) console.error(error);
    setTakenListings(data || []);
    setLoading(false);
  };

  useEffect(() => {
    // re-fetch listings when view or location changes
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
    if (!user) return alert("Not logged in");

    const { data, error } = await supabase
      .from("food_listings")
      .update({ taken: true, taken_by: user.id })
      .eq("id", selectedListing.id)
      .select(); // important: returns updated row

    if (error) {
      alert("Update failed: " + error.message);
      return;
    }
    else{
      
    setShowConfirmDialog(false);
    setSelectedListing(null);
    setCurrentView('taken');

    }

  };

  const navigateToView = (view: View) => {
    setCurrentView(view);
    setSelectedListing(null);
  };

  const renderContent = () => {
    if (loading) return <div className="text-center py-10">Loading...</div>;
    if (locationError) return <div className="text-center py-10 text-red-600">{locationError}</div>;
    if (!location) return <div className="text-center py-10">Please allow location access to view nearby donations.</div>;

    // Detail view
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
                <p><span className="font-semibold">Expiry Date:</span> {new Date(selectedListing.expiry_date).toLocaleDateString()}</p>
              </div>
            </CardContent>
            <CardFooter>
              <Button className="w-full" size="lg" onClick={() => setShowConfirmDialog(true)}>Accept This Item</Button>
            </CardFooter>
          </Card>
        </div>
      );
    }

    // Always show address if location is set
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
      ? "No food available right now. Check back later!" 
      : "You have not accepted any food items yet.";

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
          {listings.map(listing => (
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
                  <p><span className="font-semibold">Expiry:</span> {new Date(listing.expiry_date).toLocaleDateString()}</p>
                  <p><span className="font-semibold">Location:</span> {listing.location}</p>
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
                    <Button className="w-full"><MessageSquare className="mr-2 h-4 w-4" /> Chat</Button>
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

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
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

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center p-4 border-b flex-shrink-0">
          <Button variant="outline" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)} className="mr-4">
            {sidebarOpen ? <X /> : <Menu />}
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">
            ReFeed
          </h1>
        </header>

        <div className="flex-1 overflow-y-auto">
          {renderContent()}
        </div>
      </main>

      {/* Confirm Dialog */}
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
