const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();

export const API_URL = (configuredApiUrl || 'http://localhost:5001').replace(/\/$/, '');

export const apiUrl = path =>
  `${API_URL}${path.startsWith('/') ? path : `/${path}`}`;
