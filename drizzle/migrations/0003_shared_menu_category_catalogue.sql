CREATE TABLE public.shared_menu_categories (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 name text NOT NULL CHECK (length(btrim(name)) > 0),
 display_order integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.shared_menu_categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shared_menu_categories TO authenticated;
GRANT ALL ON public.shared_menu_categories TO service_role;
ALTER TABLE public.shared_menu_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public shared category catalogue" ON public.shared_menu_categories FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins and restaurant owners manage shared categories" ON public.shared_menu_categories FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') OR EXISTS (SELECT 1 FROM public.get_owned_restaurant_id(auth.uid()))) WITH CHECK (public.has_role(auth.uid(), 'admin') OR EXISTS (SELECT 1 FROM public.get_owned_restaurant_id(auth.uid())));
INSERT INTO public.shared_menu_categories (id,name,display_order,created_at)
SELECT DISTINCT ON (lower(regexp_replace(btrim(name), '\s+', '', 'g'))) id,btrim(name),COALESCE(display_order,0),created_at
FROM public.menu_categories ORDER BY lower(regexp_replace(btrim(name), '\s+', '', 'g')),created_at,id;
UPDATE public.menu_items i SET category_id = s.id FROM public.menu_categories c, public.shared_menu_categories s WHERE i.category_id=c.id AND lower(regexp_replace(btrim(c.name), '\s+', '', 'g'))=lower(regexp_replace(btrim(s.name), '\s+', '', 'g'));
ALTER TABLE public.menu_items DROP CONSTRAINT menu_items_category_id_fkey;
ALTER TABLE public.menu_items ADD CONSTRAINT menu_items_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.shared_menu_categories(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX shared_menu_categories_unique_name ON public.shared_menu_categories (lower(regexp_replace(btrim(name), '\s+', '', 'g')));
COMMENT ON TABLE public.menu_categories IS 'DEPRECATED: replaced by shared_menu_categories; retained for legacy data only.';