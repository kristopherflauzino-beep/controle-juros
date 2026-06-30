"use client";

import { FormEvent, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Loading } from "@/components/Loading";
import { StatusBadge } from "@/components/StatusBadge";
import { api } from "@/lib/api-client";
import { brl, formatDate, toNumber } from "@/lib/finance";
import { generateAgreementPdf, generateAgreementsListPdf } from "@/lib/pdfClient";

const emptyForm = {
  clientId: "",
  originalValue: "",
  installmentsCount: "1",
  interestRate: "0",
  dueDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
  status: "ABERTO",
  observations: "",
  dailyInterestRate: ""
};

export default function RelatoriosPage() {
  const [clients, setClients] = useState<any[]>([]);
  const [agreements, setAgreements] = useState<any[]>([]);
  const [filterClient, setFilterClient] = useState("");
  const [form, setForm] = useState<any>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load(clientId = filterClient) {
    setLoading(true);
    try {
      const [clientsData, agreementsData] = await Promise.all([
        api<{ clients: any[] }>("/api/clients"),
        api<{ agreements: any[] }>(`/api/agreements${clientId ? `?clientId=${clientId}` : ""}`)
      ]);
      setClients(clientsData.clients);
      setAgreements(agreementsData.agreements);
    } catch (err: any) {
      setError(err.message);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  function startEdit(item: any) {
    setEditingId(item.id);
    setForm({
      clientId: item.clientId,
      originalValue: String(toNumber(item.originalValue)),
      installmentsCount: String(item.installmentsCount),
      interestRate: String(toNumber(item.interestRate)),
      dueDate: new Date(item.dueDate).toISOString().slice(0, 10),
      status: item.status,
      observations: item.observations || "",
      dailyInterestRate: item.dailyInterestRate ? String(toNumber(item.dailyInterestRate)) : ""
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(""); setMessage("");
    const payload = {
      ...form,
      originalValue: Number(form.originalValue),
      installmentsCount: Number(form.installmentsCount),
      interestRate: Number(form.interestRate),
      dailyInterestRate: form.dailyInterestRate === "" ? null : Number(form.dailyInterestRate)
    };
    try {
      if (editingId) {
        const { clientId, ...updatePayload } = payload;
        await api(`/api/agreements/${editingId}`, { method: "PATCH", body: JSON.stringify(updatePayload) });
        setMessage("Relatório editado com sucesso. A data de início do juros diário foi preservada, caso já existisse.");
      } else {
        await api("/api/agreements", { method: "POST", body: JSON.stringify(payload) });
        setMessage("Relatório/acordo criado com sucesso.");
      }
      setForm(emptyForm);
      setEditingId(null);
      await load();
    } catch (err: any) { setError(err.message); }
  }

  async function startDailyInterest(id: string) {
    setError(""); setMessage("");
    try {
      await api(`/api/agreements/${id}/daily-interest`, { method: "POST" });
      setMessage("Juros diário iniciado. A data de início foi salva.");
      await load();
    } catch (err: any) { setError(err.message); }
  }

  return (
    <AppShell role="ADMIN" title="Relatórios e acordos">
      {message && <div className="alert success">{message}</div>}
      {error && <div className="alert error">{error}</div>}
      <div className="grid">
        <section className="card">
          <h2>{editingId ? "Editar relatório" : "Criar relatório/acordo"}</h2>
          <form className="form" onSubmit={submit}>
            <label>Cliente
              <select value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })} required disabled={Boolean(editingId)}>
                <option value="">Selecione</option>
                {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
              </select>
            </label>
            <div className="form-row">
              <label>Valor original<input type="number" step="0.01" min="0.01" value={form.originalValue} onChange={(e) => setForm({ ...form, originalValue: e.target.value })} required /></label>
              <label>Parcelas<input type="number" min="1" step="1" value={form.installmentsCount} onChange={(e) => setForm({ ...form, installmentsCount: e.target.value })} required /></label>
            </div>
            <div className="form-row">
              <label>Taxa de juros por período (%)<input type="number" step="0.0001" min="0" value={form.interestRate} onChange={(e) => setForm({ ...form, interestRate: e.target.value })} required /></label>
              <label>Juros diário (% ao dia)<input type="number" step="0.0001" min="0" value={form.dailyInterestRate} onChange={(e) => setForm({ ...form, dailyInterestRate: e.target.value })} /></label>
            </div>
            <div className="form-row">
              <label>Vencimento<input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} required /></label>
              <label>Status<select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="ABERTO">Aberto</option><option value="PAGO">Pago</option><option value="ATRASADO">Atrasado</option><option value="CANCELADO">Cancelado</option></select></label>
            </div>
            <label>Observações<textarea value={form.observations} onChange={(e) => setForm({ ...form, observations: e.target.value })} /></label>
            <div className="actions">
              <button className="btn">{editingId ? "Salvar edição" : "Criar relatório"}</button>
              {editingId && <button type="button" className="btn secondary" onClick={() => { setEditingId(null); setForm(emptyForm); }}>Cancelar</button>}
            </div>
          </form>
        </section>

        <section className="card">
          <div className="actions" style={{ justifyContent: "space-between" }}>
            <h2>Relatórios separados por cliente</h2>
            <div className="actions">
              <select value={filterClient} onChange={(e) => { setFilterClient(e.target.value); load(e.target.value); }}>
                <option value="">Todos os clientes</option>
                {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
              </select>
              <button className="btn secondary" onClick={() => generateAgreementsListPdf(filterClient ? "Relatórios do cliente" : "Relatório geral", agreements)}>PDF {filterClient ? "do cliente" : "geral"}</button>
            </div>
          </div>
          {loading ? <Loading /> : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Cliente</th><th>Valores</th><th>Juros diário</th><th>Status</th><th>Vencimento</th><th>Ações</th></tr></thead>
                <tbody>
                  {agreements.map((item) => (
                    <tr key={item.id}>
                      <td>{item.client?.name}<br /><span className="muted">{item.client?.email}</span></td>
                      <td>Original: {brl(item.originalValue)}<br />Parcela: {brl(item.installmentValue)}<br />Total: {brl(item.totalFinal)}<br />Atualizado: {brl(item.dailyInfo?.updatedAmount || item.openAmount)}</td>
                      <td>{item.dailyInterestRate ? `${toNumber(item.dailyInterestRate)}% ao dia` : "-"}<br />Início: {item.dailyInterestStartedAt ? formatDate(item.dailyInterestStartedAt) : "não iniciado"}<br />Dias: {item.dailyInfo?.daysCount || 0}<br />Acumulado: {brl(item.dailyInfo?.accumulatedInterest || 0)}</td>
                      <td><StatusBadge status={item.status} /></td>
                      <td>{formatDate(item.dueDate)}</td>
                      <td className="actions">
                        <button className="btn small secondary" onClick={() => startEdit(item)}>Editar</button>
                        <button className="btn small info" onClick={() => generateAgreementPdf(item)}>Gerar PDF</button>
                        {!item.dailyInterestStartedAt && <button className="btn small warning" onClick={() => startDailyInterest(item.id)}>Iniciar juros diário</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
