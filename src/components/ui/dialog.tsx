'use client';

import * as React from 'react';
import * as D from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

function Overlay({ className, ...props }: React.ComponentProps<typeof D.Overlay>) {
  return (
    <D.Overlay
      className={cn('fixed inset-0 z-50 bg-navy/40 backdrop-blur-[2px] animate-fade-in', className)}
      {...props}
    />
  );
}

/** Ortada açılan pencere. Mobilde alttan yükselen sayfaya dönüşür. */
export function DialogContent({
  className,
  children,
  title,
  description,
  size = 'md',
  ...props
}: React.ComponentProps<typeof D.Content> & {
  title: string;
  description?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const width = { sm: 'sm:max-w-sm', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl' }[size];
  return (
    <D.Portal>
      <Overlay />
      <D.Content
        className={cn(
          'fixed inset-x-0 bottom-0 z-50 max-h-[92dvh] overflow-y-auto rounded-t-3xl bg-surface shadow-pop animate-sheet-in',
          'sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-[calc(100vw-2rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:animate-scale-in',
          width,
          className,
        )}
        {...props}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-line bg-surface/95 px-5 py-4 backdrop-blur">
          <div className="min-w-0">
            <D.Title className="text-[17px] font-semibold text-navy">{title}</D.Title>
            {description ? (
              <D.Description className="mt-0.5 text-[13px] text-ink-3">{description}</D.Description>
            ) : (
              <D.Description className="sr-only">{title}</D.Description>
            )}
          </div>
          <D.Close
            className="-mr-1.5 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-ink-3 transition hover:bg-sunken hover:text-navy"
            aria-label="Kapat"
          >
            <X size={18} aria-hidden />
          </D.Close>
        </div>
        <div className="px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-5">{children}</div>
      </D.Content>
    </D.Portal>
  );
}

/** Yandan (masaüstü) / alttan (mobil) açılan detay paneli. */
export function SheetContent({
  className,
  children,
  title,
  description,
  ...props
}: React.ComponentProps<typeof D.Content> & { title: string; description?: string }) {
  return (
    <D.Portal>
      <Overlay />
      <D.Content
        className={cn(
          'fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-3xl bg-surface shadow-pop animate-sheet-in',
          'sm:inset-y-0 sm:left-auto sm:right-0 sm:h-full sm:max-h-none sm:w-[440px] sm:rounded-none sm:rounded-l-3xl sm:animate-sheet-in-right',
          className,
        )}
        {...props}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <D.Title className="text-[17px] font-semibold text-navy">{title}</D.Title>
            {description ? (
              <D.Description className="mt-0.5 text-[13px] text-ink-3">{description}</D.Description>
            ) : (
              <D.Description className="sr-only">{title}</D.Description>
            )}
          </div>
          <D.Close
            className="-mr-1.5 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-ink-3 transition hover:bg-sunken hover:text-navy"
            aria-label="Kapat"
          >
            <X size={18} aria-hidden />
          </D.Close>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {children}
        </div>
      </D.Content>
    </D.Portal>
  );
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
      {...props}
    />
  );
}
