ALTER TABLE public.orders
  ALTER COLUMN customer_id DROP NOT NULL;

ALTER TABLE public.ratings
  ALTER COLUMN customer_id DROP NOT NULL;