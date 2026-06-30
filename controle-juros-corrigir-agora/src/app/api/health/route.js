import { NextResponse } from 'next/server';
import { storageStatus } from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    ok: true,
    app: 'controle-juros',
    storage: storageStatus(),
    time: new Date().toISOString()
  });
}
