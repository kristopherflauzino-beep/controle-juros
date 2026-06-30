# Correção do erro do Vercel: package.json inválido

Erro recebido:

```text
/vercel/path0/package.json: Token inesperado ':', ":root { "... não é um JSON válido
```

Isso acontece quando o arquivo `package.json` do repositório foi sobrescrito com conteúdo CSS, normalmente do arquivo `src/app/globals.css`, que começa com `:root { ... }`.

## Correção aplicada nesta versão

- `package.json` foi refeito como JSON válido.
- `package-lock.json` foi removido para a Vercel gerar um novo lock usando o registry público do npm.
- `.npmrc` foi adicionado para forçar `https://registry.npmjs.org/`.
- Dependências foram fixadas em versões estáveis compatíveis com Next.js na Vercel.

## Como publicar

Substitua todos os arquivos do seu repositório por estes arquivos, depois rode:

```bash
git add -A
git commit -m "Corrige package json e deploy Vercel"
git push origin main
```

Depois, na Vercel, rode um novo deploy em produção.
