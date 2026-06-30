'use client';

import { useEffect, useMemo, useState } from 'react';
import { brl, dateBR, pricePayment } from '@/lib/finance';

const emptyLogin = { email: '', password: '' };
const emptySetup = { name: '', email: '', password: '' };
const emptyClient = { id: '', name: '', email: '', password: '', document: '', phone: '' };
const emptyRequest = { amount: '', installments: 1, notes: '' };
const emptyAgreement = {
  id: '', clientId: '', requestId: '', description: 'Acordo financeiro', principal: '', installments: 1,
  periodRate: 3.5, dailyRate: 0.3, dueDate: '', status: 'aberto'
};

function StatusBadge({ value }) {
  const label = String(value || '').toLowerCase();
  return <span className={`badge badge-${label}`}>{value || '-'}</span>;
}

function Field({ label, children }) {
  return <label className="field"><span>{label}</span>{children}</label>;
}

function Stat({ label, value, hint }) {
  return <div className="stat"><span>{label}</span><strong>{value}</strong>{hint ? <small>{hint}</small> : null}</div>;
}

export default function HomePage() {
  const [token, setToken] = useState('');
  const [user, setUser] = useState(null);
  const [setupRequired, setSetupRequired] = useState(false);
  const [data, setData] = useState({ clients: [], requests: [], agreements: [], users: [] });
  const [meta, setMeta] = useState(null);
  const [active, setActive] = useState('dashboard');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [login, setLogin] = useState(emptyLogin);
  const [setup, setSetup] = useState(emptySetup);
  const [clientForm, setClientForm] = useState(emptyClient);
  const [requestForm, setRequestForm] = useState(emptyRequest);
  const [agreementForm, setAgreementForm] = useState(emptyAgreement);
  const [clientFilter, setClientFilter] = useState('todos');

  const isAdmin = user?.role === 'admin';

  async function api(action, payload = {}) {
    setMessage('');
    const res = await fetch('/api/app', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ action, payload })
    });
    const result = await res.json();
    if (!result.ok) throw new Error(result.message || 'Erro na operação.');
    if (result.token) {
      localStorage.setItem('jc_token', result.token);
      setToken(result.token);
    }
    if (result.user) setUser(result.user);
    if (result.data) setData(result.data);
    if (result.meta) setMeta(result.meta);
    return result;
  }

  async function refresh(existingToken = token) {
    const res = await fetch('/api/app', { headers: existingToken ? { Authorization: `Bearer ${existingToken}` } : {} });
    const result = await res.json();
    if (result.ok) {
      setSetupRequired(result.setupRequired);
      setUser(result.user);
      if (result.data) setData(result.data);
      if (result.meta) setMeta(result.meta);
    }
  }

  useEffect(() => {
    const saved = localStorage.getItem('jc_token') || '';
    setToken(saved);
    refresh(saved).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setClientFilter('todos');
    if (user?.role === 'client') setActive('clientRequest');
    if (user?.role === 'admin') setActive('dashboard');
  }, [user?.role]);

  const filteredAgreements = useMemo(() => {
    if (clientFilter === 'todos') return data.agreements || [];
    return (data.agreements || []).filter(a => a.clientId === clientFilter);
  }, [data.agreements, clientFilter]);

  const totals = useMemo(() => {
    const list = filteredAgreements;
    return {
      principal: list.reduce((s, a) => s + Number(a.principal || 0), 0),
      financed: list.reduce((s, a) => s + Number(a.financedTotal || 0), 0),
      updated: list.reduce((s, a) => s + Number(a.updatedTotal || 0), 0),
      open: list.filter(a => a.status !== 'quitado').length
    };
  }, [filteredAgreements]);

  async function handleSetup(e) {
    e.preventDefault();
    try {
      await api('setup', setup);
      setSetup(emptySetup);
      setMessage('Administrador criado com sucesso.');
    } catch (err) { setMessage(err.message); }
  }

  async function handleLogin(e) {
    e.preventDefault();
    try {
      await api('login', login);
      setLogin(emptyLogin);
    } catch (err) { setMessage(err.message); }
  }

  function logout() {
    localStorage.removeItem('jc_token');
    setToken('');
    setUser(null);
    setData({ clients: [], requests: [], agreements: [], users: [] });
    setMeta(null);
  }

  async function saveClient(e) {
    e.preventDefault();
    try {
      if (clientForm.id) {
        await api('updateClient', clientForm);
        setMessage('Cliente atualizado.');
      } else {
        await api('createClient', clientForm);
        setMessage('Cliente criado.');
      }
      setClientForm(emptyClient);
    } catch (err) { setMessage(err.message); }
  }

  async function submitRequest(e) {
    e.preventDefault();
    try {
      await api('createRequest', requestForm);
      setRequestForm(emptyRequest);
      setMessage('Solicitação enviada ao administrador.');
    } catch (err) { setMessage(err.message); }
  }

  async function saveAgreement(e) {
    e.preventDefault();
    try {
      if (agreementForm.id) {
        await api('updateAgreement', agreementForm);
        setMessage('Relatório atualizado.');
      } else {
        await api('createAgreement', agreementForm);
        setMessage('Relatório criado.');
      }
      setAgreementForm(emptyAgreement);
    } catch (err) { setMessage(err.message); }
  }

  function editAgreement(a) {
    setAgreementForm({
      id: a.id,
      clientId: a.clientId,
      requestId: a.requestId || '',
      description: a.description,
      principal: a.principal,
      installments: a.installments,
      periodRate: a.periodRate,
      dailyRate: a.dailyRate,
      dueDate: a.dueDate ? String(a.dueDate).slice(0, 10) : '',
      status: a.status
    });
    setActive('reports');
  }

  async function createAgreementFromRequest(r) {
    setAgreementForm({
      ...emptyAgreement,
      clientId: r.clientId,
      requestId: r.id,
      principal: r.amount,
      installments: r.installments,
      description: `Solicitação de ${brl(r.amount)} - ${r.installments}x`
    });
    setActive('reports');
  }

  async function exportPdf() {
    const { jsPDF } = await import('jspdf');
    const autoTableModule = await import('jspdf-autotable');
    const autoTable = autoTableModule.default || autoTableModule.autoTable;
    const doc = new jsPDF({ orientation: 'landscape' });
    const title = clientFilter === 'todos' ? 'Relatório geral de juros' : `Relatório - ${data.clients.find(c => c.id === clientFilter)?.name || 'Cliente'}`;
    doc.setFontSize(16);
    doc.text('Controle Profissional de Juros', 14, 16);
    doc.setFontSize(11);
    doc.text(title, 14, 24);
    doc.text(`Emitido em: ${new Date().toLocaleString('pt-BR')}`, 14, 31);
    autoTable(doc, {
      startY: 38,
      head: [['Cliente', 'Descrição', 'Principal', 'Parcelas', 'Taxa', 'Parcela', 'Total Price', 'Juros diário', 'Dias', 'Atualizado', 'Status']],
      body: filteredAgreements.map(a => [
        a.clientName, a.description, brl(a.principal), `${a.installments}x`, `${a.periodRate}%`, brl(a.payment),
        brl(a.financedTotal), `${a.dailyRate}%`, String(a.dailyDays), brl(a.updatedTotal), a.status
      ]),
      styles: { fontSize: 8 }
    });
    const y = (doc.lastAutoTable?.finalY || 38) + 8;
    doc.text(`Total financiado: ${brl(totals.financed)}`, 14, y);
    doc.text(`Total atualizado: ${brl(totals.updated)}`, 90, y);
    doc.save('relatorio-controle-juros.pdf');
  }

  if (loading) return <main className="center"><div className="loader">Carregando sistema...</div></main>;

  if (!user) {
    return (
      <main className="authPage">
        <section className="authBrand">
          <div className="logoMark">CJ</div>
          <h1>Controle Profissional de Juros</h1>
          <p>Sistema web para admin, clientes, solicitações, acordos, juros bancário e relatórios em PDF.</p>
          <div className="authFeatures">
            <span>Login seguro</span><span>Tabela Price</span><span>Relatórios por cliente</span>
          </div>
        </section>
        <section className="authCard">
          <h2>{setupRequired ? 'Primeiro acesso do administrador' : 'Entrar no sistema'}</h2>
          <p>{setupRequired ? 'Crie o usuário administrador inicial.' : 'Informe seu login e senha para acessar.'}</p>
          {setupRequired ? (
            <form onSubmit={handleSetup} className="formGrid one">
              <Field label="Nome"><input value={setup.name} onChange={e=>setSetup({...setup,name:e.target.value})} /></Field>
              <Field label="E-mail"><input type="email" value={setup.email} onChange={e=>setSetup({...setup,email:e.target.value})} /></Field>
              <Field label="Senha"><input type="password" value={setup.password} onChange={e=>setSetup({...setup,password:e.target.value})} /></Field>
              <button className="primary">Criar administrador</button>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="formGrid one">
              <Field label="E-mail"><input type="email" value={login.email} onChange={e=>setLogin({...login,email:e.target.value})} /></Field>
              <Field label="Senha"><input type="password" value={login.password} onChange={e=>setLogin({...login,password:e.target.value})} /></Field>
              <button className="primary">Acessar</button>
            </form>
          )}
          {message && <div className="message">{message}</div>}
        </section>
      </main>
    );
  }

  const menus = isAdmin
    ? [['dashboard','Painel'], ['clients','Cliente'], ['requests','Solicitações'], ['reports','Relatório']]
    : [['clientRequest','Solicitar valor'], ['clientReports','Relatório']];

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand"><div className="logoMark small">CJ</div><div><strong>Controle de Juros</strong><span>Admin & Cliente</span></div></div>
        <nav>{menus.map(([key,label]) => <button key={key} className={active===key?'active':''} onClick={()=>setActive(key)}>{label}</button>)}</nav>
        <div className="userBox"><strong>{user.name}</strong><span>{user.email}</span><StatusBadge value={user.role === 'admin' ? 'admin' : 'cliente'} /><button className="ghost" onClick={logout}>Sair</button></div>
      </aside>
      <section className="content">
        <header className="topbar"><div><h1>{menus.find(m=>m[0]===active)?.[1] || 'Painel'}</h1><p>Gestão de clientes, acordos e juros com padrão profissional.</p></div>{message && <div className="message top">{message}</div>}</header>
        {meta?.storage && !meta.storage.persistent && isAdmin && (
          <div className="warningBox">
            <strong>Atenção:</strong> {meta.storage.message}
          </div>
        )}

        {active === 'dashboard' && isAdmin && (
          <section className="gridCards">
            <Stat label="Clientes cadastrados" value={data.clients.length} />
            <Stat label="Solicitações pendentes" value={(data.requests||[]).filter(r=>r.status==='pendente').length} />
            <Stat label="Relatórios em aberto" value={totals.open} />
            <Stat label="Total atualizado" value={brl((data.agreements||[]).reduce((s,a)=>s+Number(a.updatedTotal||0),0))} />
          </section>
        )}

        {active === 'clients' && isAdmin && (
          <section className="panel twoCols">
            <form onSubmit={saveClient} className="card formGrid one">
              <h2>{clientForm.id ? 'Editar cliente' : 'Novo cliente'}</h2>
              <Field label="Nome"><input value={clientForm.name} onChange={e=>setClientForm({...clientForm,name:e.target.value})} /></Field>
              <Field label="E-mail/login"><input type="email" value={clientForm.email} onChange={e=>setClientForm({...clientForm,email:e.target.value})} /></Field>
              {!clientForm.id && <Field label="Senha inicial"><input type="password" value={clientForm.password} onChange={e=>setClientForm({...clientForm,password:e.target.value})} /></Field>}
              <Field label="CPF/CNPJ"><input value={clientForm.document} onChange={e=>setClientForm({...clientForm,document:e.target.value})} /></Field>
              <Field label="Telefone"><input value={clientForm.phone} onChange={e=>setClientForm({...clientForm,phone:e.target.value})} /></Field>
              <button className="primary">{clientForm.id ? 'Salvar cliente' : 'Cadastrar cliente'}</button>
              {clientForm.id && <button type="button" className="ghost" onClick={()=>setClientForm(emptyClient)}>Cancelar edição</button>}
            </form>
            <div className="card"><h2>Clientes</h2><div className="tableWrap"><table><thead><tr><th>Nome</th><th>E-mail</th><th>Telefone</th><th>Ações</th></tr></thead><tbody>{data.clients.map(c=><tr key={c.id}><td>{c.name}</td><td>{c.email}</td><td>{c.phone || '-'}</td><td><button onClick={()=>setClientForm({...emptyClient,...c,password:''})}>Editar</button><button className="danger" onClick={()=>api('deleteClient',{id:c.id}).catch(e=>setMessage(e.message))}>Remover</button></td></tr>)}</tbody></table></div></div>
          </section>
        )}

        {active === 'clientRequest' && !isAdmin && (
          <section className="panel twoCols">
            <form onSubmit={submitRequest} className="card formGrid one">
              <h2>Solicitar valor</h2>
              <Field label="Valor solicitado"><input value={requestForm.amount} onChange={e=>setRequestForm({...requestForm,amount:e.target.value})} placeholder="Ex: 1000,00" /></Field>
              <Field label="Quantidade de parcelas"><input type="number" min="1" value={requestForm.installments} onChange={e=>setRequestForm({...requestForm,installments:e.target.value})} /></Field>
              <Field label="Observação"><textarea value={requestForm.notes} onChange={e=>setRequestForm({...requestForm,notes:e.target.value})} /></Field>
              <button className="primary">Enviar solicitação</button>
            </form>
            <div className="card"><h2>Minhas solicitações</h2><RequestTable requests={data.requests || []} isAdmin={false} /></div>
          </section>
        )}

        {active === 'requests' && isAdmin && (
          <section className="card"><h2>Solicitações de clientes</h2><RequestTable requests={data.requests || []} isAdmin onApprove={createAgreementFromRequest} onStatus={(id,status)=>api('updateRequest',{id,status}).catch(e=>setMessage(e.message))} /></section>
        )}

        {((active === 'reports' && isAdmin) || (active === 'clientReports' && !isAdmin)) && (
          <section className="reports">
            <div className="toolbar card">
              <div><h2>Relatórios por cliente</h2><p>Tabela Price + juros diário composto iniciado manualmente.</p></div>
              <div className="toolbarActions">
                {isAdmin && <select value={clientFilter} onChange={e=>setClientFilter(e.target.value)}><option value="todos">Todos os clientes</option>{data.clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>}
                <button className="primary" onClick={exportPdf}>Gerar PDF</button>
              </div>
            </div>
            <section className="gridCards smallStats">
              <Stat label="Principal" value={brl(totals.principal)} />
              <Stat label="Total Price" value={brl(totals.financed)} />
              <Stat label="Atualizado" value={brl(totals.updated)} />
              <Stat label="Em aberto" value={totals.open} />
            </section>
            {isAdmin && (
              <form onSubmit={saveAgreement} className="card formGrid four">
                <h2>{agreementForm.id ? 'Editar relatório/acordo' : 'Novo relatório/acordo'}</h2>
                <Field label="Cliente"><select value={agreementForm.clientId} onChange={e=>setAgreementForm({...agreementForm,clientId:e.target.value})}><option value="">Selecione</option>{data.clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
                <Field label="Descrição"><input value={agreementForm.description} onChange={e=>setAgreementForm({...agreementForm,description:e.target.value})} /></Field>
                <Field label="Valor financiado"><input value={agreementForm.principal} onChange={e=>setAgreementForm({...agreementForm,principal:e.target.value})} /></Field>
                <Field label="Parcelas"><input type="number" min="1" value={agreementForm.installments} onChange={e=>setAgreementForm({...agreementForm,installments:e.target.value})} /></Field>
                <Field label="Taxa por período %"><input value={agreementForm.periodRate} onChange={e=>setAgreementForm({...agreementForm,periodRate:e.target.value})} /></Field>
                <Field label="Juros diário %"><input value={agreementForm.dailyRate} onChange={e=>setAgreementForm({...agreementForm,dailyRate:e.target.value})} /></Field>
                <Field label="Vencimento"><input type="date" value={agreementForm.dueDate} onChange={e=>setAgreementForm({...agreementForm,dueDate:e.target.value})} /></Field>
                <Field label="Status"><select value={agreementForm.status} onChange={e=>setAgreementForm({...agreementForm,status:e.target.value})}><option value="aberto">Aberto</option><option value="quitado">Quitado</option></select></Field>
                <div className="previewBox"><strong>Prévia:</strong> parcela de {brl(pricePayment(agreementForm.principal, agreementForm.periodRate, agreementForm.installments))}</div>
                <button className="primary">{agreementForm.id ? 'Salvar alterações' : 'Criar relatório'}</button>
                {agreementForm.id && <button type="button" className="ghost" onClick={()=>setAgreementForm(emptyAgreement)}>Cancelar edição</button>}
              </form>
            )}
            <AgreementTable agreements={filteredAgreements} isAdmin={isAdmin} onEdit={editAgreement} onStart={(id)=>api('startDailyInterest',{id}).catch(e=>setMessage(e.message))} onPaid={(id)=>api('markPaid',{id}).catch(e=>setMessage(e.message))} onDelete={(id)=>api('deleteAgreement',{id}).catch(e=>setMessage(e.message))} />
          </section>
        )}
      </section>
    </main>
  );
}

function RequestTable({ requests, isAdmin, onApprove, onStatus }) {
  return <div className="tableWrap"><table><thead><tr><th>Cliente</th><th>Valor</th><th>Parcelas</th><th>Data</th><th>Status</th>{isAdmin && <th>Ações</th>}</tr></thead><tbody>{requests.map(r=><tr key={r.id}><td>{r.clientName || '-'}</td><td>{brl(r.amount)}</td><td>{r.installments}x</td><td>{dateBR(r.createdAt)}</td><td><StatusBadge value={r.status} /></td>{isAdmin && <td><button onClick={()=>onApprove(r)}>Gerar acordo</button><button onClick={()=>onStatus(r.id,'rejeitada')} className="danger">Rejeitar</button></td>}</tr>)}</tbody></table>{requests.length===0 && <div className="empty">Nenhuma solicitação encontrada.</div>}</div>;
}

function AgreementTable({ agreements, isAdmin, onEdit, onStart, onPaid, onDelete }) {
  return <div className="card tableWrap"><table><thead><tr><th>Cliente</th><th>Descrição</th><th>Principal</th><th>Parcelas</th><th>Parcela</th><th>Total Price</th><th>Juros diário</th><th>Dias</th><th>Atualizado</th><th>Status</th>{isAdmin && <th>Ações</th>}</tr></thead><tbody>{agreements.map(a=><tr key={a.id}><td>{a.clientName}</td><td>{a.description}</td><td>{brl(a.principal)}</td><td>{a.installments}x</td><td>{brl(a.payment)}</td><td>{brl(a.financedTotal)}</td><td>{a.dailyRate}%</td><td>{a.dailyDays}</td><td><strong>{brl(a.updatedTotal)}</strong></td><td><StatusBadge value={a.status} /></td>{isAdmin && <td className="actions"><button onClick={()=>onEdit(a)}>Editar</button><button onClick={()=>onStart(a.id)}>Iniciar juros</button><button onClick={()=>onPaid(a.id)}>Quitar</button><button className="danger" onClick={()=>onDelete(a.id)}>Excluir</button></td>}</tr>)}</tbody></table>{agreements.length===0 && <div className="empty">Nenhum relatório encontrado.</div>}</div>;
}
