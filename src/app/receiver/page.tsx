'use client';
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
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

export default function ReceiverDashboard() {
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [selectedListing, setSelectedListing] = useState<any | null>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchListings = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("food_listings")
        .select("*")
        .eq("taken", false)
        .order("created_at", { ascending: false });
      setListings(data || []);
      setLoading(false);
    };
    fetchListings();
  }, []);

  const handleAccept = async (listingId: string) => {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return alert("Not logged in");

    const { error } = await supabase
      .from("food_listings")
      .update({ taken: true, taken_by: user.id })
      .eq("id", listingId);

    if (error) return alert(error.message);

    setListings(listings.filter(l => l.id !== listingId));
    setSelectedListing(null);
  };

  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-4">Available Food Donations</h1>
      {loading ? (
        <div>Loading...</div>
      ) : listings.length === 0 ? (
        <div>No food available right now.</div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {listings.map(listing => (
            <div
              key={listing.id}
              className="border rounded-lg p-4 bg-card shadow-sm"
            >
              <h3 className="font-bold text-lg">
                {listing.food_name || listing.title}
              </h3>

              {listing.photo_url && (
                <img
                  src={listing.photo_url}
                  alt="Food"
                  className="my-2 max-h-40 w-full object-cover rounded"
                />
              )}

              {listing.quantity && (
                <p>
                  <span className="font-semibold">Quantity:</span>{" "}
                  {listing.quantity}
                </p>
              )}
              {listing.expiry_date && (
                <p>
                  <span className="font-semibold">Expiry Date:</span>{" "}
                  {new Date(listing.expiry_date).toLocaleDateString()}
                </p>
              )}
              {listing.location && (
                <p>
                  <span className="font-semibold">Location:</span>{" "}
                  {listing.location}
                </p>
              )}

              {/* Toggle more details */}
              {expanded === listing.id && (
                <div className="mt-2 text-sm text-muted-foreground">
                  <p>{listing.description}</p>
                </div>
              )}
              <button
                className="mt-2 text-blue-600 text-sm underline"
                onClick={() =>
                  setExpanded(expanded === listing.id ? null : listing.id)
                }
              >
                {expanded === listing.id ? "Hide details" : "More details"}
              </button>

              {/* Accept button */}
              <button
                className="mt-3 bg-green-500 text-white px-4 py-2 rounded w-full"
                onClick={() => setSelectedListing(listing)}
              >
                Accept
              </button>

              {/* Confirmation Dialog */}
              {selectedListing?.id === listing.id && (
                <AlertDialog
                  open
                  onOpenChange={() => setSelectedListing(null)}
                >
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirm Food Pickup</AlertDialogTitle>
                      <AlertDialogDescription>
                        Would you like to take this food:{" "}
                        <span className="font-semibold">{listing.food_name}</span>?
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel onClick={() => setSelectedListing(null)}>
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleAccept(listing.id)}
                      >
                        Yes, Accept
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
