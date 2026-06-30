"use client";

import { FormEvent, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { brl } from "@/lib/finance";

type Row = { number: number; paymentValue: number; interestValue: number; amortization: number; remainingValue: number };

function roundMoney(value: number) { return Math.round((value + Number.EPSILON) * 100) / 100; }

function calculate(pv: number, ratePercent: number, n: number) {
  if (pv <= 0) throw new Error("Valor financiado deve ser maior que zero.");
  if (ratePercent < 0) throw new Error("Taxa de juros inválida.");
  if (!Number.isInteger(n) || n < 1) throw new Error("Quantidade de parcelas deve ser no mínimo 1.");
  const i = ratePercent / 100;
  const payment = i === 0 ? pv / n : pv * ((i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1));
  const installmentValue = roundMoney(payment);
  const rows: Row[] = [];
  let balance = pv;
  for (let number = 1; number <= n; number++) {
    const interestValue = roundMoney(balance * i);
    let amortization = roundMoney(installmentValue - interestValue);
    if (number === n) amortization = roundMoney(balance);
    const paymentValue = number === n ? roundMoney(interestValue + amortization) : installmentValue;
    balance = roundMoney(balance - amortization);
    rows.push({ number, paymentValue, interestValue, amortization, remainingValue: Math.max(0, balance) });
  }
  const totalFinal = roundMoney(rows.reduce((sum, row) => sum + row.paymentValue, 0));
  return { installmentValue, totalFinal, totalInterest: roundMoney(totalFinal - pv), rows };
}

export default function CalculadoraPage() {
  const [pv, setPv] = useState("1000");
  const [rate, setRate] = useState("2");
  const [n, setN] = useState("12");
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      setResult(calculate(Number(pv), Number(rate), Number(n)));
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <AppShell role="ADMIN" title="Calculadora Tabela Price">
      {error && <div className="alert error">{error}</div>}
      <div className="grid">
        <section className="card">
          <h2>Simular empréstimo bancário</h2>
          <form className="form" onSubmit={submit}>
            <div className="form-row">
              <label>Valor financiado<input type="number" step="0.01" min="0.01" value={pv} onChange={(e) => setPv(e.target.value)} required /></label>
              <label>Taxa de juros por período (%)<input type="number" step="0.0001" min="0" value={rate} onChange={(e) => setRate(e.target.value)} required /></label>
            </div>
            <label>Quantidade de parcelas<input type="number" min="1" step="1" value={n} onChange={(e) => setN(e.target.value)} required /></label>
            <button className="btn">Calcular</button>
          </form>
        </section>
        {result && (
          <>
            <section className="grid grid-4">
              <div className="card"><h3>Valor financiado</h3><div className="metric">{brl(pv)}</div></div>
              <div className="card"><h3>Valor da parcela</h3><div className="metric">{brl(result.installmentValue)}</div></div>
              <div className="card"><h3>Total final</h3><div className="metric">{brl(result.totalFinal)}</div></div>
              <div className="card"><h3>Total de juros</h3><div className="metric">{brl(result.totalInterest)}</div></div>
            </section>
            <section className="card">
              <h2>Tabela parcela por parcela</h2>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Nº</th><th>Parcela</th><th>Juros</th><th>Amortização</th><th>Saldo devedor</th></tr></thead>
                  <tbody>{result.rows.map((row: Row) => <tr key={row.number}><td>{row.number}</td><td>{brl(row.paymentValue)}</td><td>{brl(row.interestValue)}</td><td>{brl(row.amortization)}</td><td>{brl(row.remainingValue)}</td></tr>)}</tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
