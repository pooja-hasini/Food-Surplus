-- Mark all listings as expired if their expiry_date is in the past and not already taken or expired
UPDATE public.food_listings
SET status = 'expired (Not accepted)'
WHERE expiry_date < now()
  AND (status IS NULL OR status != 'expired (Not accepted)')
  AND taken = false;
