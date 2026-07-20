# Security Hardening Plan

Char aham security features add karenge takay admin/website hacking attempts detect aur block ho sakein.

---

## 1. Admin Audit Log (kis ne kya kiya, kab kiya)

**Database:**
- New table `admin_audit_logs` (actor_id, actor_email, action, target_type, target_id, details JSONB, ip_address, user_agent, created_at)
- RLS: sirf admins padh sakte hain, koi bhi insert nahi kar sakta directly — sirf `log_admin_action()` SECURITY DEFINER function ke through.
- Existing admin RPC functions (`admin_set_user_ban`, `admin_set_user_role`, `approve_restaurant`, `cancel_order` when by admin, `apply_restaurant_location_change`) mein audit entries automatically likhenge.

**UI:**
- New admin page `/admin/audit-log` — filter by admin, action type, date range. Har entry pe details expand.
- Sidebar mein "Audit Log" link (Shield icon).

---

## 2. Login Alerts (naya device / naya IP)

**Database:**
- New table `login_history` (user_id, ip_address, user_agent, device_fingerprint, city, created_at)
- Edge function `log-login` — client login ke baad call karega, IP + UA log karega, aur agar previous 30 din mein yeh device/IP nahi dekha to notification bhejega ("New login detected from ...").
- Notification `notifications` table mein jayegi (existing push infra automatically deliver karegi).

**UI:**
- `AuthContext` sign-in success ke baad `log-login` invoke karega.
- New page `/settings/security` — recent logins list (last 20), current session highlight, "Sign out all other sessions" button.

---

## 3. MFA (2-Factor Authentication) — TOTP

**Backend:** Supabase Auth ka built-in TOTP MFA use karenge (koi extra secret nahi chahiye).

**UI (Settings → Security tab):**
- "Enable 2FA" button → QR code display → user Google Authenticator/Authy scan kare → 6-digit code verify → MFA enrolled.
- Admins ke liye MFA **strongly recommended** banner login ke baad, jab tak enroll na karein.
- Login flow update: agar user MFA enabled hai to password ke baad 6-digit code prompt aayega.
- "Disable 2FA" (password re-verify ke sath).

---

## 4. Auto Session Timeout (idle logout)

- `AuthContext` mein idle timer add karenge. Default: **30 minutes inactivity** (mousemove/keydown/touchstart reset karta hai).
- Timeout se 1 min pehle toast: "Aap idle hain — 60 seconds mein sign out ho jayenge."
- Setting configurable in `/settings/security` (15 / 30 / 60 min / never — never sirf non-admin).
- Admins ke liye max 30 min force.

---

## 5. Bonus: HIBP Password Check

- `configure_auth` tool se leaked password protection enable karenge — signup/password change ke waqt HIBP database check hoga.

---

## Files (new + edited)

**New:**
- Migration: `admin_audit_logs`, `login_history` tables + `log_admin_action()` function + updates to existing admin RPCs
- Edge function: `supabase/functions/log-login/index.ts`
- Pages: `src/pages/admin/AdminAuditLog.tsx`, `src/pages/SecuritySettings.tsx`
- Components: `src/components/security/MfaEnrollDialog.tsx`, `src/components/security/RecentLoginsCard.tsx`, `src/components/security/IdleTimeoutManager.tsx`

**Edited:**
- `src/contexts/AuthContext.tsx` — log-login invoke, MFA challenge flow, idle timer wiring
- `src/pages/Auth.tsx` — MFA code prompt after password
- `src/App.tsx` — routes for `/admin/audit-log` and `/settings/security`
- `src/components/AdminLayout.tsx` — sidebar link
- Admin RPCs — insert into `admin_audit_logs`

---

## Order of implementation

1. Migration (tables, functions, updated RPCs)
2. `log-login` edge function
3. AuthContext (login logging + idle timer + MFA flow)
4. Security Settings page (MFA + recent logins + timeout preference)
5. Auth.tsx MFA prompt
6. Admin Audit Log page
7. Enable HIBP via `configure_auth`

Approve karo to migration se start karun.
