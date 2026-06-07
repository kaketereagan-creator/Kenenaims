import { useState, useEffect } from 'react';
import { T, roleColors } from '../theme';
import { SectionHeader, Btn, Badge, RoleBadge, Avatar, Drawer, Field, Input, Select, Alert, EmptyState, Spinner } from '../components/UI';
import { apiFetch } from '../context/AuthContext';
import { useAuth } from '../context/AuthContext';

// Mock users for demo
const DEMO_USERS = [
  { id: '1', full_name: 'Farm Owner', email: 'owner@kenenafarm.ug', phone: '+256700000000', role_name: 'super_admin', is_active: true, last_login: new Date().toISOString(), created_at: '2024-01-01' },
  { id: '2', full_name: 'Kihura Manager', email: 'manager@kenenafarm.ug', phone: '+256700000001', role_name: 'farm_manager', is_active: true, last_login: new Date(Date.now() - 3600000).toISOString(), created_at: '2024-01-15' },
  { id: '3', full_name: 'Sarah Nakato', email: 'sarah@kenenafarm.ug', phone: '+256700000002', role_name: 'accountant', is_active: true, last_login: new Date(Date.now() - 86400000).toISOString(), created_at: '2024-02-01' },
  { id: '4', full_name: 'Moses Byaruhanga', email: 'moses@kenenafarm.ug', phone: '+256700000003', role_name: 'storekeeper', is_active: true, last_login: null, created_at: '2024-03-01' },
  { id: '5', full_name: 'Grace Tumusiime', email: 'grace@kenenafarm.ug', phone: '+256700000004', role_name: 'worker', is_active: false, last_login: null, created_at: '2024-03-10' },
];

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState(DEMO_USERS);
  const [loading, setLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [suspendingId, setSuspendingId] = useState(null);
  const [alert, setAlert] = useState(null);
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);

  // New user form
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', role_name: 'worker', password: '' });

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/auth/users');
      if (res.ok) { const d = await res.json(); setUsers(d); }
    } catch { /* use demo data */ }
    setLoading(false);
  };

  const handleSuspend = async (userId, shouldSuspend, userName) => {
    setSuspendingId(userId);
    try {
      const res = await apiFetch(`/auth/users/${userId}/suspend`, {
        method: 'PATCH',
        body: JSON.stringify({ suspend: shouldSuspend, reason: shouldSuspend ? 'Suspended by admin' : null }),
      });
      if (res.ok) {
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_active: !shouldSuspend, session_version: (u.session_version || 1) + 1 } : u));
        setAlert({ type: shouldSuspend ? 'warning' : 'success', msg: shouldSuspend ? `${userName} suspended — session terminated immediately.` : `${userName} reactivated.` });
      }
    } catch {
      // Demo mode
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_active: !shouldSuspend } : u));
      setAlert({ type: shouldSuspend ? 'warning' : 'success', msg: shouldSuspend ? `${userName} suspended.` : `${userName} reactivated.` });
    }
    setSuspendingId(null);
    setTimeout(() => setAlert(null), 4000);
  };

  const handleCreate = async () => {
    if (!form.full_name || !form.email || !form.password) {
      setAlert({ type: 'error', msg: 'Please fill all required fields' }); return;
    }
    try {
      const res = await apiFetch('/auth/users', { method: 'POST', body: JSON.stringify(form) });
      if (res.ok) {
        const newUser = await res.json();
        setUsers(prev => [...prev, { ...newUser, role_name: form.role_name }]);
      }
    } catch {
      // Demo
      setUsers(prev => [...prev, { id: Date.now().toString(), ...form, is_active: true, last_login: null, created_at: new Date().toISOString() }]);
    }
    setDrawerOpen(false);
    setForm({ full_name: '', email: '', phone: '', role_name: 'worker', password: '' });
    setAlert({ type: 'success', msg: `${form.full_name} added successfully.` });
    setTimeout(() => setAlert(null), 3000);
  };

  const loadAuditLogs = async () => {
    try {
      const res = await apiFetch('/auth/audit-logs');
      if (res.ok) { const d = await res.json(); setAuditLogs(d); }
    } catch {
      setAuditLogs([
        { id: 1, full_name: 'Farm Owner', action: 'LOGIN_SUCCESS', module: 'auth', created_at: new Date().toISOString(), ip_address: '197.X.X.X' },
        { id: 2, full_name: 'Farm Owner', action: 'SUSPEND_USER', module: 'users', created_at: new Date(Date.now() - 3600000).toISOString(), ip_address: '197.X.X.X' },
        { id: 3, full_name: 'Kihura Manager', action: 'LOGIN_SUCCESS', module: 'auth', created_at: new Date(Date.now() - 7200000).toISOString(), ip_address: '196.X.X.X' },
      ]);
    }
    setAuditOpen(true);
  };

  const activeCount = users.filter(u => u.is_active).length;
  const suspendedCount = users.filter(u => !u.is_active).length;

  return (
    <div style={{ fontFamily: T.fontBody }}>
      <SectionHeader
        title="Users & Access Control"
        sub={`${activeCount} active · ${suspendedCount} suspended`}
        action={
          <div style={{ display: 'flex', gap: 10 }}>
            <Btn variant="ghost" size="sm" icon="📋" onClick={loadAuditLogs}>Audit Log</Btn>
            <Btn variant="primary" size="sm" icon="+" onClick={() => setDrawerOpen(true)}>Add User</Btn>
          </div>
        }
      />

      {alert && (
        <div style={{ marginBottom: 16 }}>
          <Alert type={alert.type} onDismiss={() => setAlert(null)}>{alert.msg}</Alert>
        </div>
      )}

      {/* Role Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 24 }}>
        {Object.entries(roleColors).map(([role, config]) => {
          const count = users.filter(u => u.role_name === role).length;
          return (
            <div key={role} style={{
              background: T.white, borderRadius: T.radius,
              border: `1px solid ${T.border}`, boxShadow: T.shadowSm,
              padding: '16px 18px',
            }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: config.bg, marginBottom: 2 }}>{count}</div>
              <div style={{ fontSize: 12, color: T.textSecondary, fontWeight: 600 }}>{config.label}</div>
            </div>
          );
        })}
      </div>

      {/* Users Table */}
      <div style={{ background: T.white, borderRadius: T.radius, border: `1px solid ${T.border}`, boxShadow: T.shadowSm, overflow: 'hidden' }}>
        <div style={{ padding: '16px 22px', borderBottom: `1px solid ${T.border}`, background: T.bgLight }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: T.textSecondary, letterSpacing: 0.5, textTransform: 'uppercase' }}>
            All Users
          </h3>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Spinner /></div>
        ) : (
          <div>
            {users.map((u, i) => (
              <div key={u.id} style={{
                display: 'flex', alignItems: 'center', gap: 16,
                padding: '16px 22px',
                borderBottom: i < users.length - 1 ? `1px solid ${T.border}` : 'none',
                background: !u.is_active ? T.coralLight + '66' : 'transparent',
                transition: 'background 0.15s',
              }}
                onMouseEnter={e => { if (u.is_active) e.currentTarget.style.background = T.bgLight; }}
                onMouseLeave={e => { e.currentTarget.style.background = !u.is_active ? T.coralLight + '66' : 'transparent'; }}
              >
                <Avatar name={u.full_name} photo={u.profile_photo} size={44} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 3 }}>
                    <span style={{ fontWeight: 700, fontSize: 15, color: T.textPrimary }}>{u.full_name}</span>
                    <RoleBadge role={u.role_name} />
                    {!u.is_active && <Badge status="suspended">Suspended</Badge>}
                    {u.id === currentUser?.id && (
                      <span style={{ fontSize: 11, color: T.teal, fontWeight: 700, background: T.emeraldPale, padding: '2px 8px', borderRadius: T.radiusFull }}>YOU</span>
                    )}
                  </div>
                  <div style={{ fontSize: 13, color: T.textSecondary }}>{u.email}</div>
                  {u.phone && <div style={{ fontSize: 12, color: T.textMuted }}>{u.phone}</div>}
                </div>

                <div style={{ textAlign: 'right', minWidth: 120 }}>
                  <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 3 }}>
                    {u.last_login
                      ? `Last login: ${new Date(u.last_login).toLocaleDateString()}`
                      : 'Never logged in'}
                  </div>
                  <div style={{ fontSize: 11, color: T.textMuted }}>
                    Joined {new Date(u.created_at).toLocaleDateString()}
                  </div>
                </div>

                {/* SUSPEND / UNSUSPEND TOGGLE — Super Admin Kill Switch */}
                {u.id !== currentUser?.id && currentUser?.role_name === 'super_admin' && (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {u.is_active ? (
                      <Btn
                        variant="danger" size="sm"
                        disabled={suspendingId === u.id}
                        onClick={() => handleSuspend(u.id, true, u.full_name)}
                      >
                        {suspendingId === u.id ? '…' : '🔒 Suspend'}
                      </Btn>
                    ) : (
                      <Btn
                        variant="teal" size="sm"
                        disabled={suspendingId === u.id}
                        onClick={() => handleSuspend(u.id, false, u.full_name)}
                      >
                        {suspendingId === u.id ? '…' : '✓ Reactivate'}
                      </Btn>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add User Drawer */}
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Add New User">
        <Field label="Full Name" required>
          <Input value={form.full_name} onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} placeholder="e.g. John Musoke" />
        </Field>
        <Field label="Email Address" required>
          <Input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="john@kenenafarm.ug" />
        </Field>
        <Field label="Phone Number">
          <Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="+256700000000" />
        </Field>
        <Field label="Role" required hint="Determines access level across all modules">
          <Select value={form.role_name} onChange={e => setForm(p => ({ ...p, role_name: e.target.value }))}>
            <option value="farm_manager">Farm Manager — Full operational access</option>
            <option value="accountant">Accountant — Finance & payroll</option>
            <option value="storekeeper">Storekeeper — Inventory only</option>
            <option value="worker">Worker — Basic scanning & attendance</option>
          </Select>
        </Field>
        <Field label="Temporary Password" required hint="User should change this on first login">
          <Input type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} placeholder="Min. 8 characters" />
        </Field>

        <div style={{ padding: '16px', background: T.amberLight, borderRadius: T.radiusSm, border: `1px solid ${T.amber}44`, marginBottom: 20 }}>
          <p style={{ fontSize: 13, color: T.amberDark, margin: 0, fontWeight: 600 }}>⚠️ Role Permissions</p>
          <p style={{ fontSize: 12, color: T.textSecondary, margin: '6px 0 0' }}>
            {form.role_name === 'farm_manager' && 'Can manage animals, crops, workers, and submit expense requests. Cannot approve payments.'}
            {form.role_name === 'accountant' && 'Can manage finance records, run payroll, and view wallet. Cannot approve wallet injections.'}
            {form.role_name === 'storekeeper' && 'Can manage inventory stock only. No access to finance or livestock records.'}
            {form.role_name === 'worker' && 'Can scan QR codes, log attendance, and update simple health status. Very limited access.'}
          </p>
        </div>

        <Btn variant="primary" full onClick={handleCreate} icon="✓">Create User Account</Btn>
      </Drawer>

      {/* Audit Log Drawer */}
      <Drawer open={auditOpen} onClose={() => setAuditOpen(false)} title="Audit Log" width={600}>
        <p style={{ fontSize: 13, color: T.textSecondary, marginTop: 0 }}>Every action by every user is permanently logged.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {auditLogs.map(log => (
            <div key={log.id} style={{
              padding: '12px 16px', background: T.bgLight,
              borderRadius: T.radiusSm, border: `1px solid ${T.border}`,
              display: 'flex', gap: 12, alignItems: 'flex-start',
            }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', marginTop: 5, flexShrink: 0,
                background: log.action.includes('SUSPEND') ? T.coral : log.action.includes('LOGIN') ? T.teal : T.amber,
              }} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: T.textPrimary, fontFamily: T.fontMono }}>{log.action}</span>
                  <span style={{ fontSize: 11, color: T.textMuted }}>{new Date(log.created_at).toLocaleString()}</span>
                </div>
                <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 2 }}>
                  {log.full_name} · {log.ip_address || 'Unknown IP'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Drawer>
    </div>
  );
}
