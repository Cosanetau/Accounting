const API_BASE = '/api/accounting';

async function request(action, { method = 'GET', body, token } = {}) {
  const headers = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}?action=${encodeURIComponent(action)}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || 'Request failed.');
  }

  return payload;
}

export function fetchAccountingMe(token) {
  return request('me', { token });
}

export function fetchSummary(token, { year, month } = {}) {
  return request('summary', { token, body: { year, month }, method: 'POST' });
}

export function listIncome(token, filters = {}) {
  return request('list-income', { token, body: filters, method: 'POST' });
}

export function createIncome(token, payload) {
  return request('create-income', { token, body: payload, method: 'POST' });
}

export function listExpenses(token, filters = {}) {
  return request('list-expenses', { token, body: filters, method: 'POST' });
}

export function createExpense(token, payload) {
  return request('create-expense', { token, body: payload, method: 'POST' });
}

export function listLogbook(token, filters = {}) {
  return request('list-logbook', { token, body: filters, method: 'POST' });
}

export function createLogbookEntry(token, payload) {
  return request('create-logbook', { token, body: payload, method: 'POST' });
}

export function syncStripeIncome(token, payload = {}) {
  return request('sync-stripe', { token, body: payload, method: 'POST' });
}

export function listUsers(token) {
  return request('list-users', { token, method: 'POST' });
}

export function inviteUser(token, payload) {
  return request('invite-user', { token, body: payload, method: 'POST' });
}
