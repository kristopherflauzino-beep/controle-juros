const url = process.argv[2];
if (!url) {
  console.log('Uso: node scripts/health-check.js https://seu-dominio.vercel.app');
  process.exit(1);
}
fetch(`${url.replace(/\/$/, '')}/api/health`)
  .then(async (res) => {
    const text = await res.text();
    console.log('Status:', res.status);
    console.log(text);
    if (!res.ok) process.exit(1);
  })
  .catch((err) => {
    console.error('Falha ao testar:', err.message);
    process.exit(1);
  });
