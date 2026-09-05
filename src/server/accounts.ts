import 'server-only';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/server/auth';
import { DomainError } from '@/server/errors';
import type { Role } from '@/lib/constants';

/**
 * Hesap oluşturmanın tek yeri.
 *
 * İki kayıt yolu var (müşteri ve işletme sahibi) ve ikisi de aynı şeyleri
 * yapmak zorunda: e-posta tekilliği, parola özeti, rol, avatar tohumu ve
 * yakında KVKK açık rıza kaydı. Kopyalanırsa yollar zamanla ayrışır —
 * özellikle rıza eklenirken biri unutulur ve o yoldan kaydolanların rızası
 * hiç alınmamış olur. Bu doğrudan hukuki boşluk olurdu.
 *
 * Bu yüzden zorunluluklar buraya eklenir; iki yol da otomatik kapsanır.
 *
 * İşlem (`tx`) dışarıdan geçirilebilir: işletme başvurusu User + Business +
 * Branch + StatusHistory kayıtlarını tek atomik işlemde yazıyor.
 */
export type NewAccount = {
  name: string;
  email: string;
  phone?: string | null;
  password: string;
  role: Role;
};

export type CreatedAccount = { id: string; name: string; role: Role };

export async function createAccount(
  input: NewAccount,
  tx: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<CreatedAccount> {
  const exists = await tx.user.findUnique({
    where: { email: input.email },
    select: { id: true },
  });
  if (exists) throw new DomainError('Bu e-posta ile kayıtlı bir hesap zaten var.', 'EMAIL_TAKEN');

  const user = await tx.user.create({
    data: {
      email: input.email,
      name: input.name,
      phone: input.phone || null,
      passwordHash: await hashPassword(input.password),
      role: input.role,
      avatarSeed: String(Math.floor(Math.random() * 24)),
      // Müşteri profili yalnızca müşteri hesabında anlamlı; işletme sahibi
      // randevu almak isterse profil o zaman oluşur.
      ...(input.role === 'CUSTOMER' ? { customerProfile: { create: {} } } : {}),
    },
    select: { id: true, name: true, role: true },
  });

  return { id: user.id, name: user.name, role: user.role as Role };
}
