import { useEffect, useId, useRef, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CloseIcon } from './Icon';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  width?: 'sm' | 'md' | 'lg';
}

const widthClass = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
};

export function Modal({ open, onClose, title, description, children, width = 'md' }: ModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  /**
   * `aria-modal` tells a screen reader that everything behind this panel is
   * inert, which is only true if focus is actually inside it. Without this,
   * opening a dialog left the keyboard on whatever button was pressed, and
   * the next Tab walked the page underneath. Focus moves to the first
   * focusable control in the panel on open, and returns to the element that
   * opened it on close, so a keyboard user does not lose their place.
   */
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    (first ?? panel)?.focus();
    return () => {
      if (opener && typeof opener.focus === 'function') opener.focus();
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-start justify-center px-6 py-16 overflow-y-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <motion.div
            aria-hidden="true"
            className="absolute inset-0 bg-navy-950/70 backdrop-blur-sm"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descriptionId : undefined}
            tabIndex={-1}
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className={`glass-card relative w-full ${widthClass[width]} p-6`}
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-white/5 transition-colors"
              aria-label="Close"
            >
              <CloseIcon size={18} />
            </button>
            <h2 id={titleId} className="font-display text-xl font-semibold text-white mb-1 pr-8">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="text-slate-400 text-sm mb-5">
                {description}
              </p>
            )}
            {!description && <div className="mb-5" />}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
