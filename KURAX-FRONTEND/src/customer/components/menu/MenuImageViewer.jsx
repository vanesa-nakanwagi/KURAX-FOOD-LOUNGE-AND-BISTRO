import { useEffect } from 'react';
import { X } from 'lucide-react';

export default function MenuImageViewer({ src, alt, onClose }) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = event => {
      if (event.key === 'Escape') onClose();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/90 p-4 md:p-8"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={`${alt || 'Menu item'} full-size image`}
        className="relative flex max-h-full w-full max-w-6xl flex-col items-center"
      >
        <div className="mb-3 flex w-full items-center justify-between gap-4 text-white">
          <p className="truncate text-sm font-semibold">{alt}</p>
          <button
            type="button"
            autoFocus
            onClick={onClose}
            aria-label="Close full-size image"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/30 bg-black/40 text-white transition hover:bg-white hover:text-black"
          >
            <X size={20} />
          </button>
        </div>
        <img
          src={src}
          alt={alt}
          className="max-h-[82dvh] max-w-full rounded-md object-contain"
        />
      </section>
    </div>
  );
}