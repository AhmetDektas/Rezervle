'use client';

import * as React from 'react';
import { Dialog, DialogContent, DialogFooter, DialogClose } from './dialog';
import { Button } from './button';

/** Geri alınamaz işlemler için onay penceresi. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Onayla',
  cancelLabel = 'Vazgeç',
  tone = 'danger',
  loading,
  onConfirm,
  children,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
  loading?: boolean;
  onConfirm: () => void;
  children?: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={title} {...(description ? { description } : {})} size="sm">
        {children}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary" type="button">
              {cancelLabel}
            </Button>
          </DialogClose>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            onClick={onConfirm}
            loading={loading ?? false}
            type="button"
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
