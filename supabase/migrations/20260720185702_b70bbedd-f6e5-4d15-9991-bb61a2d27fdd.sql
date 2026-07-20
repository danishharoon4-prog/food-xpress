
-- Performance indexes for hot query paths
CREATE INDEX IF NOT EXISTS idx_restaurants_active_name ON public.restaurants (is_active, name) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_restaurants_approval_active ON public.restaurants (approval_status, is_active);
CREATE INDEX IF NOT EXISTS idx_restaurants_city ON public.restaurants (city);
CREATE INDEX IF NOT EXISTS idx_restaurants_owner ON public.restaurants (owner_id);

CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant_available ON public.menu_items (restaurant_id, is_available);
CREATE INDEX IF NOT EXISTS idx_menu_items_category ON public.menu_items (category_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_deal ON public.menu_items (is_deal, is_available) WHERE is_deal = true;

CREATE INDEX IF NOT EXISTS idx_orders_customer_created ON public.orders (customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_status ON public.orders (restaurant_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_rider_status ON public.orders (rider_id, status) WHERE rider_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON public.orders (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_menu ON public.order_items (menu_item_id);

CREATE INDEX IF NOT EXISTS idx_ratings_restaurant ON public.ratings (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_ratings_rider ON public.ratings (rider_id) WHERE rider_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ratings_order ON public.ratings (order_id);

CREATE INDEX IF NOT EXISTS idx_riders_online_verified ON public.riders (is_online, is_verified) WHERE is_online = true;
CREATE INDEX IF NOT EXISTS idx_riders_user ON public.riders (user_id);

CREATE INDEX IF NOT EXISTS idx_profiles_city ON public.profiles (city);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications (user_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_favorites_user ON public.favorite_restaurants (user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON public.user_roles (user_id);
CREATE INDEX IF NOT EXISTS idx_menu_categories_restaurant ON public.menu_categories (restaurant_id);

ANALYZE public.restaurants;
ANALYZE public.menu_items;
ANALYZE public.orders;
ANALYZE public.ratings;
ANALYZE public.riders;
ANALYZE public.profiles;
