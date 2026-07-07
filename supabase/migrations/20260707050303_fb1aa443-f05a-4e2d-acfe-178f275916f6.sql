
DROP FUNCTION IF EXISTS public.update_rider_payment_info(text,text,text,text,text);

CREATE OR REPLACE FUNCTION public.update_rider_payment_info(
  _bank_name text,
  _account_number text,
  _account_title text,
  _easypaisa_number text,
  _jazzcash_number text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE _rider_id uuid;
BEGIN
  SELECT id INTO _rider_id FROM public.riders WHERE user_id = auth.uid() LIMIT 1;
  IF _rider_id IS NULL THEN RAISE EXCEPTION 'Not a rider'; END IF;
  UPDATE public.rider_wallets
  SET bank_name        = _bank_name,
      account_number   = _account_number,
      account_title    = _account_title,
      easypaisa_number = _easypaisa_number,
      jazzcash_number  = _jazzcash_number,
      updated_at       = now()
  WHERE rider_id = _rider_id;
  RETURN true;
END;
$$;
GRANT EXECUTE ON FUNCTION public.update_rider_payment_info(text,text,text,text,text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.update_rider_payment_info(text,text,text,text,text) FROM anon;
