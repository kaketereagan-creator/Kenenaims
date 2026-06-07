import { useState, useEffect, useRef } from 'react';
import { T } from '../theme';
import { apiFetch } from '../context/AuthContext';

const MOCK_NOTIFICATIONS = [
  { id: '1', title: '💉 7 Vaccinations Due Within 7 Days', message: 'RBT-000003, PIG-000001 and 5 others require vaccination before Jun 30.', type: 'vaccination_due', is_read: false, created_at: new Date().toISOString() },
  { id: '2', title: '📦 3 Items Low / Out of Stock', message: 'Oxytetracycline is out of stock. RHD Vaccine and NPK Fertilizer are low.', type: 'low_stock', is_read: false, created_at: new Date(Date.now() - 3600000).toISOString() },
  { id: '3', title: '✅ 2 Expense Requests Awaiting Approval', message: 'Feed purchase (UGX 680,000) and Vet services (UGX 320,000) pending your approval.', type: 'approval_required', is_read: false, created_at: new Date(Date.now() - 7200000).toISOString() },
  { id: '4', title: '🚨 Birth Imminent — RBT-000003', message: 'Expected to kindle in 3 days. Prepare nesting box in Pen B.', type: 'imminent_birth', is_read: true, created_at: new Date(Date.now() - 86400000).toISOString() },
  { id: '5', title: '👷 Monthly Payroll Due in 3 Days', message: 'Review attendance records and run payroll for June 2025.', type: 'payroll_due', is_read: true, created_at: new Date(Date.now() - 172800000).toISOString() },
];

const typeColors = {
  vaccination_due: T.blue,
  low_stock: T.amber,
  approval_required: T.coral,
  mortality_spike: T.coral,
  payroll_due: '#7B5EA7',
  imminent_birth: T.teal,
  default: T.textMuted,
};

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr);
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (hrs < 24) return `${hrs}h ago`;
  return `${days}d ago`;
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS);
  const [unread, setUnread] = useState(3);
  const ref = useRef(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await apiFetch('/notifications?limit=20');
        if (res.ok) {
          const d = await res.json();
          if (d.notifications?.length) {
            setNotifications(d.notifications);
            setUnread(d.unread_count);
          }
        }
      } catch { /* use mock */ }
    };
    load();
    const interval = setInterval(load, 60000); // poll every minute
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const markRead = async (id) => {
    try { await apiFetch(`/notifications/${id}/read`, { method: 'PATCH' }); } catch { /* demo */ }
    setNotifications(p => p.map(n => n.id === id ? { ...n, is_read: true } : n));
    setUnread(p => Math.max(0, p - 1));
  };

  const markAllRead = async () => {
    try { await apiFetch('/notifications/read-all/mark', { method: 'PATCH' }); } catch { /* demo */ }
    setNotifications(p => p.map(n => ({ ...n, is_read: true })));
    setUnread(0);
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: 44, height: 44, borderRadius: 12,
          background: open ? T.emeraldFaint : T.bgLight,
          border: `1.5px solid ${open ? T.emeraldLight : T.border}`,
          cursor: 'pointer', display: 'flex', alignItems: 'center',
          justifyContent: 'center', position: 'relative', fontSize: 20,
          transition: 'all 0.15s',
        }}
      >
        🔔
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: 6, right: 6,
            width: 18, height: 18, borderRadius: '50%',
            background: T.coral, color: T.white,
            fontSize: 10, fontWeight: 800,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: `2px solid ${T.white}`,
            animation: 'pulse 2s infinite',
          }}>{unread > 9 ? '9+' : unread}</span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div style={{
          position: 'absolute', top: 52, right: 0,
          width: 380, maxHeight: 520,
          background: T.white, borderRadius: T.radius,
          border: `1px solid ${T.border}`, boxShadow: T.shadowLg,
          zIndex: 400, overflow: 'hidden',
          animation: 'fadeInDown 0.2s ease',
        }}>
          {/* Header */}
          <div style={{ padding: '14px 18px', borderBottom: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: T.emerald }}>
            <div>
              <span style={{ fontWeight: 800, fontSize: 15, color: T.white, fontFamily: T.fontDisplay }}>Notifications</span>
              {unread > 0 && <span style={{ marginLeft: 8, background: T.coral, color: T.white, borderRadius: T.radiusFull, fontSize: 11, fontWeight: 700, padding: '2px 8px' }}>{unread} new</span>}
            </div>
            {unread > 0 && (
              <button onClick={markAllRead} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: 'rgba(255,255,255,0.8)', fontSize: 12, cursor: 'pointer', padding: '4px 10px', borderRadius: T.radiusFull, fontWeight: 600 }}>
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ overflowY: 'auto', maxHeight: 440 }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '48px 24px', textAlign: 'center' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🔕</div>
                <div style={{ color: T.textMuted, fontSize: 14 }}>No notifications yet</div>
              </div>
            ) : (
              notifications.map((n, i) => (
                <div
                  key={n.id}
                  onClick={() => !n.is_read && markRead(n.id)}
                  style={{
                    padding: '14px 18px',
                    borderBottom: i < notifications.length - 1 ? `1px solid ${T.border}` : 'none',
                    background: n.is_read ? T.white : T.emeraldFaint,
                    cursor: n.is_read ? 'default' : 'pointer',
                    display: 'flex', gap: 12, alignItems: 'flex-start',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => { if (!n.is_read) e.currentTarget.style.background = T.emeraldPale; }}
                  onMouseLeave={e => { e.currentTarget.style.background = n.is_read ? T.white : T.emeraldFaint; }}
                >
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: n.is_read ? T.border : (typeColors[n.type] || typeColors.default), marginTop: 5, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: n.is_read ? 500 : 700, color: T.textPrimary, lineHeight: 1.4, marginBottom: 4 }}>{n.title}</div>
                    <div style={{ fontSize: 12, color: T.textSecondary, lineHeight: 1.4, marginBottom: 4 }}>{n.message}</div>
                    <div style={{ fontSize: 11, color: T.textMuted }}>{timeAgo(n.created_at)}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
      <style>{`
        @keyframes fadeInDown { from { opacity: 0; transform: translateY(-8px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.15)} }
      `}</style>
    </div>
  );
}
