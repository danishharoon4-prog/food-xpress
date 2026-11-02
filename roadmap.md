# Shared menu categories
- [x] Add mandatory Android version update notice with active APK downloads and version-comparison tests; 7 tests pass, website unaffected.
- [ ] Verify actual Android update installation — blocked: no Android device; publish website and upload/activate rebuilt APK with its app-version.json build code (legacy release has no verified code).
- [x] Stop live-update reloads on restaurant profile and preserve form/photo edits; regression tests pass.
- [x] Wire Food Express notification branding into Android builds and web notifications; local logo loading verified.
- [ ] Verify restaurant creation on a signed-in phone and notification appearance in rebuilt APK — blocked: no matching preview account or Android device session.
- [x] Consolidate existing categories into a shared list without losing menu items (zero broken references).
- [x] Update admin, restaurant, and customer menus to use the shared list; customer filtering verified.
- [x] Include shared categories in backups; category service tests pass.
- [ ] Verify admin/restaurant category add and remove through authenticated UI — blocked: requesting user has no matching preview account; sign-in required.