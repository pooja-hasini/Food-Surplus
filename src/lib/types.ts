export type DonationStatus = 'pending' | 'taken';

export interface Donation {
  id: string;
  foodName: string;
  expiryTime: Date;
  quantity: number; // For how many people
  location: string;
  latitude: number;
  longitude: number;
  photoUrl: string; // URL of the photo
  tags: string[];
  status: DonationStatus;
  donorId: string; // to associate with a donor
}

export interface Conversation {
  id: string;
  donation_id: string;
  donor_id: string;
  receiver_id: string | null;
  donor_complete: boolean;
  receiver_complete: boolean;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}
