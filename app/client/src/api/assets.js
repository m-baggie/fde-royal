import axios from 'axios';

const api = axios.create({ baseURL: 'http://localhost:3001' });

export function getAssets(params = {}) {
  const query = new URLSearchParams(params).toString();
  const url = query ? `/api/assets?${query}` : '/api/assets';
  return api.get(url).then((res) => res.data);
}

export function getAsset(id) {
  return api.get(`/api/assets/${id}`).then((res) => res.data);
}

export function getFilters() {
  return api.get('/api/filters').then((res) => res.data);
}

export function uploadFiles(formData) {
  return api.post('/api/assets/upload', formData).then((res) => res.data);
}

export function enrichAsset(id) {
  return api.post(`/api/assets/${id}/enrich`).then((res) => res.data);
}

export default api;
