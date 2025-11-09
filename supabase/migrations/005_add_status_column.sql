-- Add status column to food_listings and backfill values
ALTER TABLE public.food_listings
ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';

-- Backfill: mark taken rows
UPDATE public.food_listings
SET status = 'taken'
WHERE taken = true;

-- Backfill: mark expired rows (not taken)
UPDATE public.food_listings
SET status = 'expired (Not accepted)'
WHERE expiry_date < now()
  AND taken = false;

-- If your schema has a 'completed' boolean column, mark those as completed
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'food_listings' AND column_name = 'completed') THEN
    UPDATE public.food_listings
    SET status = 'completed'
    WHERE completed = true;
  END IF;
END$$;
