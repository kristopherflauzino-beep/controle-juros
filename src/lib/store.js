import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { Pool } from 'pg';

const DEFAULT_DATA = { users: [], requests: [], agreements: [] };
const LOCAL_DB_FILE = path.join(process.cwd(), 'data', 'local-db.json');
const SERVERLESS_DB_FILE = path.join('/tmp', 'juros-control-web', 'local-db.json');
const DB_FILE = process.env.VERCEL ? SERVERLESS_DB_FILE : LOCAL_DB_FILE;
const MEMORY_KEY = '__JUROS_CONTROL_WEB_DB__';

let pool;
let schemaReady = false;

function emptyData() {
  return { users: [], requests: [], agreements: [] };
}

export function storageStatus() {
  if (hasDatabaseUrl()) {
    return { mode: 'postgres', persistent: true, message: 'Banco PostgreSQL conectado.' };
  }
  if (process.env.VERCEL) {
    return {
      mode: 'temporary',
      persistent: false,
      message: 'Sem DATABASE_URL. O sistema roda na Vercel em modo temporário; configure um PostgreSQL para salvar dados permanentemente.'
    };
  }
  return { mode: 'local-file', persistent: true, message: 'Banco local em arquivo JSON para desenvolvimento.' };
}

function hasDatabaseUrl() {
  return Boolean(process.env.DATABASE_URL);
}

function getPool() {
  if (!pool) {
    const ssl = process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false };
    pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl });
  }
  return pool;
}

function nowIso() {
  return new Date().toISOString();
}

function id() {
  return randomUUID();
}

function normalizeUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.password_hash ?? row.passwordHash,
    role: row.role,
    document: row.document || '',
    phone: row.phone || '',
    createdAt: row.created_at ?? row.createdAt
  };
}

function normalizeRequest(row) {
  if (!row) return null;
  return {
    id: row.id,
    clientId: row.client_id ?? row.clientId,
    amount: Number(row.amount || 0),
    installments: Number(row.installments || 1),
    notes: row.notes || '',
    status: row.status || 'pendente',
    adminNote: row.admin_note ?? row.adminNote ?? '',
    createdAt: row.created_at ?? row.createdAt,
    updatedAt: row.updated_at ?? row.updatedAt
  };
}

function normalizeAgreement(row) {
  if (!row) return null;
  return {
    id: row.id,
    clientId: row.client_id ?? row.clientId,
    requestId: row.request_id ?? row.requestId ?? null,
    description: row.description || '',
    principal: Number(row.principal || 0),
    installments: Number(row.installments || 1),
    periodRate: Number(row.period_rate ?? row.periodRate ?? 0),
    dailyRate: Number(row.daily_rate ?? row.dailyRate ?? 0),
    dueDate: row.due_date ?? row.dueDate ?? '',
    startInterestAt: row.start_interest_at ?? row.startInterestAt ?? null,
    status: row.status || 'aberto',
    createdAt: row.created_at ?? row.createdAt,
    updatedAt: row.updated_at ?? row.updatedAt
  };
}

export function publicUser(user) {
  if (!user) return null;
  const normalized = normalizeUser(user);
  const { passwordHash, ...safe } = normalized;
  return safe;
}

async function ensureSchema() {
  if (!hasDatabaseUrl()) return;
  if (schemaReady) return;
  const db = getPool();
  await db.query(`
    create table if not exists jc_users (
      id text primary key,
      name text not null,
      email text unique not null,
      password_hash text not null,
      role text not null check (role in ('admin','client')),
      document text default '',
      phone text default '',
      created_at timestamptz not null default now()
    );

    create table if not exists jc_requests (
      id text primary key,
      client_id text not null references jc_users(id) on delete cascade,
      amount numeric not null default 0,
      installments integer not null default 1,
      notes text default '',
      status text not null default 'pendente',
      admin_note text default '',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists jc_agreements (
      id text primary key,
      client_id text not null references jc_users(id) on delete cascade,
      request_id text references jc_requests(id) on delete set null,
      description text default '',
      principal numeric not null default 0,
      installments integer not null default 1,
      period_rate numeric not null default 0,
      daily_rate numeric not null default 0,
      due_date date,
      start_interest_at timestamptz,
      status text not null default 'aberto',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  `);
  schemaReady = true;
}

function getMemoryData() {
  if (!globalThis[MEMORY_KEY]) globalThis[MEMORY_KEY] = emptyData();
  return globalThis[MEMORY_KEY];
}

function setMemoryData(data) {
  globalThis[MEMORY_KEY] = { ...DEFAULT_DATA, ...data };
  return globalThis[MEMORY_KEY];
}

async function readLocal() {
  try {
    await fs.mkdir(path.dirname(DB_FILE), { recursive: true });
    const raw = await fs.readFile(DB_FILE, 'utf8');
    const data = JSON.parse(raw);
    return setMemoryData({ ...DEFAULT_DATA, ...data });
  } catch (error) {
    const current = getMemoryData();
    try {
      await fs.mkdir(path.dirname(DB_FILE), { recursive: true });
      await fs.writeFile(DB_FILE, JSON.stringify(current, null, 2));
    } catch {
      // Em Vercel sem DATABASE_URL, pode não haver armazenamento persistente.
      // Mantemos a aplicação funcionando em memória para não quebrar o deploy.
    }
    return current;
  }
}

async function writeLocal(data) {
  const next = setMemoryData({ ...DEFAULT_DATA, ...data });
  try {
    await fs.mkdir(path.dirname(DB_FILE), { recursive: true });
    await fs.writeFile(DB_FILE, JSON.stringify(next, null, 2));
  } catch {
    // Fallback temporário em memória para ambientes serverless sem banco externo.
  }
}

export async function getUsers() {
  if (hasDatabaseUrl()) {
    await ensureSchema();
    const { rows } = await getPool().query('select * from jc_users order by created_at desc');
    return rows.map(normalizeUser);
  }
  const data = await readLocal();
  return data.users.map(normalizeUser);
}

export async function findUserByEmail(email) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) return null;
  if (hasDatabaseUrl()) {
    await ensureSchema();
    const { rows } = await getPool().query('select * from jc_users where lower(email) = $1 limit 1', [normalizedEmail]);
    return normalizeUser(rows[0]);
  }
  const data = await readLocal();
  return normalizeUser(data.users.find(u => String(u.email).toLowerCase() === normalizedEmail));
}

export async function findUserById(userId) {
  if (!userId) return null;
  if (hasDatabaseUrl()) {
    await ensureSchema();
    const { rows } = await getPool().query('select * from jc_users where id = $1 limit 1', [userId]);
    return normalizeUser(rows[0]);
  }
  const data = await readLocal();
  return normalizeUser(data.users.find(u => u.id === userId));
}

export async function createUser(input) {
  const item = normalizeUser({
    id: id(),
    name: String(input.name || '').trim(),
    email: String(input.email || '').trim().toLowerCase(),
    passwordHash: input.passwordHash,
    role: input.role || 'client',
    document: input.document || '',
    phone: input.phone || '',
    createdAt: nowIso()
  });
  if (hasDatabaseUrl()) {
    await ensureSchema();
    const { rows } = await getPool().query(
      `insert into jc_users (id, name, email, password_hash, role, document, phone, created_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8) returning *`,
      [item.id, item.name, item.email, item.passwordHash, item.role, item.document, item.phone, item.createdAt]
    );
    return normalizeUser(rows[0]);
  }
  const data = await readLocal();
  data.users.push(item);
  await writeLocal(data);
  return item;
}

export async function updateUser(userId, updates) {
  if (hasDatabaseUrl()) {
    await ensureSchema();
    const current = await findUserById(userId);
    if (!current) return null;
    const next = { ...current, ...updates };
    const { rows } = await getPool().query(
      `update jc_users set name=$2, email=$3, document=$4, phone=$5 where id=$1 returning *`,
      [userId, next.name, String(next.email).toLowerCase(), next.document || '', next.phone || '']
    );
    return normalizeUser(rows[0]);
  }
  const data = await readLocal();
  const idx = data.users.findIndex(u => u.id === userId);
  if (idx === -1) return null;
  data.users[idx] = normalizeUser({ ...data.users[idx], ...updates, email: String(updates.email ?? data.users[idx].email).toLowerCase() });
  await writeLocal(data);
  return data.users[idx];
}

export async function deleteUser(userId) {
  if (hasDatabaseUrl()) {
    await ensureSchema();
    await getPool().query('delete from jc_users where id=$1 and role=$2', [userId, 'client']);
    return true;
  }
  const data = await readLocal();
  data.users = data.users.filter(u => !(u.id === userId && u.role === 'client'));
  data.requests = data.requests.filter(r => r.clientId !== userId);
  data.agreements = data.agreements.filter(a => a.clientId !== userId);
  await writeLocal(data);
  return true;
}

export async function getRequests() {
  if (hasDatabaseUrl()) {
    await ensureSchema();
    const { rows } = await getPool().query('select * from jc_requests order by created_at desc');
    return rows.map(normalizeRequest);
  }
  const data = await readLocal();
  return data.requests.map(normalizeRequest).sort((a,b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export async function createRequest(input) {
  const item = normalizeRequest({
    id: id(), clientId: input.clientId, amount: input.amount, installments: input.installments,
    notes: input.notes || '', status: 'pendente', adminNote: '', createdAt: nowIso(), updatedAt: nowIso()
  });
  if (hasDatabaseUrl()) {
    await ensureSchema();
    const { rows } = await getPool().query(
      `insert into jc_requests (id, client_id, amount, installments, notes, status, admin_note, created_at, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *`,
      [item.id, item.clientId, item.amount, item.installments, item.notes, item.status, item.adminNote, item.createdAt, item.updatedAt]
    );
    return normalizeRequest(rows[0]);
  }
  const data = await readLocal();
  data.requests.push(item);
  await writeLocal(data);
  return item;
}

export async function updateRequest(requestId, updates) {
  const currentList = await getRequests();
  const current = currentList.find(r => r.id === requestId);
  if (!current) return null;
  const next = normalizeRequest({ ...current, ...updates, updatedAt: nowIso() });
  if (hasDatabaseUrl()) {
    await ensureSchema();
    const { rows } = await getPool().query(
      `update jc_requests set status=$2, admin_note=$3, updated_at=$4 where id=$1 returning *`,
      [requestId, next.status, next.adminNote, next.updatedAt]
    );
    return normalizeRequest(rows[0]);
  }
  const data = await readLocal();
  const idx = data.requests.findIndex(r => r.id === requestId);
  data.requests[idx] = next;
  await writeLocal(data);
  return next;
}

export async function getAgreements() {
  if (hasDatabaseUrl()) {
    await ensureSchema();
    const { rows } = await getPool().query('select * from jc_agreements order by created_at desc');
    return rows.map(normalizeAgreement);
  }
  const data = await readLocal();
  return data.agreements.map(normalizeAgreement).sort((a,b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export async function createAgreement(input) {
  const item = normalizeAgreement({
    id: id(), clientId: input.clientId, requestId: input.requestId || null,
    description: input.description || 'Acordo financeiro', principal: input.principal,
    installments: input.installments, periodRate: input.periodRate, dailyRate: input.dailyRate,
    dueDate: input.dueDate || null, startInterestAt: input.startInterestAt || null,
    status: input.status || 'aberto', createdAt: nowIso(), updatedAt: nowIso()
  });
  if (hasDatabaseUrl()) {
    await ensureSchema();
    const { rows } = await getPool().query(
      `insert into jc_agreements (id, client_id, request_id, description, principal, installments, period_rate, daily_rate, due_date, start_interest_at, status, created_at, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) returning *`,
      [item.id, item.clientId, item.requestId, item.description, item.principal, item.installments, item.periodRate, item.dailyRate, item.dueDate || null, item.startInterestAt, item.status, item.createdAt, item.updatedAt]
    );
    return normalizeAgreement(rows[0]);
  }
  const data = await readLocal();
  data.agreements.push(item);
  await writeLocal(data);
  return item;
}

export async function updateAgreement(agreementId, updates) {
  const currentList = await getAgreements();
  const current = currentList.find(a => a.id === agreementId);
  if (!current) return null;
  const next = normalizeAgreement({ ...current, ...updates, updatedAt: nowIso() });
  if (hasDatabaseUrl()) {
    await ensureSchema();
    const { rows } = await getPool().query(
      `update jc_agreements
       set client_id=$2, description=$3, principal=$4, installments=$5, period_rate=$6, daily_rate=$7,
           due_date=$8, start_interest_at=$9, status=$10, updated_at=$11
       where id=$1 returning *`,
      [agreementId, next.clientId, next.description, next.principal, next.installments, next.periodRate, next.dailyRate, next.dueDate || null, next.startInterestAt, next.status, next.updatedAt]
    );
    return normalizeAgreement(rows[0]);
  }
  const data = await readLocal();
  const idx = data.agreements.findIndex(a => a.id === agreementId);
  data.agreements[idx] = next;
  await writeLocal(data);
  return next;
}

export async function deleteAgreement(agreementId) {
  if (hasDatabaseUrl()) {
    await ensureSchema();
    await getPool().query('delete from jc_agreements where id=$1', [agreementId]);
    return true;
  }
  const data = await readLocal();
  data.agreements = data.agreements.filter(a => a.id !== agreementId);
  await writeLocal(data);
  return true;
}
