"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { api } from "@/lib/api-client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [hasAdmin, setHasAdmin] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api<{ hasAdmin: boolean }>("/api/setup/status")
      .then((data) => setHasAdmin(data.hasAdmin))
      .catch(() => setHasAdmin(true));
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await api<{ user: { role: "ADMIN" | "CLIENT" } }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
      router.push(data.user.role === "ADMIN" ? "/admin" : "/cliente/solicitar");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Erro ao fazer login.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-card form" onSubmit={submit}>
        <div>
          <h1>Controle de Juros</h1>
          <p>Acesse o painel administrativo ou a área do cliente.</p>
        </div>
        {error && <div className="alert error">{error}</div>}
        {!hasAdmin && (
          <div className="alert success">
            Nenhum administrador cadastrado. Faça o primeiro acesso antes do login.
          </div>
        )}
        <label>
          E-mail/Login
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Senha
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        <button className="btn" disabled={loading}>{loading ? "Entrando..." : "Entrar"}</button>
        <div className="actions">
          <Link className="btn secondary" href="/first-access">Primeiro acesso</Link>
          <Link className="btn secondary" href="/api/health">Testar /api/health</Link>
        </div>
      </form>
    </div>
  );
}
