# Correção final do repositório `controle-juros`

O erro da Vercel acontece porque o arquivo `package.json` publicado no GitHub está com conteúdo de CSS dentro dele, começando por `:root { ... }`.

Além disso, outros arquivos do repositório também foram publicados com conteúdo trocado. Por isso a correção precisa substituir o repositório inteiro pela versão limpa.

## Como corrigir

1. Extraia este ZIP.
2. Entre na pasta `controle-juros-repo-limpo-final`.
3. Dê dois cliques em:

```text
scripts/corrigir_github_force.bat
```

4. Quando o script pedir confirmação, digite:

```text
SIM
```

5. Depois vá na Vercel:

```text
https://vercel.com/flauzino-s-projects/controle-juros
```

6. Clique em:

```text
Deployments > Redeploy
```

## Arquivo package.json correto

O `package.json` correto precisa começar com `{`, assim:

```json
{
  "name": "controle-juros",
  "version": "1.0.0",
  "private": true
}
```

O CSS precisa ficar em:

```text
src/app/globals.css
```
