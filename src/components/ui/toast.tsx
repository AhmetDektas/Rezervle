'use client';

import * as React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type Tone = 'success' | 'error' | 'info';
type Toast = { id: number; tone: Tone; title: string; body?: string };

type Ctx = {
  push: (t: Omit<Toast, 'id'>) => void;
  success: (title: string, body?: string) => void;
  error: (title: string, body?: string) => void;
  info: (title: string, body?: string) => void;
};

const ToastContext = React.createContext<Ctx | null>(null);

export function useToast(): Ctx {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error('useToast, ToastProvider içinde kullanılmalı');
  return ctx;
}

const ICON: Record<Tone, React.ElementType> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<Toast[]>([]);
  const seq = React.useRef(0);

  const remove = React.useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = React.useCallback(
    (t: Omit<Toast, 'id'>) => {
      const id = ++seq.current;
      setItems((prev) => [...prev.slice(-2), { ...t, id }]);
      window.setTimeout(() => remove(id), t.tone === 'error' ? 6000 : 4000);
    },
    [remove],
  );

  const value = React.useMemo<Ctx>(
    () => ({
      push,
      success: (title, body) => push({ tone: 'success', title, ...(body ? { body } : {}) }),
      error: (title, body) => push({ tone: 'error', title, ...(body ? { body } : {}) }),
      info: (title, body) => push({ tone: 'info', title, ...(body ? { body } : {}) }),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--tabbar-h)+12px)] z-[100] flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:left-auto sm:right-6 sm:items-end"
        role="region"
        aria-label="Bildirimler"
      >
        {items.map((t) => {
          const Icon = ICON[t.tone];
          return (
            <div
              key={t.id}
              role="status"
              aria-live={t.tone === 'error' ? 'assertive' : 'polite'}
              className={cn(
                'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border bg-surface p-3.5 shadow-pop animate-slide-up',
                t.tone === 'success' && 'border-success-line',
                t.tone === 'error' && 'border-danger-line',
                t.tone === 'info' && 'border-line-strong',
              )}
            >
              <Icon
                size={18}
                className={cn(
                  'mt-0.5 shrink-0',
                  t.tone === 'success' && 'text-success',
                  t.tone === 'error' && 'text-danger',
                  t.tone === 'info' && 'text-brand-500',
                )}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-medium text-navy">{t.title}</p>
                {t.body ? <p className="mt-0.5 text-[13px] text-ink-3">{t.body}</p> : null}
              </div>
              <button
                onClick={() => remove(t.id)}
                className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-3 transition hover:bg-sunken"
                aria-label="Bildirimi kapat"
              >
                <X size={15} aria-hidden />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
