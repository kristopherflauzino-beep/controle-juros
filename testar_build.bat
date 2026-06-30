const { execSync } = require("child_process");

const url = process.env.DATABASE_URL || "";
const shouldSkip = !url || url.includes("USUARIO:SENHA") || url.includes("postgres:postgres@localhost");

if (shouldSkip) {
  console.log("DATABASE_URL real não encontrada. Pulando prisma migrate deploy durante o build.");
  process.exit(0);
}

try {
  console.log("Aplicando migrations Prisma...");
  execSync("npx prisma migrate deploy", { stdio: "inherit", env: process.env });
} catch (error) {
  console.error("Falha ao aplicar migrations. Verifique DATABASE_URL e permissões do banco.");
  process.exit(1);
}
