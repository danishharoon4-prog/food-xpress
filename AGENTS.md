# Architecture rules
- Native push tokens transfer through an authenticated, caller-scoped registration RPC; detach before sign-out and install listeners before registering so shared devices cannot retain the previous account or miss token events.
- Menu items reference `shared_menu_categories` through `category_id`; use the same catalogue in every restaurant and retain the deprecated per-restaurant category table only for legacy data.
- Category deletion uses the database foreign key's `ON DELETE SET NULL`, so all affected menu items survive without client-side cross-restaurant updates.
- Native live updates must not reload restaurant profile creation/editing, and must recheck safety after fetching deployment metadata, so camera/gallery resumes cannot discard edits.
- Restaurant profile fields hydrate once per identity, not on realtime row refreshes, to preserve unsaved edits; asynchronous photo callbacks use functional updates.
- Android builds package notification drawables and a Firebase default icon; use monochrome small icons and separate branded large icons because Android masks status-bar icons.
- Mandatory Android updates compare App.getInfo().build against the active app_releases.version_code, never display-version strings; unverified legacy releases cannot block users. CI exports matching APK version metadata for admin uploads.