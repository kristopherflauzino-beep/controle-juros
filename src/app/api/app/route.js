import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { authenticate, getUserFromRequest, hashPassword, signToken } from '@/lib/auth';
import { calculateAgreement, toNumber } from '@/lib/finance';
import {
  createAgreement, createRequest, createUser, deleteAgreement, deleteUser, findUserByEmail,
  getAgreements, getRequests, getUsers, publicUser, storageStatus, updateAgreement, updateRequest, updateUser
} from '@/lib/store';

function ok(data = {}) {
  return NextResponse.json({ ok: true, meta: { storage: storageStatus() }, ...data });
}

function fail(message, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}

function requireFields(payload, fields) {
  for (const field of fields) {
    if (payload[field] === undefined || payload[field] === null || String(payload[field]).trim() === '') {
      return `Campo obrigatório: ${field}`;
    }
  }
  return null;
}

async function setupRequired() {
  const users = await getUsers();
  return !users.some(u => u.role === 'admin');
}

function attachNames(items, clients) {
  const byId = new Map(clients.map(c => [c.id, c]));
  return items.map(item => ({ ...item, clientName: byId.get(item.clientId)?.name || 'Cliente removido', clientEmail: byId.get(item.clientId)?.email || '' }));
}

async function appData(user) {
  const users = (await getUsers()).map(publicUser);
  const clients = users.filter(u => u.role === 'client');
  const allRequests = await getRequests();
  const allAgreements = (await getAgreements()).map(a => calculateAgreement(a));

  if (user.role === 'admin') {
    return {
      users,
      clients,
      requests: attachNames(allRequests, clients),
      agreements: attachNames(allAgreements, clients)
    };
  }

  return {
    users: [publicUser(user)],
    clients: [publicUser(user)],
    requests: attachNames(allRequests.filter(r => r.clientId === user.id), [publicUser(user)]),
    agreements: attachNames(allAgreements.filter(a => a.clientId === user.id), [publicUser(user)])
  };
}

export async function GET(request) {
  const user = await getUserFromRequest(request);
  const needsSetup = await setupRequired();
  if (!user) return ok({ setupRequired: needsSetup, user: null, data: null });
  return ok({ setupRequired: false, user: publicUser(user), data: await appData(user) });
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return fail('JSON inválido.');
  }
  const { action, payload = {} } = body;

  if (action === 'setup') {
    if (!(await setupRequired())) return fail('O administrador já foi criado.', 409);
    const missing = requireFields(payload, ['name', 'email', 'password']);
    if (missing) return fail(missing);
    if (String(payload.password).length < 6) return fail('A senha precisa ter pelo menos 6 caracteres.');
    const user = await createUser({
      name: payload.name, email: payload.email, passwordHash: await hashPassword(payload.password), role: 'admin'
    });
    return ok({ user: publicUser(user), token: signToken(user), data: await appData(user) });
  }

  if (action === 'login') {
    const user = await authenticate(payload.email, payload.password);
    if (!user) return fail('Login ou senha inválidos.', 401);
    return ok({ user: publicUser(user), token: signToken(user), data: await appData(user) });
  }

  const user = await getUserFromRequest(request);
  if (!user) return fail('Acesso não autorizado.', 401);

  const adminOnly = ['createClient', 'updateClient', 'deleteClient', 'updateRequest', 'createAgreement', 'updateAgreement', 'deleteAgreement', 'startDailyInterest', 'markPaid'];
  if (adminOnly.includes(action) && user.role !== 'admin') return fail('Ação permitida somente para administrador.', 403);

  try {
    if (action === 'createClient') {
      const missing = requireFields(payload, ['name', 'email', 'password']);
      if (missing) return fail(missing);
      if (await findUserByEmail(payload.email)) return fail('Já existe usuário com este e-mail.', 409);
      const client = await createUser({
        name: payload.name, email: payload.email, document: payload.document, phone: payload.phone,
        passwordHash: await hashPassword(payload.password), role: 'client'
      });
      return ok({ item: publicUser(client), data: await appData(user) });
    }

    if (action === 'updateClient') {
      const client = await updateUser(payload.id, payload);
      return ok({ item: publicUser(client), data: await appData(user) });
    }

    if (action === 'deleteClient') {
      await deleteUser(payload.id);
      return ok({ data: await appData(user) });
    }

    if (action === 'createRequest') {
      const clientId = user.role === 'admin' ? payload.clientId : user.id;
      if (!clientId) return fail('Cliente não informado.');
      const requestItem = await createRequest({
        clientId,
        amount: toNumber(payload.amount),
        installments: Math.max(1, parseInt(payload.installments || 1, 10)),
        notes: payload.notes || ''
      });
      return ok({ item: requestItem, data: await appData(user) });
    }

    if (action === 'updateRequest') {
      const requestItem = await updateRequest(payload.id, { status: payload.status, adminNote: payload.adminNote || '' });
      return ok({ item: requestItem, data: await appData(user) });
    }

    if (action === 'createAgreement') {
      const missing = requireFields(payload, ['clientId', 'principal', 'installments']);
      if (missing) return fail(missing);
      const agreement = await createAgreement({
        clientId: payload.clientId,
        requestId: payload.requestId || null,
        description: payload.description || 'Acordo financeiro',
        principal: toNumber(payload.principal),
        installments: Math.max(1, parseInt(payload.installments || 1, 10)),
        periodRate: toNumber(payload.periodRate),
        dailyRate: toNumber(payload.dailyRate),
        dueDate: payload.dueDate || null,
        status: payload.status || 'aberto'
      });
      if (payload.requestId) await updateRequest(payload.requestId, { status: 'aprovada', adminNote: 'Acordo gerado pelo administrador.' });
      return ok({ item: calculateAgreement(agreement), data: await appData(user) });
    }

    if (action === 'updateAgreement') {
      const agreement = await updateAgreement(payload.id, {
        clientId: payload.clientId,
        description: payload.description,
        principal: toNumber(payload.principal),
        installments: Math.max(1, parseInt(payload.installments || 1, 10)),
        periodRate: toNumber(payload.periodRate),
        dailyRate: toNumber(payload.dailyRate),
        dueDate: payload.dueDate || null,
        status: payload.status || 'aberto'
      });
      return ok({ item: calculateAgreement(agreement), data: await appData(user) });
    }

    if (action === 'startDailyInterest') {
      const agreement = await updateAgreement(payload.id, { startInterestAt: new Date().toISOString() });
      return ok({ item: calculateAgreement(agreement), data: await appData(user) });
    }

    if (action === 'markPaid') {
      const agreement = await updateAgreement(payload.id, { status: 'quitado' });
      return ok({ item: calculateAgreement(agreement), data: await appData(user) });
    }

    if (action === 'deleteAgreement') {
      await deleteAgreement(payload.id);
      return ok({ data: await appData(user) });
    }

    return fail('Ação não reconhecida.', 404);
  } catch (error) {
    console.error(error);
    return fail(error.message || 'Erro interno.', 500);
  }
}
