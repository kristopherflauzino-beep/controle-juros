# Instruções para corrigir GitHub e Vercel

## 1. Extraia o ZIP

Extraia o arquivo `ControleJuros_Pronta_Vercel_GitHub.zip` em uma pasta simples, por exemplo:

```text
C:\controle-juros
```

## 2. Publique no GitHub

Entre na pasta extraída e execute:

```text
scripts\publicar_github_vercel.bat
```

O script já está apontando para:

```text
https://github.com/kristopherflauzino-beep/controle-juros.git
```

Quando o GitHub pedir login, autorize com sua conta.

## 3. Conecte na Vercel

Acesse o projeto:

```text
https://vercel.com/flauzino-s-projects/controle-juros
```

Depois vá em:

```text
Settings > Git > Connect Git Repository
```

Selecione:

```text
kristopherflauzino-beep/controle-juros
```

## 4. Configure variáveis

Em:

```text
Settings > Environment Variables
```

adicione:

```text
JWT_SECRET=uma-chave-grande-e-segura
DATABASE_URL=sua-url-do-postgresql
```

O `DATABASE_URL` é recomendado para produção. Sem ele, os dados podem sumir após novo deploy ou reinicialização da função.

## 5. Faça Redeploy

Depois do push no GitHub, a Vercel deve criar um novo deployment automaticamente.

Se não criar, vá em:

```text
Deployments > ... > Redeploy
```

## 6. Teste

Abra:

```text
https://SEU-DOMINIO/api/health
```

Depois abra a página inicial e crie o usuário administrador no primeiro acesso.


## Caminho correto do projeto Vercel

Esta versão está apontada para o projeto correto:

```text
https://vercel.com/flauzino-s-projects/controle-juros
```

Para fazer deploy diretamente nesse projeto pela CLI, use:

```bash
npx vercel link --project controle-juros --scope flauzino-s-projects
npx vercel --prod --project controle-juros --scope flauzino-s-projects
```

No Windows, também é possível executar:

```text
scripts\deploy_vercel_producao.bat
```
