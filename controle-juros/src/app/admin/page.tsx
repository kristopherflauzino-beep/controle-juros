"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Loading } from "@/components/Loading";
import { StatusBadge } from "@/components/StatusBadge";
import { api } from "@/lib/api-client";
import { brl, formatDate } from "@/lib/finance";

export default function AdminDashboardPage() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<any>("/api/admin/dashboard").then(setData).catch((err) => setError(err.message));
  }, []);

  return (
    <AppShell role="ADMIN" title="Dashboard">
      {error && <div className="alert error">{error}</div>}
      {!data ? <Loading /> : (
        <div className="grid">
          <section className="grid grid-4">
            <div className="card"><h3>Total de clientes</h3><div className="metric">{data.totalClients}</div></div>
            <div className="card"><h3>Solicitações pendentes</h3><div className="metric">{data.pendingRequests}</div></div>
            <div className="card"><h3>Total em aberto</h3><div className="metric">{brl(data.totalOpen)}</div></div>
            <div className="card"><h3>Atualizado com juros</h3><div className="metric">{brl(data.totalUpdated)}</div></div>
          </section>
          <section className="grid grid-2">
            <div className="card"><h3>Relatórios em atraso</h3><div className="metric">{data.overdueReports}</div></div>
            <div className="card"><h3>Saúde do sistema</h3><p className="muted">Rota de teste disponível em <strong>/api/health</strong>.</p></div>
          </section>
          <section className="card">
            <h2>Últimas solicitações</h2>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Cliente</th><th>Valor</th><th>Data</th><th>Status</th><th>Observação</th></tr></thead>
                <tbody>
                  {data.latestRequests?.map((item: any) => (
                    <tr key={item.id}>
                      <td>{item.client?.name}</td>
                      <td>{brl(item.amount)}</td>
                      <td>{formatDate(item.createdAt)}</td>
                      <td><StatusBadge status={item.status} /></td>
                      <td>{item.observation || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </AppShell>
  );
}
