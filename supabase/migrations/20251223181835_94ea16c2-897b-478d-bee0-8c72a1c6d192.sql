-- Add explicit UPDATE policy for riders to update only their own wallet payment details
CREATE POLICY "Riders can update own wallet payment info" 
ON public.rider_wallets 
FOR UPDATE 
USING (rider_id IN (SELECT id FROM riders WHERE user_id = auth.uid()))
WITH CHECK (rider_id IN (SELECT id FROM riders WHERE user_id = auth.uid()));