"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { api } from "@/lib/api-client";

export default function ConfiguracoesPage() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<any>("/api/settings").then(setData).catch((err) => setError(err.message));
  }, []);

  return (
    <AppShell role="ADMIN" title="Configurações">
      {error && <div className="alert error">{error}</div>}
      <section className="card">
        <h2>Ambiente de produção</h2>
        <div className="grid grid-2">
          <div className="card"><h3>DATABASE_URL</h3><div className="metric">{data?.databaseConfigured ? "OK" : "Pendente"}</div><p className="muted">Banco PostgreSQL persistente usado pelo Prisma.</p></div>
          <div className="card"><h3>JWT_SECRET</h3><div className="metric">{data?.jwtConfigured ? "OK" : "Pendente"}</div><p className="muted">Chave usada para autenticação segura.</p></div>
        </div>
        <hr className="hr" />
        <p>Configure essas variáveis no projeto da Vercel antes do deploy em produção.</p>
      </section>
    </AppShell>
  );
}
