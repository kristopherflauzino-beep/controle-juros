"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { api } from "@/lib/api-client";

export default function FirstAccessPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [hasAdmin, setHasAdmin] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api<{ hasAdmin: boolean }>("/api/setup/status")
      .then((data) => setHasAdmin(data.hasAdmin))
      .catch((err) => setError(err.message));
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      await api("/api/setup/admin", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
      setMessage("Administrador criado com sucesso. Você já pode fazer login.");
      setTimeout(() => router.push("/login"), 900);
    } catch (err: any) {
      setError(err.message || "Erro ao criar administrador.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-card form" onSubmit={submit}>
        <div>
          <h1>Primeiro acesso</h1>
          <p>Crie o administrador inicial do sistema.</p>
        </div>
        {message && <div className="alert success">{message}</div>}
        {error && <div className="alert error">{error}</div>}
        {hasAdmin && <div className="alert error">O administrador inicial já existe. Use a tela de login.</div>}
        <label>
          E-mail/Login do admin
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={hasAdmin} />
        </label>
        <label>
          Senha do admin
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={hasAdmin} minLength={6} />
        </label>
        <button className="btn" disabled={loading || hasAdmin}>{loading ? "Criando..." : "Criar administrador"}</button>
        <Link className="btn secondary" href="/login">Voltar ao login</Link>
      </form>
    </div>
  );
}
