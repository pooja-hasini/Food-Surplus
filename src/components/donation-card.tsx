import Image from 'next/image';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Donation } from '@/lib/types';
import { Clock, Users, MapPin } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface DonationCardProps {
  donation: Donation;
  showLocation?: boolean;
}

export function DonationCard({ donation, showLocation = false }: DonationCardProps) {
  const getStatusVariant = (status?: string) => {
    if (!status) return 'outline';
    if (status === 'completed') return 'default';
    if (status === 'taken') return 'destructive';
    if (status.toLowerCase().startsWith('expired')) return 'destructive';
    return 'outline';
  };

  const formatStatusText = (status?: string) => {
    if (!status) return 'Pending';
    if (status === 'completed') return 'Completed';
    if (status === 'taken') return 'Taken';
    if (status.toLowerCase().startsWith('expired')) return 'Expired';
    // fallback: capitalize
    return String(status)
      .split(/\s+/)
      .map(s => s.charAt(0).toUpperCase() + s.slice(1))
      .join(' ');
  };

  const expiryText = formatDistanceToNow(donation.expiryTime, { addSuffix: true });

  return (
    <Card className="overflow-hidden transition-shadow duration-300 hover:shadow-lg">
      <CardHeader className="p-0">
        <div className="relative h-48 w-full">
          <Image
            src={donation.photoUrl}
            alt={donation.foodName}
            layout="fill"
            objectFit="cover"
            data-ai-hint="food donation"
          />
        </div>
      </CardHeader>
      <CardContent className="p-4">
    <div className="flex items-start justify-between gap-2">
      <CardTitle className="text-lg font-bold">{donation.foodName}</CardTitle>
      {/** derive status from DB status or legacy taken flag */}
      <Badge variant={getStatusVariant(donation.status ?? 'pending')} className="capitalize shrink-0">
        {formatStatusText(donation.status ?? 'pending')}
      </Badge>
    </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {donation.tags.map(tag => (
            <Badge key={tag} variant="outline" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>
        <div className="mt-4 space-y-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <span>Serves {donation.quantity} people</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            <span>Expires {expiryText}</span>
          </div>
          {showLocation && (
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              <span>{donation.location}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
