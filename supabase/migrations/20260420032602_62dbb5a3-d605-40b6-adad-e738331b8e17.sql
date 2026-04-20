
-- Update handle_new_user to default city to Mansehra
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone, city)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', 'User'),
    NEW.email,
    NEW.raw_user_meta_data ->> 'phone',
    'Mansehra'
  );
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE((NEW.raw_user_meta_data ->> 'role')::app_role, 'customer'));
  
  RETURN NEW;
END;
$function$;

-- Backfill all existing profiles to Mansehra
UPDATE public.profiles SET city = 'Mansehra' WHERE city IS DISTINCT FROM 'Mansehra';
