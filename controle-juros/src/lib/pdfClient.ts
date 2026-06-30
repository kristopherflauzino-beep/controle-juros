"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { brl, formatDate, toNumber } from "@/lib/finance";

type Agreement = any;

function addHeader(doc: jsPDF, title: string) {
  doc.setFontSize(18);
  doc.text("Controle de Juros", 14, 18);
  doc.setFontSize(11);
  doc.text(title, 14, 26);
  doc.text(`Data de emissão: ${formatDate(new Date())}`, 14, 33);
  doc.line(14, 38, 196, 38);
}

export function generateAgreementPdf(agreement: Agreement) {
  const doc = new jsPDF();
  addHeader(doc, `Relatório individual - ${agreement.client?.name || "Cliente"}`);

  let y = 48;
  const daily = agreement.dailyInfo || {};
  const lines = [
    ["Cliente", agreement.client?.name || "-"],
    ["CPF/CNPJ", agreement.client?.document || "-"],
    ["E-mail/Login", agreement.client?.email || "-"],
    ["Valor original", brl(agreement.originalValue)],
    ["Valor em aberto", brl(agreement.openAmount)],
    ["Parcelas", String(agreement.installmentsCount)],
    ["Taxa de juros", `${toNumber(agreement.interestRate)}%`],
    ["Valor da parcela", brl(agreement.installmentValue)],
    ["Total final", brl(agreement.totalFinal)],
    ["Data do acordo", formatDate(agreement.agreementDate)],
    ["Vencimento", formatDate(agreement.dueDate)],
    ["Status", agreement.status],
    ["Juros diário", agreement.dailyInterestRate ? `${toNumber(agreement.dailyInterestRate)}% ao dia` : "Não iniciado"],
    ["Data início juros", agreement.dailyInterestStartedAt ? formatDate(agreement.dailyInterestStartedAt) : "-"],
    ["Dias de juros", String(daily.daysCount || 0)],
    ["Juros acumulado", brl(daily.accumulatedInterest || 0)],
    ["Valor atualizado", brl(daily.updatedAmount || agreement.openAmount)],
    ["Observações", agreement.observations || "-"]
  ];

  autoTable(doc, {
    startY: y,
    head: [["Campo", "Informação"]],
    body: lines,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [31, 41, 55] }
  });

  y = (doc as any).lastAutoTable.finalY + 8;
  autoTable(doc, {
    startY: y,
    head: [["Parcela", "Vencimento", "Parcela", "Juros", "Amortização", "Saldo"]],
    body: (agreement.installments || []).map((row: any) => [
      row.number,
      formatDate(row.dueDate),
      brl(row.paymentValue),
      brl(row.interestValue),
      brl(row.amortization),
      brl(row.remainingValue)
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [31, 41, 55] }
  });

  doc.save(`relatorio-${agreement.client?.name || "cliente"}-${agreement.id}.pdf`);
}

export function generateAgreementsListPdf(title: string, agreements: Agreement[]) {
  const doc = new jsPDF();
  addHeader(doc, title);

  autoTable(doc, {
    startY: 48,
    head: [["Cliente", "Valor original", "Total final", "Atualizado", "Parcelas", "Status", "Vencimento"]],
    body: agreements.map((agreement) => [
      agreement.client?.name || "-",
      brl(agreement.originalValue),
      brl(agreement.totalFinal),
      brl(agreement.dailyInfo?.updatedAmount || agreement.openAmount),
      agreement.installmentsCount,
      agreement.status,
      formatDate(agreement.dueDate)
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [31, 41, 55] }
  });

  doc.save(`${title.toLowerCase().replace(/\s+/g, "-")}.pdf`);
}
