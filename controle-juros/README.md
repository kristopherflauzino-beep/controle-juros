# Controle de Juros

Aplicação web completa em Next.js + Prisma + PostgreSQL, preparada para GitHub e Vercel.

## Importante para Vercel

Este projeto não usa `vercel.json`, porque o Vercel detecta Next.js automaticamente. Isso evita erro de validação de `vercel.json`.

## Variáveis de ambiente

Crie na Vercel:

```env
DATABASE_URL=
JWT_SECRET=
```

Use um PostgreSQL compatível com Prisma, como Vercel Postgres/Neon/Supabase.

## Rodar localmente

```bash
npm install
npm run build
npm run dev
```

## Rota de teste

```text
/api/health
```

Retorna status OK.

## Publicar no GitHub

Use a branch `principal`:

```bat
publicar_github.bat
```

O script roda instalação, build, commit e push para:

```text
https://github.com/kristopherflauzino-beep/controle-juros
```
