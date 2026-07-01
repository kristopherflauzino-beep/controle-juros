"use client";
import { useEffect, useState } from "react";
import { Landmark, LockKeyhole, Mail, UserRound } from "lucide-react";

export default function Login() {
  const [setup, setSetup] = useState(false), [loading, setLoading] = useState(true), [error, setError] = useState("");
  useEffect(() => { fetch("/api/auth/setup").then(r => r.json()).then(d => setSetup(d.required)).finally(() => setLoading(false)); }, []);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(""); setLoading(true); const data = Object.fromEntries(new FormData(e.currentTarget));
    const res = await fetch(setup ? "/api/auth/setup" : "/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    const json = await res.json(); if (!res.ok) { setError(json.error); setLoading(false); } else location.href = "/painel";
  }
  return <main className="auth-page"><section className="auth-brand"><div><span className="brand-mark"><Landmark /></span><h1>Controle de Juros</h1><p>Empréstimos, acordos e relatórios sob controle — com cálculos claros e dados seguros.</p></div></section><section className="auth-panel"><form className="auth-card" onSubmit={submit}><div className="mobile-logo"><Landmark /></div><span className="eyebrow">{setup ? "PRIMEIRO ACESSO" : "ACESSO SEGURO"}</span><h2>{setup ? "Crie o administrador" : "Bem-vindo de volta"}</h2><p>{setup ? "Configure a conta principal para começar." : "Entre com suas credenciais para continuar."}</p>{setup && <label>Nome completo<div className="input-icon"><UserRound/><input name="name" required minLength={2} autoComplete="name" /></div></label>}<label>E-mail / Login<div className="input-icon"><Mail/><input type="text" name="email" required autoComplete="username" /></div></label><label>Senha<div className="input-icon"><LockKeyhole/><input type="password" name="password" required minLength={6} autoComplete={setup ? "new-password" : "current-password"}/></div></label>{error && <div className="alert error">{error}</div>}<button className="btn primary full" disabled={loading}>{loading ? "Aguarde..." : setup ? "Criar administrador" : "Entrar"}</button><small>Seus dados são protegidos por autenticação segura.</small></form></section></main>;
}
