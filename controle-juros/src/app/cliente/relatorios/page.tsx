"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Loading } from "@/components/Loading";
import { StatusBadge } from "@/components/StatusBadge";
import { api } from "@/lib/api-client";
import { brl, formatDate, toNumber } from "@/lib/finance";
import { generateAgreementPdf, generateAgreementsListPdf } from "@/lib/pdfClient";

export default function MeusRelatoriosPage() {
  const [agreements, setAgreements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    try {
      const data = await api<{ agreements: any[] }>("/api/agreements");
      setAgreements(data.agreements);
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  return (
    <AppShell role="CLIENT" title="Meus relatórios">
      {error && <div className="alert error">{error}</div>}
      <section className="card">
        <div className="actions" style={{ justifyContent: "space-between" }}>
          <h2>Relatórios vinculados ao meu cadastro</h2>
          <button className="btn secondary" onClick={() => generateAgreementsListPdf("Meus relatórios", agreements)}>Gerar PDF dos meus relatórios</button>
        </div>
        {loading ? <Loading /> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Valores</th><th>Juros diário</th><th>Status</th><th>Vencimento</th><th>Observações</th><th>Ações</th></tr></thead>
              <tbody>
                {agreements.map((item) => (
                  <tr key={item.id}>
                    <td>Original: {brl(item.originalValue)}<br />Parcela: {brl(item.installmentValue)}<br />Total: {brl(item.totalFinal)}<br />Atualizado: {brl(item.dailyInfo?.updatedAmount || item.openAmount)}</td>
                    <td>{item.dailyInterestRate ? `${toNumber(item.dailyInterestRate)}% ao dia` : "-"}<br />Início: {item.dailyInterestStartedAt ? formatDate(item.dailyInterestStartedAt) : "não iniciado"}<br />Dias: {item.dailyInfo?.daysCount || 0}<br />Acumulado: {brl(item.dailyInfo?.accumulatedInterest || 0)}</td>
                    <td><StatusBadge status={item.status} /></td>
                    <td>{formatDate(item.dueDate)}</td>
                    <td>{item.observations || "-"}</td>
                    <td><button className="btn small info" onClick={() => generateAgreementPdf(item)}>Gerar PDF</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AppShell>
  );
}
