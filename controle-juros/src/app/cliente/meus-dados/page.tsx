"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { api } from "@/lib/api-client";

export default function MeusDadosPage() {
  const [user, setUser] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ user: any }>("/api/auth/me").then((data) => setUser(data.user)).catch((err) => setError(err.message));
  }, []);

  return (
    <AppShell role="CLIENT" title="Meus dados">
      {error && <div className="alert error">{error}</div>}
      <section className="card">
        <h2>Dados de acesso</h2>
        <p><strong>E-mail/Login:</strong> {user?.email || "-"}</p>
        <p><strong>Perfil:</strong> Cliente</p>
        <p className="muted">Alterações cadastrais devem ser solicitadas ao administrador.</p>
      </section>
    </AppShell>
  );
}
