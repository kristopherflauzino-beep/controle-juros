const { execSync } = require("child_process");

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/controle_juros?schema=public";
}

try {
  execSync("npx prisma generate", { stdio: "inherit", env: process.env });
} catch (error) {
  console.error("Erro ao gerar Prisma Client.");
  process.exit(1);
}
