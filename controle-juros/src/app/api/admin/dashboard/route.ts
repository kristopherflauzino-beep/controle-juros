import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { calculateDailyInterest, toNumber } from "@/lib/finance";
import { fail, ok } from "@/lib/http";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, "ADMIN");
  if ("error" in auth) return fail(auth.error, auth.status);

  const [totalClients, pendingRequests, agreements, latestRequests] = await Promise.all([
    prisma.client.count(),
    prisma.request.count({ where: { status: "PENDENTE" } }),
    prisma.agreement.findMany({ where: { status: { in: ["ABERTO", "ATRASADO"] } } }),
    prisma.request.findMany({ take: 5, orderBy: { createdAt: "desc" }, include: { client: true } })
  ]);

  const totalOpen = agreements.reduce((sum, item) => sum + toNumber(item.openAmount), 0);
  const totalUpdated = agreements.reduce((sum, item) => {
    const daily = calculateDailyInterest(item.openAmount, item.dailyInterestRate, item.dailyInterestStartedAt);
    return sum + daily.updatedAmount;
  }, 0);
  const today = new Date();
  const overdueReports = agreements.filter((item) => item.status !== "PAGO" && item.dueDate < today).length;

  return ok({
    totalClients,
    pendingRequests,
    totalOpen,
    totalUpdated,
    overdueReports,
    latestRequests
  });
}
