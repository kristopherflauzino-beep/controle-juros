# Controle de Juros - Web para Vercel

Sistema web com login de administrador e cliente para controle de solicitações, acordos, cálculo bancário e relatório em PDF.

## Funções

- Primeiro acesso para criar o administrador.
- Login de administrador e cliente.
- Admin cadastra clientes.
- Cliente solicita valor.
- Admin aprova solicitação e cria acordo.
- Cálculo bancário por Tabela Price.
- Juros diário composto iniciado manualmente pelo admin.
- Relatórios separados por cliente.
- Exportação de relatório em PDF.
- Rota `/api/health` para testar se o deploy está funcionando.

## Cálculo usado

A parcela fixa usa Tabela Price:

```text
Parcela = PV x [ i x (1 + i)^n ] / [ (1 + i)^n - 1 ]
```

O juros diário do relatório é composto e só começa quando o admin clica em **Iniciar juros diário**:

```text
Valor atualizado = Total Price x (1 + juros diário)^dias
```

## Rodar localmente

```bash
npm install
npm run dev
```

Para validar o build antes do deploy:

```bash
npm run build
```

## Publicar no GitHub

Este projeto já está configurado para o repositório:

```text
https://github.com/kristopherflauzino-beep/controle-juros.git
```

No Windows, entre na pasta do projeto e execute:

```text
scripts/publicar_github_vercel.bat
```

O script faz:

- instala dependências;
- valida `npm run build`;
- cria commit;
- envia para a branch `main` do GitHub.

Se o repositório remoto já tiver arquivos diferentes, o script pergunta se você quer substituir o conteúdo remoto pela versão corrigida usando `--force-with-lease`.

## Deploy na Vercel

No painel da Vercel, conecte o repositório GitHub `kristopherflauzino-beep/controle-juros` ao projeto `controle-juros`.

Configuração recomendada:

```text
Framework Preset: Next.js
Build Command: npm run build
Install Command: npm install
Output Directory: .next
Node.js: 20 ou superior
```

O arquivo `vercel.json` já deixa isso configurado.

## Variáveis de ambiente

Em produção, configure em **Vercel > Project > Settings > Environment Variables**:

```text
JWT_SECRET=coloque-uma-chave-grande-e-segura
DATABASE_URL=postgresql://usuario:senha@host:5432/banco?sslmode=require
```

Sem `DATABASE_URL`, o site sobe e funciona para teste, mas os dados ficam temporários na Vercel. Para uso real, use PostgreSQL.

## Teste depois do deploy

Abra:

```text
https://SEU-DOMINIO/api/health
```

Resposta esperada:

```json
{
  "ok": true,
  "app": "controle-juros"
}
```

Também é possível testar pelo terminal:

```bash
node scripts/health-check.js https://SEU-DOMINIO.vercel.app
```


## Projeto Vercel correto

Este pacote foi ajustado para usar o projeto da Vercel:

```text
https://vercel.com/flauzino-s-projects/controle-juros
```

Scripts de deploy já apontam para:

```text
Projeto: controle-juros
Equipe/escopo: flauzino-s-projects
```
