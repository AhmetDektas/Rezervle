import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ExternalLink, MessageSquareQuote } from 'lucide-react';
import { prisma } from '@/lib/db';
import { depositPolicyFor } from '@/server/deposit-policy';
import { requireRole, requireBusinessAccess } from '@/server/auth';
import { BusinessProfileForm, ReviewReply } from '@/components/panel/business-settings';
import { GalleryManager } from '@/components/panel/gallery-manager';
import { DepositSettings } from '@/components/panel/deposit-settings';
import { PayoutSettings } from '@/components/panel/payout-settings';
import { BusinessCover } from '@/components/business/cover';
import { Card, CardHeader, CardBody } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Rating, ReviewStars } from '@/components/ui/rating';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { jsonParse } from '@/lib/utils';
import { ago } from '@/lib/format';
import { BUSINESS_STATUS_LABEL, type BusinessStatus } from '@/lib/constants';

export const metadata: Metadata = { title: 'Ayarlar' };
export const dynamic = 'force-dynamic';

type Params = Promise<{ slug: string }>;

export default async function SettingsPage({ params }: { params: Params }) {
  const [{ slug }, user] = await Promise.all([params, requireRole(['OWNER', 'STAFF', 'ADMIN'])]);
  const business = await prisma.business.findUnique({
    where: { slug },
    include: {
      category: true,
      images: { orderBy: { sortOrder: 'asc' } },
      reviews: {
        where: { status: { in: ['PUBLISHED', 'REPORTED'] } },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { user: { select: { name: true, avatarSeed: true } } },
      },
      statusHistory: { orderBy: { createdAt: 'desc' }, take: 5 },
    },
  });
  if (!business) notFound();
  await requireBusinessAccess(user, business.id);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Ayarlar</h1>
          <p className="mt-0.5 text-[13.5px] text-ink-3">
            Bu bilgiler müşteri tarafındaki işletme sayfanızda görünür.
          </p>
        </div>
        <Button asChild variant="secondary" size="sm">
          <Link href={`/isletme/${slug}`} target="_blank">
            <ExternalLink size={15} aria-hidden />
            Sayfayı gör
          </Link>
        </Button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader title="İşletme profili" description="Müşterilerin gördüğü bilgiler" />
          <CardBody>
            <BusinessProfileForm
              slug={slug}
              businessId={business.id}
              initial={{
                name: business.name,
                tagline: business.tagline,
                about: business.about,
                phone: business.phone ?? '',
                email: business.email ?? '',
                website: business.website ?? '',
                priceLevel: business.priceLevel,
                amenities: jsonParse<string[]>(business.amenities, []),
              }}
            />
          </CardBody>
        </Card>

        <div className="space-y-5">
          <Card className="overflow-hidden">
            <BusinessCover
              hue={business.brandHue}
              sector={business.category.sector}
              src={business.coverUrl}
              name={business.name}
              rounded=""
              className="h-28"
            />
            <CardBody>
              <p className="text-[15px] font-semibold text-navy">{business.name}</p>
              <p className="mt-0.5 text-[13px] text-ink-3">{business.category.name}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge tone={business.status === 'APPROVED' ? 'green' : business.status === 'PENDING' ? 'amber' : 'red'}>
                  {BUSINESS_STATUS_LABEL[business.status as BusinessStatus]}
                </Badge>
                {business.featured ? <Badge tone="blue">Öne çıkan</Badge> : null}
              </div>
              {business.ratingCount > 0 ? (
                <div className="mt-2">
                  <Rating value={business.ratingAvg} count={business.ratingCount} />
                </div>
              ) : null}
              <p className="mt-3 text-[12.5px] leading-relaxed text-ink-3">
                Galeriye görsel eklemezseniz kapak, işletmenizin renk tonundan üretilir;
                sayfa hiçbir koşulda boş görünmez.
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Durum geçmişi" description="Platform onay hareketleri" />
            <CardBody>
              <ol className="space-y-2.5 border-l border-line pl-4">
                {business.statusHistory.map((h) => (
                  <li key={h.id} className="relative">
                    <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-brand-400" aria-hidden />
                    <p className="text-[13px] font-medium text-navy">
                      {BUSINESS_STATUS_LABEL[h.toStatus as BusinessStatus]}
                    </p>
                    {h.reason ? <p className="text-[12.5px] text-ink-3">{h.reason}</p> : null}
                    <p className="text-[12px] text-ink-3">{ago(h.createdAt)}</p>
                  </li>
                ))}
              </ol>
            </CardBody>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader
          title="Kapora"
          description="Randevuya gelmeme oranını düşürmek için sunulan ek paket"
        />
        <CardBody>
          <DepositSettings
            slug={slug}
            businessId={business.id}
            initial={depositPolicyFor(business)}
          />
        </CardBody>
      </Card>

      {business.depositAddon ? (
        <Card>
          <CardHeader
            title="Hak ediş hesabı"
            description="Kapora tahsilatı komisyon düşülerek bu hesaba aktarılır"
          />
          <CardBody>
            <PayoutSettings
              slug={slug}
              businessId={business.id}
              initial={{
                payoutTitle: business.payoutTitle ?? '',
                payoutIban: business.payoutIban ?? '',
                taxNumber: business.taxNumber ?? '',
                commissionRate: business.commissionRate,
              }}
            />
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader
          title="Galeri"
          description="İşletme sayfanızda kapak ve galeri olarak görünür"
        />
        <CardBody>
          <GalleryManager
            slug={slug}
            businessId={business.id}
            coverUrl={business.coverUrl}
            images={business.images.map((i) => ({ id: i.id, url: i.url, caption: i.caption }))}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Değerlendirmeler"
          description="Yanıtınız işletme sayfasında yorumun altında görünür"
        />
        {business.reviews.length === 0 ? (
          <CardBody>
            <p className="flex items-center gap-2 text-[13.5px] text-ink-3">
              <MessageSquareQuote size={15} aria-hidden />
              Henüz değerlendirme yok.
            </p>
          </CardBody>
        ) : (
          <ul className="divide-y divide-line">
            {business.reviews.map((r) => (
              <li key={r.id} className="p-4">
                <div className="flex items-center gap-3">
                  <Avatar name={r.user.name} size={34} hue={Number(r.user.avatarSeed) * 37} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-medium text-navy">{r.user.name}</p>
                    <p className="text-[12px] text-ink-3">{ago(r.createdAt)}</p>
                  </div>
                  {r.status === 'REPORTED' ? <Badge tone="red">Şikayet edildi</Badge> : null}
                  <ReviewStars value={r.rating} />
                </div>
                {r.comment ? (
                  <p className="mt-2 text-[13.5px] leading-relaxed text-ink-2">{r.comment}</p>
                ) : null}
                {r.reply ? (
                  <div className="mt-2 rounded-xl border-l-2 border-brand-300 bg-brand-50/60 px-3.5 py-2.5">
                    <p className="text-[12.5px] font-medium text-brand-700">Yanıtınız</p>
                    <p className="mt-0.5 text-[13.5px] text-ink-2">{r.reply}</p>
                  </div>
                ) : null}
                <ReviewReply slug={slug} reviewId={r.id} existing={r.reply} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
