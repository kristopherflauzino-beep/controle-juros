"use client";

import { FormEvent, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Loading } from "@/components/Loading";
import { StatusBadge } from "@/components/StatusBadge";
import { api } from "@/lib/api-client";
import { brl, formatDate } from "@/lib/finance";

export default function SolicitarValorPage() {
  const [amount, setAmount] = useState("");
  const [observation, setObservation] = useState("");
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    try {
      const data = await api<{ requests: any[] }>("/api/requests");
      setRequests(data.requests);
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(""); setMessage("");
    try {
      await api("/api/requests", {
        method: "POST",
        body: JSON.stringify({ amount: Number(amount), observation })
      });
      setAmount("");
      setObservation("");
      setMessage("Solicitação enviada ao administrador.");
      await load();
    } catch (err: any) { setError(err.message); }
  }

  return (
    <AppShell role="CLIENT" title="Solicitar valor">
      {message && <div className="alert success">{message}</div>}
      {error && <div className="alert error">{error}</div>}
      <div className="grid">
        <section className="card">
          <h2>Nova solicitação</h2>
          <form className="form" onSubmit={submit}>
            <label>Valor desejado<input type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required /></label>
            <label>Observação ou motivo<textarea value={observation} onChange={(e) => setObservation(e.target.value)} /></label>
            <button className="btn">Enviar solicitação</button>
          </form>
        </section>
        <section className="card">
          <h2>Minhas solicitações</h2>
          {loading ? <Loading /> : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Valor</th><th>Data</th><th>Observação</th><th>Status</th></tr></thead>
                <tbody>{requests.map((item) => <tr key={item.id}><td>{brl(item.amount)}</td><td>{formatDate(item.createdAt)}</td><td>{item.observation || "-"}</td><td><StatusBadge status={item.status} /></td></tr>)}</tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
