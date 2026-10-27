CREATE OR REPLACE FUNCTION public.admin_assign_restaurant_owner(_restaurant_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF _user_id IS NOT NULL THEN
    IF public.has_role(_user_id, 'admin'::app_role) THEN RAISE EXCEPTION 'Admin accounts cannot own a restaurant'; END IF;
    DELETE FROM public.user_roles WHERE user_id = _user_id AND role <> 'restaurant'::app_role;
    INSERT INTO public.user_roles (user_id, role) SELECT _user_id, 'restaurant'::app_role
      WHERE NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'restaurant'::app_role);
  END IF;
  UPDATE public.restaurants SET owner_id = _user_id, updated_at = now() WHERE id = _restaurant_id;
  PERFORM public.log_admin_action('restaurant.owner_assigned','restaurant',_restaurant_id::text, jsonb_build_object('owner_id',_user_id));
  RETURN true;
END; $$;
REVOKE ALL ON FUNCTION public.admin_assign_restaurant_owner(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_assign_restaurant_owner(uuid, uuid) TO authenticated;