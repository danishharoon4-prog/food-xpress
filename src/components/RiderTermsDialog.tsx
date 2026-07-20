import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText } from 'lucide-react';

export const RIDER_TERMS_VERSION = 'v1.0-2026';

export const RIDER_TERMS_SECTIONS: { title: string; body: string }[] = [
  {
    title: '1. Eligibility & Documents',
    body: 'Rider ki umar 18 saal ya us se ziada honi chahiye. Valid CNIC, driving license, vehicle registration, personal photo aur police character certificate upload karna zaroori hai. Ghalat ya jaali documents par account permanent block kar diya jaye ga.',
  },
  {
    title: '2. Conduct & Safety',
    body: 'Rider hamesha traffic rules, helmet aur safe driving ka pabandi kare ga. Customer aur restaurant staff se izzat aur shaista lehja mein baat kare ga. Nashe ki halat mein delivery karna sakht mana hai.',
  },
  {
    title: '3. Order Handling',
    body: 'Assign hone ke bad order ko waqt par pickup aur deliver karna rider ki zimmedari hai. Order ke saath koi bhi tabdeeli, cheezon ka nikaalna ya khana istemal karna mana hai. Cash on delivery mein poori raqam customer se lena aur wallet mein reflect karana rider ki zimmedari hai.',
  },
  {
    title: '4. Earnings & Wallet',
    body: 'Earnings platform ke declared delivery pricing (PKR 150 up to 5KM, PKR 400 for >5KM) ke mutabiq calculate hongi. Cash orders se collect ki gayi COD amount system fee ke tor par wallet balance se adjust hoti hai. Withdrawal request approve hone ke bad process ki jayegi.',
  },
  {
    title: '5. Account Suspension',
    body: 'Bar bar cancellation, customer complaints, fake location, ya kisi bhi qism ki dhoka dahi par admin bina notice account suspend ya terminate kar sakta hai. Police record mein koi criminal case ho to account foran band kar diya jaye ga.',
  },
  {
    title: '6. Privacy & Data',
    body: 'Rider ki location, contact aur documents sirf verification, order assignment aur customer support ke liye use hongi. Rider apne documents ki authenticity ka zimmedar hai.',
  },
  {
    title: '7. Liability',
    body: 'Kisi bhi road accident, vehicle damage ya customer ke saath dispute ka rider khud zimmedar ho ga. Platform sirf orders ko facilitate karta hai aur koi employer-employee relationship qaim nahi karta.',
  },
  {
    title: '8. Agreement',
    body: 'In terms ko accept karne ke bad rider is baat ka iqrar karta hai ke us ne saari sharait parh li hain aur un par amal karega. Platform in terms ko waqt ke saath update kar sakta hai.',
  },
];

interface Props {
  onAccept: () => void | Promise<void>;
  accepted?: boolean;
  acceptedAt?: string | null;
  version?: string | null;
}

export function RiderTermsDialog({ onAccept, accepted, acceptedAt, version }: Props) {
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);

  const outdated = accepted && version !== RIDER_TERMS_VERSION;

  const handleAccept = async () => {
    setSaving(true);
    try {
      await onAccept();
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={accepted && !outdated ? 'outline' : 'default'} size="sm">
          <FileText className="w-4 h-4 mr-2" />
          {accepted && !outdated ? 'View Terms' : outdated ? 'Re-accept Updated Terms' : 'Read & Accept Terms'}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Rider Terms &amp; Conditions ({RIDER_TERMS_VERSION})</DialogTitle>
        </DialogHeader>
        <ScrollArea className="h-[55vh] pr-4">
          <div className="space-y-4 text-sm leading-relaxed">
            {RIDER_TERMS_SECTIONS.map((s) => (
              <div key={s.title}>
                <p className="font-semibold">{s.title}</p>
                <p className="text-muted-foreground">{s.body}</p>
              </div>
            ))}
          </div>
        </ScrollArea>
        {accepted && !outdated ? (
          <div className="text-xs text-muted-foreground">
            Accepted on {acceptedAt ? new Date(acceptedAt).toLocaleString() : '—'} (version {version}).
          </div>
        ) : (
          <label className="flex items-start gap-2 text-sm">
            <Checkbox checked={checked} onCheckedChange={(v) => setChecked(!!v)} className="mt-0.5" />
            <span>My ne tamam terms &amp; conditions parh li hain aur un se ittefaq karta/karti hun.</span>
          </label>
        )}
        <DialogFooter>
          {accepted && !outdated ? (
            <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
          ) : (
            <Button disabled={!checked || saving} onClick={handleAccept}>
              {saving ? 'Saving...' : 'Accept & Continue'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
