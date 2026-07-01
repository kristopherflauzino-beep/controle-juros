import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api";
export async function GET(req: NextRequest) {
  const auth = await requireSession(req); if (auth.error) return auth.error;
  const user = await prisma.user.findUnique({ where: { id: auth.session!.userId }, include: { client: true }, omit: { passwordHash: true } });
  return NextResponse.json(user);
}
