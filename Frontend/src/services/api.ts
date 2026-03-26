import { API_BASE } from '../lib/config';
const BASE_URL = API_BASE;

// ── Token helpers ────────────────────────────────────────────────────────
export const getToken = () => localStorage.getItem('token');
export const setToken = (token: string) => localStorage.setItem('token', token);
export const setUser  = (user: any)  => localStorage.setItem('user', JSON.stringify(user));
export const getUser  = () => { try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; }};
export const clearAuth = () => { localStorage.removeItem('token'); localStorage.removeItem('user'); };

const authHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${getToken()}`
});

// ── Auth API ─────────────────────────────────────────────────────────────
export const authAPI = {
  signup: async (email: string, password: string, fullName: string, role: string) => {
    const res = await fetch(`${BASE_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, fullName, role })
    });
    return res.json();
  },

  signin: async (email: string, password: string) => {
    const res = await fetch(`${BASE_URL}/auth/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    return res.json();
  },

  me: async () => {
    const res = await fetch(`${BASE_URL}/auth/me`, { headers: authHeaders() });
    return res.json();
  }
};

// ── Doctors API ──────────────────────────────────────────────────────────
export const doctorsAPI = {
  list: async (params?: { search?: string; specialty?: string; sort?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    const res = await fetch(`${BASE_URL}/doctors${query ? '?' + query : ''}`);
    return res.json();
  },

  getById: async (id: number) => {
    const res = await fetch(`${BASE_URL}/doctors/${id}`);
    return res.json();
  },

  specialties: async () => {
    const res = await fetch(`${BASE_URL}/doctors/specialties`);
    return res.json();
  }
};

// ── Appointments API ─────────────────────────────────────────────────────
export const appointmentsAPI = {
  list: async () => {
    const res = await fetch(`${BASE_URL}/appointments`, { headers: authHeaders() });
    return res.json();
  },

  book: async (doctor_id: number, appointment_date: string, appointment_type: string, notes?: string) => {
    const res = await fetch(`${BASE_URL}/appointments`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ doctor_id, appointment_date, appointment_type, notes })
    });
    return res.json();
  },

  cancel: async (id: number) => {
    const res = await fetch(`${BASE_URL}/appointments/${id}`, {
      method: 'DELETE',
      headers: authHeaders()
    });
    return res.json();
  },

  update: async (id: number, data: { status?: string; notes?: string; prescription?: string }) => {
    const res = await fetch(`${BASE_URL}/appointments/${id}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(data)
    });
    return res.json();
  }
};

// ── Prescriptions API ────────────────────────────────────────────────────────
export const prescriptionsAPI = {
  list: async () => {
    const res = await fetch(`${BASE_URL}/prescriptions`, { headers: authHeaders() });
    return res.json();
  },

  create: async (patient_id: number, medication: string, dosage: string, instructions: string) => {
    const res = await fetch(`${BASE_URL}/prescriptions`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ patient_id, medication, dosage, instructions })
    });
    return res.json();
  },

  /** Call the ML NER model to extract medicines from a text string.
   *  Returns { medicines: [{ drug, dose, frequency, duration, route }], raw: {...} }
   *  Supports English and Hindi (Hinglish). Multiple medicines are split automatically.
   */
  extract: async (text: string) => {
    const res = await fetch(`${BASE_URL}/prescriptions/extract`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ text })
    });
    return res.json();
  }
};