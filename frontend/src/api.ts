const BASE_URL = '/api';

function getToken(): string | null {
  return localStorage.getItem('token');
}

async function request(path: string, options: RequestInit = {}): Promise<any> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '请求失败');
  return data;
}

export const api = {
  // Auth
  login: (username: string, password: string) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),

  register: (data: { username: string; password: string; name: string; role: string; phone?: string }) =>
    request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),

  getMe: () => request('/auth/me'),

  // Packages
  createPackage: (data: { tracking_no: string; recipient_phone: string; recipient_name: string }) =>
    request('/packages', { method: 'POST', body: JSON.stringify(data) }),

  searchPackage: (tracking_no: string) =>
    request(`/packages/search?tracking_no=${encodeURIComponent(tracking_no)}`),

  getMyPackages: () => request('/packages/my'),

  pickup: (tracking_no: string, pickup_code: string) =>
    request('/packages/pickup', { method: 'POST', body: JSON.stringify({ tracking_no, pickup_code }) }),

  getTodayPackages: () => request('/packages/today'),

  getAllPackages: (page = 1, limit = 20) =>
    request(`/packages/all?page=${page}&limit=${limit}`),

  // Stats
  getDashboard: () => request('/stats/dashboard'),

  getPeakHours: (date?: string) =>
    request(`/stats/peak-hours${date ? `?date=${date}` : ''}`),

  getRecords: (params: { start_date?: string; end_date?: string; page?: number; limit?: number }) => {
    const sp = new URLSearchParams();
    if (params.start_date) sp.set('start_date', params.start_date);
    if (params.end_date) sp.set('end_date', params.end_date);
    if (params.page) sp.set('page', String(params.page));
    if (params.limit) sp.set('limit', String(params.limit));
    return request(`/stats/records?${sp.toString()}`);
  },

  getOverdue: () => request('/stats/overdue'),
};
