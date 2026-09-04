import { NextResponse } from 'next/server';
import { clearSessionCookie } from '@/server/session';

/** Çıkış: oturum çerezi silinir ve ana sayfaya dönülür. */
export async function POST(request: Request): Promise<NextResponse> {
  await clearSessionCookie();
  return NextResponse.redirect(new URL('/', request.url), { status: 303 });
}

export async function GET(request: Request): Promise<NextResponse> {
  await clearSessionCookie();
  return NextResponse.redirect(new URL('/', request.url), { status: 303 });
}
