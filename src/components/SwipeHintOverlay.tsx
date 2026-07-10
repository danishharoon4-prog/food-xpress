import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type HintDetail = { dir: 'left' | 'right' | null; progress: number; label: string | null };

function friendly(path: string) {
  const seg = path.split('/').filter(Boolean).pop() || 'Home';
  return seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, ' ');
}

export function SwipeHintOverlay() {
  const [hint, setHint] = useState<HintDetail>({ dir: null, progress: 0, label: null });

  useEffect(() => {
    const onHint = (e: Event) => setHint((e as CustomEvent<HintDetail>).detail);
    window.addEventListener('swipe-nav-hint', onHint);
    return () => window.removeEventListener('swipe-nav-hint', onHint);
  }, []);

  if (!hint.dir || !hint.label) return null;

  const isLeftSwipe = hint.dir === 'left'; // finger moves left → shows on right edge (next tab)
  const ready = hint.progress >= 1;
  const opacity = 0.35 + hint.progress * 0.6;
  const translate = (1 - hint.progress) * 24;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[9999] flex items-center"
      style={{ justifyContent: isLeftSwipe ? 'flex-end' : 'flex-start' }}
      aria-hidden
    >
      <div
        className={`flex items-center gap-2 px-3 py-2 rounded-full shadow-lg backdrop-blur-md transition-colors ${
          ready ? 'bg-primary text-primary-foreground' : 'bg-background/80 text-foreground border border-border'
        }`}
        style={{
          opacity,
          transform: `translateX(${isLeftSwipe ? translate : -translate}px)`,
          margin: '0 12px',
        }}
      >
        {isLeftSwipe ? (
          <>
            <span className="text-xs font-medium max-w-[140px] truncate">{friendly(hint.label)}</span>
            <ChevronRight className="w-4 h-4" />
          </>
        ) : (
          <>
            <ChevronLeft className="w-4 h-4" />
            <span className="text-xs font-medium max-w-[140px] truncate">{friendly(hint.label)}</span>
          </>
        )}
      </div>
    </div>
  );
}
