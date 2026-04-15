-- Add a default to order_number so PostgREST doesn't reject the insert before the trigger fires
ALTER TABLE public.orders ALTER COLUMN order_number SET DEFAULT '';