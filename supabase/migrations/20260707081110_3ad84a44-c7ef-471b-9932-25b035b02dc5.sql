CREATE OR REPLACE FUNCTION public.enforce_restaurant_approval_lock()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN RETURN NEW; END IF;
  IF NEW.approval_status IS DISTINCT FROM OLD.approval_status THEN
    RAISE EXCEPTION 'Only admins can change approval status';
  END IF;
  -- Owners are allowed to toggle is_active (open/close their own restaurant).
  -- Non-owners cannot reach this trigger anyway due to RLS.
  IF NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason THEN
    RAISE EXCEPTION 'Only admins can change rejection reason';
  END IF;
  IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
    RAISE EXCEPTION 'Owner cannot be changed';
  END IF;
  RETURN NEW;
END;
$function$;