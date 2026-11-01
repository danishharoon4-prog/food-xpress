# Shared menu categories
- [x] Stop live-update reloads on restaurant profile and preserve form/photo edits; regression tests pass.
- [x] Wire Food Express notification branding into Android builds and web notifications; local logo loading verified.
- [ ] Verify restaurant creation on a signed-in phone and notification appearance in rebuilt APK — blocked: no matching preview account or Android device session.
- [x] Consolidate existing categories into a shared list without losing menu items (zero broken references).
- [x] Update admin, restaurant, and customer menus to use the shared list; customer filtering verified.
- [x] Include shared categories in backups; category service tests pass.
- [ ] Verify admin/restaurant category add and remove through authenticated UI — blocked: requesting user has no matching preview account; sign-in required.