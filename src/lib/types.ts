export type DonationStatus = 'pending' | 'taken';

export interface Donation {
  id: string;
  foodName: string;
  expiryTime: Date;
  quantity: number; // For how many people
  location: string;
  photoUrl: string; // URL of the photo
  tags: string[];
  status: DonationStatus;
  donorId: string; // to associate with a donor
}
