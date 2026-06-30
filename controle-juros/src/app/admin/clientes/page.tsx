"use client";

import { FormEvent, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Loading } from "@/components/Loading";
import { api } from "@/lib/api-client";

const emptyForm = { name: "", document: "", phone: "", email: "", password: "", active: true };

export default function AdminClientesPage() {
  const [clients, setClients] = useState<any[]>([]);
  const [form, setForm] = useState<any>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    try {
      const data = await api<{ clients: any[] }>("/api/clients");
      setClients(data.clients);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function startEdit(client: any) {
    setEditingId(client.id);
    setForm({
      name: client.name,
      document: client.document || "",
      phone: client.phone || "",
      email: client.email,
      password: "",
      active: client.active
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      if (editingId) {
        const payload = { ...form };
        if (!payload.password) delete payload.password;
        await api(`/api/clients/${editingId}`, { method: "PATCH", body: JSON.stringify(payload) });
        setMessage("Cliente atualizado com sucesso.");
      } else {
        await api("/api/clients", { method: "POST", body: JSON.stringify(form) });
        setMessage("Cliente cadastrado com sucesso.");
      }
      setForm(emptyForm);
      setEditingId(null);
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function remove(id: string) {
    if (!confirm("Remover este cliente e seus dados vinculados?")) return;
    setError("");
    await api(`/api/clients/${id}`, { method: "DELETE" }).catch((err) => setError(err.message));
    await load();
  }

  return (
    <AppShell role="ADMIN" title="Clientes">
      {message && <div className="alert success">{message}</div>}
      {error && <div className="alert error">{error}</div>}
      <div className="grid grid-2">
        <section className="card">
          <h2>{editingId ? "Editar cliente" : "Cadastrar cliente"}</h2>
          <form className="form" onSubmit={submit}>
            <label>Nome do cliente<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
            <div className="form-row">
              <label>CPF/CNPJ opcional<input value={form.document} onChange={(e) => setForm({ ...form, document: e.target.value })} /></label>
              <label>Telefone opcional<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
            </div>
            <label>E-mail/Login<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label>
            <label>{editingId ? "Nova senha (opcional)" : "Senha inicial"}<input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required={!editingId} /></label>
            <label>Status<select value={String(form.active)} onChange={(e) => setForm({ ...form, active: e.target.value === "true" })}><option value="true">Ativo</option><option value="false">Inativo</option></select></label>
            <div className="actions">
              <button className="btn">{editingId ? "Salvar alterações" : "Cadastrar cliente"}</button>
              {editingId && <button type="button" className="btn secondary" onClick={() => { setEditingId(null); setForm(emptyForm); }}>Cancelar</button>}
            </div>
          </form>
        </section>
        <section className="card">
          <h2>Clientes cadastrados</h2>
          {loading ? <Loading /> : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Nome</th><th>Login</th><th>Status</th><th>Relatórios</th><th>Ações</th></tr></thead>
                <tbody>
                  {clients.map((client) => (
                    <tr key={client.id}>
                      <td>{client.name}<br /><span className="muted">{client.document || "Sem CPF/CNPJ"}</span></td>
                      <td>{client.email}<br /><span className="muted">{client.phone || "Sem telefone"}</span></td>
                      <td>{client.active ? "Ativo" : "Inativo"}</td>
                      <td>{client._count?.agreements || 0}</td>
                      <td className="actions">
                        <button className="btn small secondary" onClick={() => startEdit(client)}>Editar</button>
                        <button className="btn small danger" onClick={() => remove(client.id)}>Remover</button>
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
