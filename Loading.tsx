import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { createAgreementWithInstallments } from "@/lib/agreement-service";
import { agreementSchema } from "@/lib/validation";
import { calculateDailyInterest } from "@/lib/finance";
import { fail, ok, parseBodyError } from "@/lib/http";

export const runtime = "nodejs";

function withDailyInfo(agreement: any) {
  return {
    ...agreement,
    dailyInfo: calculateDailyInterest(
      agreement.openAmount,
      agreement.dailyInterestRate,
      agreement.dailyInterestStartedAt
    )
  };
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) return fail(auth.error, auth.status);

  const url = new URL(request.url);
  const clientIdParam = url.searchParams.get("clientId") || undefined;

  const where: any = {};
  if (auth.user.role === "CLIENT") where.clientId = auth.user.clientId;
  if (auth.user.role === "ADMIN" && clientIdParam) where.clientId = clientIdParam;

  const agreements = await prisma.agreement.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { client: true, installments: { orderBy: { number: "asc" } }, request: true }
  });

  return ok({ agreements: agreements.map(withDailyInfo) });
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, "ADMIN");
  if ("error" in auth) return fail(auth.error, auth.status);

  try {
    const data = agreementSchema.parse(await request.json());
    const agreement = await createAgreementWithInstallments(data);
    return ok({ agreement: withDailyInfo(agreement) }, 201);
  } catch (error) {
    return fail("Não foi possível criar relatório/acordo.", 400, parseBodyError(error));
  }
}
