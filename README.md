# Controle de Juros

Aplicação web em Next.js para gestão de clientes, solicitações, acordos, Tabela Price, juros diário composto e relatórios PDF.

## Configuração local

1. Execute `instalar.bat` ou `npm install`.
2. Copie `.env.example` para `.env` e preencha `DATABASE_URL` e `JWT_SECRET`.
3. Crie as tabelas com `npx prisma migrate deploy`.
4. Execute `npm run dev` e abra `http://localhost:3000`.
5. No primeiro acesso, cadastre o administrador.

## Deploy na Vercel

Configure `DATABASE_URL` e `JWT_SECRET` nas variáveis de ambiente do projeto. Use um PostgreSQL acessível pela Vercel. Antes do primeiro acesso em produção, execute `npx prisma migrate deploy` com a URL do banco. O Vercel detecta o Next.js automaticamente; por isso este projeto não usa `vercel.json`.

## Segurança e regras

- Senhas protegidas com bcrypt.
- Sessão JWT em cookie HTTP-only.
- Admin vê e altera todos os dados; cliente acessa somente seus próprios pedidos e relatórios.
- O juros diário começa exclusivamente pelo botão **Iniciar juros diário** e preserva sua data inicial nas edições.
- Rota de monitoramento: `/api/health`.
