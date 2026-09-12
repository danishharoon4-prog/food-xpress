# Mobile App Fixes Plan

## 1. Cheezicous menu reliability
- Menu loading ko smaller paged requests mein divide karunga, taake 98 items ek heavy request mein fail ya freeze na hon.
- Restaurant aur categories pehle show hongi; menu items progressive batches mein render honge.
- Clear retry aur empty/error state rakhenge, aur category filter items ke load ke sath stable rahega.

## 2. Keyboard ke waqt bottom menu
- Mobile keyboard open detect karunga aur us waqt bottom navigation temporarily hide hogi.
- Keyboard close hote hi navigation asli screen bottom par wapas fixed hogi.
- Bottom spacing Android navigation bar ke safe area ko include karegi.

## 3. Status bar aur system navigation safe area
- App ka top content status bar/time ke neeche start hoga.
- Bottom navigation Android system navigation bar ke upar rahegi.
- Global safe-area layout customer, rider, restaurant aur admin mobile views par apply hoga, bina desktop layout badle.

## Technical details
- `visualViewport` based keyboard state hook/component use hoga, Android WebView compatible fallback ke sath.
- CSS `env(safe-area-inset-top/bottom)` and stable app-height variables use hongi.
- Capacitor config mein system-bar overlap behavior explicitly disable/configure hoga where supported.
- Cheezicous flow ko mobile viewport par open, category switch, search keyboard, and fixed navigation states ke sath verify karunga.
