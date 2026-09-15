# Mobile Browse Layout Update

## Changes
- Mobile Browse page par restaurant cards ko two-column grid se compact vertical list mein convert karna.
- Har restaurant row mein fixed-size thumbnail, name, rating, cuisine, timing aur short address dikhana.
- Tablet/desktop par existing multi-column grid ko preserve karna.
- 380–420px mobile widths par heading, search, filters, section spacing aur controls ko compact responsive sizing dena.
- Loading placeholders ko bhi mobile list layout ke mutabiq update karna.

## Verification
- 380px aur 420px widths par Browse page check karna.
- Text overflow, image proportions, filters, favorite button aur restaurant navigation verify karna.

## Technical details
- Responsive Tailwind breakpoints se mobile-only list aur `md` se existing grid layout use hoga.
- Thumbnail fixed aspect/size rakhega taake rows stable rahen aur large cards dobara na banen.
- Global scaling change nahi hoga; targeted mobile sizing se baqi desktop screens unaffected rahengi.
