import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);
const API = '/api';

export async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('kfms_token');
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
  });
  if (res.status === 403 || res.status === 401) {
    const data = await res.json();
    if (data.code === 'ACCOUNT_SUSPENDED' || data.code === 'SESSION_INVALIDATED') {
      localStorage.removeItem('kfms_token');
      window.dispatchEvent(new CustomEvent('kfms:force-logout', { detail: data }));
      throw Object.assign(new Error(data.message || data.error), { code: data.code });
    }
    return { ok: false, json: async () => data };
  }
  return res;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [suspendedMsg, setSuspendedMsg] = useState(null);
  const pollRef = useRef(null);

  const logout = useCallback(() => {
    localStorage.removeItem('kfms_token');
    setUser(null);
    if (pollRef.current) clearInterval(pollRef.current);
  }, []);

  const startSessionPoll = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await apiFetch('/auth/me');
        if (!res.ok) { logout(); return; }
        const data = await res.json();
        setUser(data);
      } catch (err) {
        if (err.code === 'ACCOUNT_SUSPENDED') { setSuspendedMsg('Your account has been suspended.'); logout(); }
      }
    }, 30000);
  }, [logout]);

  useEffect(() => {
    const handle = (e) => { if (e.detail?.code === 'ACCOUNT_SUSPENDED') setSuspendedMsg('Your account has been suspended by the administrator.'); logout(); };
    window.addEventListener('kfms:force-logout', handle);
    return () => window.removeEventListener('kfms:force-logout', handle);
  }, [logout]);

  useEffect(() => {
    const token = localStorage.getItem('kfms_token');
    if (!token) { setLoading(false); return; }
    apiFetch('/auth/me').then(r => r.json()).then(data => { if (data.id) { setUser(data); startSessionPoll(); } else logout(); }).catch(logout).finally(() => setLoading(false));
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const login = async (email, password) => {
    const res = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    const data = await res.json();
    if (data.token) { localStorage.setItem('kfms_token', data.token); setUser(data.user); setSuspendedMsg(null); startSessionPoll(); return { success: true, user: data.user }; }
    return { success: false, error: data.message || data.error };
  };

  return <AuthContext.Provider value={{ user, login, logout, loading, suspendedMsg }}>{children}</AuthContext.Provider>;
}
