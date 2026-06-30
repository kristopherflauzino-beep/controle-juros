import './globals.css';
import { Analytics } from '@vercel/analytics/react';

export const metadata = {
  title: 'Controle Profissional de Juros',
  description: 'Sistema web com admin, cliente, solicitações e relatórios financeiros.'
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
