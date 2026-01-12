import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API_BASE = `${BACKEND_URL}/api`;

// Create axios instance
const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle token refresh on 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        try {
          const response = await axios.post(`${API_BASE}/auth/refresh`, null, {
            params: { refresh_token: refreshToken }
          });
          
          const { access_token } = response.data;
          localStorage.setItem('access_token', access_token);
          
          originalRequest.headers.Authorization = `Bearer ${access_token}`;
          return api(originalRequest);
        } catch (refreshError) {
          // Refresh failed, logout user
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('user');
          window.location.href = '/login';
        }
      }
    }
    
    return Promise.reject(error);
  }
);

// Auth APIs
export const authAPI = {
  sendOTP: (phone) => api.post('/auth/send-otp', { phone }),
  verifyOTP: (phone, otp) => api.post('/auth/verify-otp', { phone, otp }),
  refreshToken: (refreshToken) => api.post('/auth/refresh', null, { params: { refresh_token: refreshToken } }),
  getMe: () => api.get('/auth/me'),
};

// User APIs
export const userAPI = {
  updateProfile: (data) => {
    const formData = new FormData();
    Object.keys(data).forEach(key => {
      if (data[key] !== null && data[key] !== undefined) {
        formData.append(key, data[key]);
      }
    });
    return api.put('/users/profile', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  list: (params) => api.get('/users', { params }),
  create: (data) => api.post('/users', data),
};

// Brand APIs
export const brandAPI = {
  list: () => api.get('/brands'),
  get: (id) => api.get(`/brands/${id}`),
  create: (data) => api.post('/brands', data),
  updateSettings: (id, settings) => api.put(`/brands/${id}/settings`, settings),
};

// Zone APIs
export const zoneAPI = {
  list: (params) => api.get('/zones', { params }),
  get: (id) => api.get(`/zones/${id}`),
  create: (data) => api.post('/zones', data),
  update: (id, data) => api.put(`/zones/${id}`, data),
  delete: (id) => api.delete(`/zones/${id}`),
};

// Dealer APIs
export const dealerAPI = {
  list: (params) => api.get('/dealers', { params }),
  get: (id) => api.get(`/dealers/${id}`),
  create: (data, brandId) => api.post('/dealers', data, { params: { brand_id: brandId } }),
  update: (id, data) => api.put(`/dealers/${id}`, data),
  uploadLogo: (id, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/dealers/${id}/logo`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  approve: (id, brandId, zoneId, approve = true) => 
    api.put(`/dealers/${id}/approve`, null, { params: { brand_id: brandId, zone_id: zoneId, approve } }),
  joinBrand: (id, brandId) => api.post(`/dealers/${id}/join-brand`, null, { params: { brand_id: brandId } }),
};

// Creative APIs
export const creativeAPI = {
  list: (params) => api.get('/creatives', { params }),
  get: (id) => api.get(`/creatives/${id}`),
  create: (data) => api.post('/creatives', data),
  update: (id, data) => api.put(`/creatives/${id}`, data),
  delete: (id) => api.delete(`/creatives/${id}`),
};

// Creative Variant APIs
export const variantAPI = {
  create: (data, file) => {
    const formData = new FormData();
    formData.append('creative_id', data.creative_id);
    formData.append('brand_id', data.brand_id);
    formData.append('label', data.label);
    formData.append('width', data.width);
    formData.append('height', data.height);
    formData.append('file', file);
    return api.post('/creative-variants', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  get: (id) => api.get(`/creative-variants/${id}`),
  delete: (id) => api.delete(`/creative-variants/${id}`),
};

// Slip Template APIs
export const slipTemplateAPI = {
  list: (params) => api.get('/slip-templates', { params }),
  get: (id) => api.get(`/slip-templates/${id}`),
  create: (data) => api.post('/slip-templates', data),
  update: (id, data) => api.put(`/slip-templates/${id}`, data),
  delete: (id) => api.delete(`/slip-templates/${id}`),
};

// Dealer Slip APIs
export const dealerSlipAPI = {
  list: (params) => api.get('/dealer-slips', { params }),
  create: (data, file) => {
    const formData = new FormData();
    formData.append('dealer_id', data.dealer_id);
    formData.append('brand_id', data.brand_id);
    formData.append('name', data.name);
    formData.append('file', file);
    return api.post('/dealer-slips', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  approve: (id, approve = true) => api.put(`/dealer-slips/${id}/approve`, null, { params: { approve } }),
  delete: (id) => api.delete(`/dealer-slips/${id}`),
};

// Render APIs
export const renderAPI = {
  render: (data) => api.post('/render', data),
  download: (assetId) => api.get(`/download/${assetId}`),
  createShareLink: (assetId) => api.post(`/share/${assetId}`),
};

// Analytics APIs
export const analyticsAPI = {
  brand: (brandId) => api.get(`/analytics/brand/${brandId}`),
  zone: (zoneId) => api.get(`/analytics/zone/${zoneId}`),
  dealer: (dealerId) => api.get(`/analytics/dealer/${dealerId}`),
};

// Seed data
export const seedData = () => api.post('/seed');

export default api;
