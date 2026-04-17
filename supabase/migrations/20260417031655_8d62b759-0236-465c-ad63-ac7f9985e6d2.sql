ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS city text;
CREATE INDEX IF NOT EXISTS idx_restaurants_city ON public.restaurants (city);
CREATE INDEX IF NOT EXISTS idx_profiles_city ON public.profiles (city);