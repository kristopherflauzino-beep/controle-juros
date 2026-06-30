"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Loading } from "@/components/Loading";
import { StatusBadge } from "@/components/StatusBadge";
import { api } from "@/lib/api-client";
import { brl, formatDate } from "@/lib/finance";

export default function SolicitacoesPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    try {
      const data = await api<{ requests: any[] }>("/api/requests");
      setRequests(data.requests);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function approve(item: any) {
    const installmentsCount = Number(prompt("Quantidade de parcelas", "1") || "1");
    const interestRate = Number(prompt("Taxa de juros por período (%)", "0") || "0");
    const dailyInterestRateInput = prompt("Juros diário (% ao dia). Deixe vazio para não aplicar", "");
    const dueDate = prompt("Data do primeiro vencimento (AAAA-MM-DD)", new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10));
    if (!dueDate) return;
    setError(""); setMessage("");
    try {
      await api(`/api/requests/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "APROVADO",
          originalValue: Number(item.amount),
          installmentsCount,
          interestRate,
          dailyInterestRate: dailyInterestRateInput ? Number(dailyInterestRateInput) : null,
          dueDate,
          observations: item.observation || "Acordo gerado a partir de solicitação aprovada."
        })
      });
      setMessage("Solicitação aprovada e transformada em relatório/acordo.");
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function refuse(id: string) {
    if (!confirm("Recusar esta solicitação?")) return;
    setError(""); setMessage("");
    try {
      await api(`/api/requests/${id}`, { method: "PATCH", body: JSON.stringify({ status: "RECUSADO" }) });
      setMessage("Solicitação recusada.");
      await load();
    } catch (err: any) { setError(err.message); }
  }

  return (
    <AppShell role="ADMIN" title="Solicitações">
      {message && <div className="alert success">{message}</div>}
      {error && <div className="alert error">{error}</div>}
      <section className="card">
        <h2>Solicitações dos clientes</h2>
        {loading ? <Loading /> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Cliente</th><th>Valor solicitado</th><th>Data</th><th>Observação</th><th>Status</th><th>Ações</th></tr></thead>
              <tbody>
                {requests.map((item) => (
                  <tr key={item.id}>
                    <td>{item.client?.name}</td>
                    <td>{brl(item.amount)}</td>
                    <td>{formatDate(item.createdAt)}</td>
                    <td>{item.observation || "-"}</td>
                    <td><StatusBadge status={item.status} /></td>
                    <td className="actions">
                      {item.status === "PENDENTE" && <button className="btn small success" onClick={() => approve(item)}>Aprovar</button>}
                      {item.status === "PENDENTE" && <button className="btn small danger" onClick={() => refuse(item.id)}>Recusar</button>}
                      {item.agreement && <span className="muted">Relatório criado</span>}
                    </td>
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
