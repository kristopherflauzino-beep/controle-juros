import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fail, requireSession } from "@/lib/api";
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession(req, "ADMIN"); if (auth.error) return auth.error;
  const { status } = await req.json(); if (!["APPROVED", "REJECTED"].includes(status)) return fail("Status inválido");
  const { id } = await params; return NextResponse.json(await prisma.request.update({ where: { id }, data: { status } }));
}
