'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { addCustomerNoteAction, toggleCustomerTagAction } from '@/app/actions/panel';
import { cn } from '@/lib/utils';

export function CustomerNoteForm({
  slug,
  businessId,
  customerId,
}: {
  slug: string;
  businessId: string;
  customerId: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [body, setBody] = React.useState('');
  const [pending, setPending] = React.useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    const result = await addCustomerNoteAction(slug, businessId, customerId, body);
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setBody('');
    toast.success('Not eklendi');
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Yalnızca ekibinizin göreceği bir not yazın…"
        aria-label="Müşteri notu"
        maxLength={1000}
      />
      <Button type="submit" size="sm" loading={pending} disabled={body.trim().length < 2}>
        <Send size={14} aria-hidden />
        Not ekle
      </Button>
    </form>
  );
}

export function CustomerTags({
  slug,
  businessId,
  customerId,
  tags,
}: {
  slug: string;
  businessId: string;
  customerId: string;
  tags: { id: string; name: string; tone: string; attached: boolean }[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = React.useState<string | null>(null);

  async function toggle(tagId: string) {
    setPending(tagId);
    const result = await toggleCustomerTagAction(slug, businessId, customerId, tagId);
    setPending(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    router.refresh();
  }

  if (tags.length === 0) return <p className="text-[13px] text-ink-3">Tanımlı etiket yok.</p>;

  return (
    <ul className="flex flex-wrap gap-2">
      {tags.map((t) => (
        <li key={t.id}>
          <button
            type="button"
            onClick={() => toggle(t.id)}
            disabled={pending === t.id}
            aria-pressed={t.attached}
            className={cn(
              'min-h-[36px] rounded-full border px-3 text-[13px] font-medium transition disabled:opacity-50',
              t.attached
                ? t.tone === 'green'
                  ? 'border-success-line bg-success-soft text-success'
                  : t.tone === 'amber'
                    ? 'border-warn-line bg-warn-soft text-warn'
                    : 'border-brand-200 bg-brand-50 text-brand-700'
                : 'border-line-strong bg-surface text-ink-3 hover:text-navy',
            )}
          >
            {t.name}
          </button>
        </li>
      ))}
    </ul>
  );
}
