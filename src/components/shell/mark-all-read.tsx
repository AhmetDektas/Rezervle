'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { markNotificationsReadAction } from '@/app/actions/customer';

export function MarkAllRead() {
  const [pending, setPending] = React.useState(false);
  const router = useRouter();
  const toast = useToast();

  async function run() {
    setPending(true);
    const result = await markNotificationsReadAction();
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <Button variant="secondary" size="sm" onClick={run} loading={pending}>
      <CheckCheck size={15} aria-hidden />
      Tümünü okundu işaretle
    </Button>
  );
}
