import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api";

export async function POST(req: NextRequest) {
  const auth = await requireSession(req); if (auth.error) return auth.error;
  await prisma.user.update({ where: { id: auth.session!.userId }, data: { lastSeenAt: new Date() } });
  return NextResponse.json({ ok: true });
}
