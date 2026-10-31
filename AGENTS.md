# Architecture rules
- Menu items reference `shared_menu_categories` through `category_id`; use the same catalogue in every restaurant and retain the deprecated per-restaurant category table only for legacy data.
- Category deletion uses the database foreign key's `ON DELETE SET NULL`, so all affected menu items survive without client-side cross-restaurant updates.