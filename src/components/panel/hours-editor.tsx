'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { saveHoursAction } from '@/app/actions/panel';
import { WEEKDAYS } from '@/lib/constants';
import { hhmm, minutesOf } from '@/lib/time';

export type DayHours = { weekday: number; startMin: number; endMin: number; closed: boolean };

/** Şube ve personel çalışma saatleri aynı bileşenle düzenlenir. */
export function HoursEditor({
  slug,
  target,
  targetId,
  title,
  hours,
  label = 'Saatler',
}: {
  slug: string;
  target: 'branch' | 'staff';
  targetId: string;
  title: string;
  hours: DayHours[];
  label?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const initial = React.useMemo(
    () =>
      Array.from({ length: 7 }, (_, weekday) => {
        const found = hours.find((h) => h.weekday === weekday);
        return found ?? { weekday, startMin: 540, endMin: 1140, closed: weekday === 0 };
      }),
    [hours],
  );
  const [days, setDays] = React.useState<DayHours[]>(initial);

  React.useEffect(() => {
    if (open) setDays(initial);
  }, [open, initial]);

  function update(weekday: number, patch: Partial<DayHours>) {
    setDays((prev) => prev.map((d) => (d.weekday === weekday ? { ...d, ...patch } : d)));
  }

  /** Pazartesi satırını diğer hafta içi günlere kopyalar. */
  function copyWeekdays() {
    const monday = days.find((d) => d.weekday === 1);
    if (!monday) return;
    setDays((prev) =>
      prev.map((d) =>
        d.weekday >= 1 && d.weekday <= 5
          ? { ...d, startMin: monday.startMin, endMin: monday.endMin, closed: monday.closed }
          : d,
      ),
    );
  }

  async function save() {
    setPending(true);
    setError(null);
    const result = await saveHoursAction(slug, target, { targetId, days });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      toast.error(result.error);
      return;
    }
    toast.success('Çalışma saatleri güncellendi');
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        <Clock size={15} aria-hidden />
        {label}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title={`${title} — çalışma saatleri`} description="Kapalı günlerde randevu verilemez.">
          {error ? (
            <div role="alert" className="mb-3 rounded-xl border border-danger-line bg-danger-soft px-3.5 py-2.5 text-[13px] text-danger">
              {error}
            </div>
          ) : null}

          <ul className="space-y-2">
            {days.map((d) => (
              <li key={d.weekday} className="flex flex-wrap items-center gap-2 rounded-xl border border-line p-2.5">
                <span className="w-[86px] shrink-0 text-[13.5px] font-medium text-navy">
                  {WEEKDAYS[d.weekday]}
                </span>
                <label className="flex min-h-[36px] cursor-pointer items-center gap-1.5 text-[13px] text-ink-2">
                  <input
                    type="checkbox"
                    checked={!d.closed}
                    onChange={(e) => update(d.weekday, { closed: !e.target.checked })}
                    className="h-[17px] w-[17px] rounded border-line-strong text-brand-500 focus:ring-brand-500"
                  />
                  Açık
                </label>
                <div className="ml-auto flex items-center gap-2">
                  <Input
                    type="time"
                    step={900}
                    value={hhmm(d.startMin)}
                    disabled={d.closed}
                    onChange={(e) => update(d.weekday, { startMin: minutesOf(e.target.value) })}
                    aria-label={`${WEEKDAYS[d.weekday]} açılış`}
                    className="h-10 w-[104px]"
                  />
                  <span className="text-ink-3" aria-hidden>–</span>
                  <Input
                    type="time"
                    step={900}
                    value={hhmm(d.endMin)}
                    disabled={d.closed}
                    onChange={(e) => update(d.weekday, { endMin: minutesOf(e.target.value) })}
                    aria-label={`${WEEKDAYS[d.weekday]} kapanış`}
                    className="h-10 w-[104px]"
                  />
                </div>
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={copyWeekdays}
            className="mt-3 text-[13px] font-medium text-brand-600 hover:underline"
          >
            Pazartesi saatlerini hafta içine kopyala
          </button>

          <DialogFooter>
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>
              Vazgeç
            </Button>
            <Button type="button" onClick={save} loading={pending}>
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
