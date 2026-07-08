
CREATE OR REPLACE FUNCTION public.get_top_selling_items(_limit integer DEFAULT 10)
RETURNS TABLE(
  id uuid,
  name text,
  price numeric,
  discount_price numeric,
  image_url text,
  is_deal boolean,
  deal_label text,
  restaurant_id uuid,
  restaurant_name text,
  restaurant_image text,
  total_sold bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT mi.id, mi.name, mi.price, mi.discount_price, mi.image_url,
         mi.is_deal, mi.deal_label,
         r.id, r.name, r.image_url,
         SUM(oi.quantity)::bigint AS total_sold
  FROM public.order_items oi
  JOIN public.orders o ON o.id = oi.order_id
  JOIN public.menu_items mi ON mi.id = oi.menu_item_id
  JOIN public.restaurants r ON r.id = mi.restaurant_id
  WHERE o.status = 'delivered'
    AND mi.is_available = true
    AND r.is_active = true
    AND r.approval_status = 'approved'
    AND o.created_at > now() - interval '60 days'
  GROUP BY mi.id, r.id
  ORDER BY total_sold DESC
  LIMIT COALESCE(_limit, 10)
$$;

CREATE OR REPLACE FUNCTION public.get_top_rated_restaurants(_limit integer DEFAULT 8)
RETURNS TABLE(
  id uuid,
  name text,
  image_url text,
  cuisine_type text,
  city text,
  avg_rating numeric,
  rating_count bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT r.id, r.name, r.image_url, r.cuisine_type, r.city,
         COALESCE(AVG(NULLIF(
           (COALESCE(rt.restaurant_rating,0) + COALESCE(rt.food_rating,0))::numeric
           / NULLIF(
               (CASE WHEN rt.restaurant_rating IS NOT NULL THEN 1 ELSE 0 END
              + CASE WHEN rt.food_rating IS NOT NULL THEN 1 ELSE 0 END),0),
         0)), 0)::numeric AS avg_rating,
         COUNT(rt.id)::bigint AS rating_count
  FROM public.restaurants r
  LEFT JOIN public.ratings rt ON rt.restaurant_id = r.id
  WHERE r.is_active = true AND r.approval_status = 'approved'
  GROUP BY r.id
  HAVING COUNT(rt.id) > 0
  ORDER BY avg_rating DESC, rating_count DESC
  LIMIT COALESCE(_limit, 8)
$$;

GRANT EXECUTE ON FUNCTION public.get_top_selling_items(integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_top_rated_restaurants(integer) TO anon, authenticated;
