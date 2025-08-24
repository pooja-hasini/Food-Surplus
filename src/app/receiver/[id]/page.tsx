'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDonations } from '@/context/DonationsContext';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Clock, Users, MapPin, CheckCircle, AlertTriangle, Loader2, HandHeart } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

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

  useEffect(() => {
    if (donation) {
      setIsTaken(donation.status === 'taken');
    }
  }, [donation]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isConfirming) {
      timer = setTimeout(() => {
        setIsConfirming(false);
      }, 3000); // Reset confirmation after 3 seconds
    }
    return () => clearTimeout(timer);
  }, [isConfirming]);

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
        title: "Successfully Claimed!",
        description: "You have claimed this food donation.",
      });
    }, 1000); // Simulate network delay
  };

  if (!donation) {
    return (
      <div className="container py-8 text-center">
        <AlertTriangle className="mx-auto h-12 w-12 text-destructive" />
        <h1 className="mt-4 text-2xl font-bold">Donation not found</h1>
        <p className="text-muted-foreground">This donation may have been removed or the link is incorrect.</p>
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
       <Button variant="ghost" onClick={() => router.back()} className="mb-4">
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
                data-ai-hint="donated food"
                />
            </div>
            <div className="p-6 md:p-8 flex flex-col">
                <div className="flex-grow">
                    <Badge variant={isTaken ? "secondary" : "default"} className="capitalize mb-2">
                        {donation.status}
                    </Badge>
                    <h1 className="text-3xl font-bold tracking-tight">{donation.foodName}</h1>
                    <div className="mt-2 flex flex-wrap gap-2">
                    {donation.tags.map(tag => (
                        <Badge key={tag} variant="outline">{tag}</Badge>
                    ))}
                    </div>

                    <div className="mt-6 space-y-4 text-muted-foreground">
                        <div className="flex items-start gap-3">
                            <Users className="h-5 w-5 flex-shrink-0 text-primary mt-1" />
                            <span>Serves approximately <span className="font-bold text-foreground">{donation.quantity}</span> people.</span>
                        </div>
                        <div className="flex items-start gap-3">
                            <Clock className="h-5 w-5 flex-shrink-0 text-primary mt-1" />
                            <span>Best before <span className="font-bold text-foreground">{format(donation.expiryTime, 'PPP')}</span>.</span>
                        </div>
                        <div className="flex items-start gap-3">
                            <MapPin className="h-5 w-5 flex-shrink-0 text-primary mt-1" />
                            <span>Available at: <span className="font-bold text-foreground">{donation.location}</span>.</span>
                        </div>
                    </div>
                </div>
                
                <div className="mt-8">
                    <Button onClick={handleTakeFood} size="lg" className="w-full transition-all" disabled={isTaken || isProcessing} variant={isConfirming ? "destructive" : "default"}>
                        {isProcessing && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                        {isTaken && <CheckCircle className="mr-2 h-5 w-5" />}
                        {!isTaken && !isProcessing && <HandHeart className="mr-2 h-5 w-5" />}
                        {buttonText}
                    </Button>
                    {isConfirming && <p className="text-center text-sm mt-2 text-destructive-foreground">Click again to confirm. This action cannot be undone.</p>}
                </div>
            </div>
        </div>
      </Card>
    </div>
  );
}
