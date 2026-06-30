"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const adminMenu = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/clientes", label: "Clientes" },
  { href: "/admin/solicitacoes", label: "Solicitações" },
  { href: "/admin/calculadora", label: "Calculadora" },
  { href: "/admin/relatorios", label: "Relatórios" },
  { href: "/admin/configuracoes", label: "Configurações" }
];

const clientMenu = [
  { href: "/cliente/solicitar", label: "Solicitar valor" },
  { href: "/cliente/relatorios", label: "Meus relatórios" },
  { href: "/cliente/meus-dados", label: "Meus dados" }
];

export function AppShell({
  role,
  title,
  children
}: {
  role: "ADMIN" | "CLIENT";
  title: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const menu = role === "ADMIN" ? adminMenu : clientMenu;

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">CJ</div>
          <div>
            <strong>Controle de Juros</strong>
            <span>{role === "ADMIN" ? "Admin" : "Cliente"}</span>
          </div>
        </div>
        <nav className="nav">
          {menu.map((item) => (
            <Link key={item.href} href={item.href} className={pathname === item.href ? "active" : ""}>
              {item.label}
            </Link>
          ))}
          <button className="nav-button" onClick={logout}>Sair</button>
        </nav>
      </aside>
      <main className="main">
        <header className="topbar">
          <div>
            <p className="eyebrow">Sistema financeiro</p>
            <h1>{title}</h1>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
