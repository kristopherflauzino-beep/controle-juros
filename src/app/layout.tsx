import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Controle de Juros", description: "Gestão profissional de acordos e empréstimos" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
