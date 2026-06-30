import { prisma } from "@/lib/prisma";
import { addMonths, calculatePriceSchedule, toNumber } from "@/lib/finance";

export async function createAgreementWithInstallments(data: {
  clientId: string;
  requestId?: string | null;
  originalValue: number;
  installmentsCount: number;
  interestRate: number;
  dueDate: string | Date;
  status?: "ABERTO" | "PAGO" | "ATRASADO" | "CANCELADO";
  observations?: string | null;
  dailyInterestRate?: number | null;
}) {
  const result = calculatePriceSchedule(data.originalValue, data.interestRate, data.installmentsCount);
  const firstDueDate = new Date(data.dueDate);

  return prisma.$transaction(async (tx) => {
    const agreement = await tx.agreement.create({
      data: {
        clientId: data.clientId,
        requestId: data.requestId ?? null,
        originalValue: result.originalValue,
        openAmount: result.totalFinal,
        installmentsCount: result.installmentsCount,
        interestRate: result.interestRate,
        installmentValue: result.installmentValue,
        totalFinal: result.totalFinal,
        dueDate: firstDueDate,
        status: data.status ?? "ABERTO",
        observations: data.observations ?? null,
        dailyInterestRate: data.dailyInterestRate ?? null,
        installments: {
          create: result.rows.map((row) => ({
            number: row.number,
            dueDate: addMonths(firstDueDate, row.number - 1),
            paymentValue: row.paymentValue,
            interestValue: row.interestValue,
            amortization: row.amortization,
            remainingValue: row.remainingValue
          }))
        }
      },
      include: { client: true, installments: true }
    });

    return agreement;
  });
}

export async function updateAgreementFinancials(
  id: string,
  data: {
    originalValue?: number;
    installmentsCount?: number;
    interestRate?: number;
    dueDate?: string | Date;
    status?: "ABERTO" | "PAGO" | "ATRASADO" | "CANCELADO";
    observations?: string | null;
    dailyInterestRate?: number | null;
  }
) {
  const existing = await prisma.agreement.findUnique({ where: { id } });
  if (!existing) throw new Error("Relatório não encontrado.");

  const originalValue = data.originalValue ?? toNumber(existing.originalValue);
  const installmentsCount = data.installmentsCount ?? existing.installmentsCount;
  const interestRate = data.interestRate ?? toNumber(existing.interestRate);
  const dueDate = data.dueDate ? new Date(data.dueDate) : existing.dueDate;
  const result = calculatePriceSchedule(originalValue, interestRate, installmentsCount);

  return prisma.$transaction(async (tx) => {
    await tx.installment.deleteMany({ where: { agreementId: id } });

    const updated = await tx.agreement.update({
      where: { id },
      data: {
        originalValue: result.originalValue,
        openAmount: result.totalFinal,
        installmentsCount: result.installmentsCount,
        interestRate: result.interestRate,
        installmentValue: result.installmentValue,
        totalFinal: result.totalFinal,
        dueDate,
        status: data.status,
        observations: data.observations,
        dailyInterestRate: data.dailyInterestRate,
        installments: {
          create: result.rows.map((row) => ({
            number: row.number,
            dueDate: addMonths(dueDate, row.number - 1),
            paymentValue: row.paymentValue,
            interestValue: row.interestValue,
            amortization: row.amortization,
            remainingValue: row.remainingValue
          }))
        }
      },
      include: { client: true, installments: { orderBy: { number: "asc" } } }
    });

    return updated;
  });
}
