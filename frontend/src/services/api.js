import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || '';

const api = axios.create({ baseURL: API_BASE_URL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('kk_token');
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Existing APIs ──────────────────────────────────────────────────────────

export const productAPI = {
  getAll: () => api.get('/api/products'),
  getById: (id) => api.get(`/api/products/${id}`),
  getByCategory: (category) => api.get(`/api/products/category/${category}`),
  search: (q) => api.get(`/api/products/search?q=${encodeURIComponent(q)}`),
  getCategories: () => api.get('/api/products/categories'),
  create: (data) => api.post('/api/products', data),
  update: (id, data) => api.put(`/api/products/${id}`, data),
  updatePrice: (id, price) => api.patch(`/api/products/${id}/price`, { price }),
  updateStock: (id, stock) => api.patch(`/api/products/${id}/stock`, { stock }),
  delete: (id) => api.delete(`/api/products/${id}`),
  getAIPriceSuggestion: (id) => api.get(`/api/products/${id}/ai-price-suggestion`),
};

export const orderAPI = {
  create: (data) => api.post('/api/orders', data),
  getAll: () => api.get('/api/orders'),
  getToday: () => api.get('/api/orders/today'),
  getById: (id) => api.get(`/api/orders/${id}`),
  getDashboardStats: () => api.get('/api/orders/dashboard/stats'),
  getTopProducts: () => api.get('/api/orders/reports/top-products'),
  getSalesByCategory: () => api.get('/api/orders/reports/by-category'),
  getDailyRevenue: () => api.get('/api/orders/reports/daily-revenue'),
  getProfitLoss: () => api.get('/api/orders/reports/profit-loss'),
  getAIInsights: () => api.get('/api/orders/reports/ai-insights'),
};

export const customerAPI = {
  getAll: () => api.get('/api/customers'),
  getSummary: () => api.get('/api/customers/summary'),
  getLedger: (customerId) => api.get('/api/customers/ledger', { params: customerId ? { customerId } : {} }),
  getOrders: (customerId) => api.get(`/api/customers/${customerId}/orders`),
  recordPayment: (customerId, data) => api.post(`/api/customers/${customerId}/payments`, data),
};

export const aiAPI = {
  chat: (message) => api.post('/api/ai/chat', { message }),
};

export const authAPI = {
  login: (data) => api.post('/api/auth/login', data),
  register: (data) => api.post('/api/auth/register', data),
  refresh: (refreshToken) => api.post('/api/auth/refresh', { refreshToken }),
  me: () => api.get('/api/auth/me'),
  changePassword: (data) => api.post('/api/auth/change-password', data),
};

export const userAPI = {
  getAll: () => api.get('/api/users'),
  create: (data) => api.post('/api/users', data),
  update: (id, data) => api.put(`/api/users/${id}`, data),
  toggleStatus: (id) => api.patch(`/api/users/${id}/toggle-status`),
  delete: (id) => api.delete(`/api/users/${id}`),
};

export const shopAPI = {
  getAll: () => api.get('/api/shops'),
  create: (data) => api.post('/api/shops', data),
  update: (id, data) => api.put(`/api/shops/${id}`, data),
  toggleStatus: (id) => api.patch(`/api/shops/${id}/toggle-status`),
  delete: (id) => api.delete(`/api/shops/${id}`),
};

// ── NEW: Online Orders (shop staff) ────────────────────────────────────────

export const onlineOrderAPI = {
  getActive: () => api.get('/api/shop-orders/active'),
  getAll:    () => api.get('/api/shop-orders'),
  updateStatus: (id, status, note) =>
    api.patch(`/api/shop-orders/${id}/status`, { status, note }),
};

// ── NEW: Customer Portal (separate customer JWT) ────────────────────────────

function customerHeaders() {
  const token = localStorage.getItem('bk_customer_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const portalAPI = {
  listShops:   () => axios.get(`${API_BASE_URL}/api/portal/shops`),
  listProducts:(shopId) => axios.get(`${API_BASE_URL}/api/portal/products`, { params: { shopId } }),
  placeOrder:  (data) => axios.post(`${API_BASE_URL}/api/portal/orders`, data, { headers: customerHeaders() }),
  getMyOrders: () => axios.get(`${API_BASE_URL}/api/portal/orders`, { headers: customerHeaders() }),
  getOrder:    (id) => axios.get(`${API_BASE_URL}/api/portal/orders/${id}`, { headers: customerHeaders() }),
  cancelOrder: (id, reason) => axios.patch(`${API_BASE_URL}/api/portal/orders/${id}/cancel`, { reason }, { headers: customerHeaders() }),
};

export const customerAuthAPI = {
  register: (data) => axios.post(`${API_BASE_URL}/api/customer-auth/register`, data),
  login:    (data) => axios.post(`${API_BASE_URL}/api/customer-auth/login`, data),
  me:       () => axios.get(`${API_BASE_URL}/api/customer-auth/me`, { headers: customerHeaders() }),
};

export default api;
