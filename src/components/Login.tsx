"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff, Landmark, LockKeyhole, Mail, UserRound } from "lucide-react";

export default function Login() {
  const [setup, setSetup] = useState(false);
  const [register, setRegister] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => { fetch("/api/auth/setup").then(r => r.json()).then(d => setSetup(d.required)).finally(() => setLoading(false)); }, []);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError("");
    const data = Object.fromEntries(new FormData(e.currentTarget));
    if (register && data.password !== data.confirmPassword) { setError("As senhas não coincidem"); return; }
    setLoading(true);
    const url = setup ? "/api/auth/setup" : register ? "/api/auth/register" : "/api/auth/login";
    const body = register ? { name: data.name, identifier: data.email, password: data.password } : data;
    try {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 15000);
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: controller.signal });
      window.clearTimeout(timeout);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError(json.error || "Serviço temporariamente indisponível. Tente novamente."); setLoading(false); }
      else location.href = "/painel";
    } catch {
      setError("Não foi possível acessar o servidor. Tente novamente em alguns instantes.");
      setLoading(false);
    }
  }

  const creating = setup || register;
  return <main className="auth-page">
    <section className="auth-brand"><div><span className="brand-mark"><Landmark /></span><h1>Controle de Juros</h1><p>Empréstimos, acordos e relatórios sob controle — com cálculos claros e dados seguros.</p></div></section>
    <section className="auth-panel"><form className="auth-card" onSubmit={submit} noValidate>
      <div className="mobile-logo"><Landmark /></div>
      <span className="eyebrow">{setup ? "PRIMEIRO ACESSO" : register ? "NOVA CONTA" : "ACESSO SEGURO"}</span>
      <h2>{setup ? "Crie o administrador" : register ? "Crie sua conta" : "Bem-vindo de volta"}</h2>
      <p>{creating ? "Preencha os dados para começar." : "Entre com seu e-mail ou login para continuar."}</p>
      {creating && <label>Nome completo<div className="input-icon"><UserRound/><input name="name" required minLength={2} autoComplete="name" /></div></label>}
      <label>E-mail ou login<div className="input-icon"><Mail/><input type="text" name="email" required minLength={3} autoComplete="username" /></div></label>
      <label>Senha<div className="input-icon password-input"><LockKeyhole/><input type={showPassword ? "text" : "password"} name="password" required minLength={6} autoComplete={creating ? "new-password" : "current-password"}/><button type="button" className="password-toggle" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>{showPassword ? <EyeOff/> : <Eye/>}</button></div></label>
      {register && <label>Confirmar senha<div className="input-icon"><LockKeyhole/><input type={showPassword ? "text" : "password"} name="confirmPassword" required minLength={6} autoComplete="new-password" /></div></label>}
      {error && <div className="alert error">{error}</div>}
      <button className="btn primary full" disabled={loading}>{loading ? "Aguarde..." : setup ? "Criar administrador" : register ? "Criar conta" : "Entrar"}</button>
      {!setup && <button type="button" className="auth-switch" onClick={() => { setRegister(v => !v); setError(""); }}>{register ? "Já tenho conta — entrar" : "Não tenho conta — criar conta"}</button>}
      <small>Seus dados são protegidos por autenticação segura.</small>
    </form></section>
  </main>;
}