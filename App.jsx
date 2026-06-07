import { useState, useEffect } from 'react';
import { T, roleColors } from './theme';
import { useAuth } from './context/AuthContext';
import { Avatar } from './components/UI';
import NotificationBell from './components/NotificationBell';
import LoginPage from './pages/LoginPage';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import UsersPage from './pages/UsersPage';
import LivestockPage from './pages/admin/LivestockPage';
import CropsPage from './pages/admin/CropsPage';
import PayrollPage from './pages/admin/PayrollPage';
import InventoryPage from './pages/admin/InventoryPage';
import FinancePage from './pages/admin/FinancePage';
import WalletPage from './pages/admin/WalletPage';
import ManagerInterface from './pages/manager/ManagerInterface';
import QRScannerPage from './pages/manager/QRScannerPage';
import ReportsPage from './pages/admin/ReportsPage';

const NAV = [
  { id:'dashboard', icon:'🏠', label:'Dashboard',     roles:['super_admin','farm_manager','accountant'] },
  { id:'users',     icon:'👥', label:'Users & Access', roles:['super_admin'] },
  { id:'livestock', icon:'🐾', label:'Livestock',      roles:['super_admin','farm_manager','storekeeper'] },
  { id:'crops',     icon:'🌱', label:'Crops',          roles:['super_admin','farm_manager'] },
  { id:'payroll',   icon:'👷', label:'Payroll',        roles:['super_admin','farm_manager','accountant'] },
  { id:'inventory', icon:'📦', label:'Inventory',      roles:['super_admin','farm_manager','accountant','storekeeper'] },
  { id:'finance',   icon:'💰', label:'Finance',        roles:['super_admin','accountant'] },
  { id:'wallet',    icon:'🏦', label:'Wallet',         roles:['super_admin','accountant'] },
  { id:'reports',   icon:'📊', label:'Reports',        roles:['super_admin','accountant','farm_manager'] },
  { id:'scanner',   icon:'📷', label:'QR Scanner',     roles:['super_admin','farm_manager','worker'] },
  { id:'manager',   icon:'📱', label:'Field View',     roles:['farm_manager','worker'] },
];

function Sidebar({ active, onNav, user, onLogout }) {
  const role = user?.role_name || user?.role;
  const visibleNav = NAV.filter(n => !n.roles || n.roles.includes(role));
  const roleConfig = roleColors[role] || { bg: T.textMuted, label: role, text: T.white };

  return (
    <div style={{ width:240, minHeight:'100vh', background:T.white, borderRight:`1px solid ${T.border}`, display:'flex', flexDirection:'column', position:'fixed', left:0, top:0, bottom:0, zIndex:100, boxShadow:'2px 0 12px rgba(27,67,50,0.06)' }}>
      <div style={{ padding:'20px 18px', borderBottom:`1px solid ${T.border}` }}>
        <div style={{ display:'flex', alignItems:'center', gap:11 }}>
          <div style={{ width:42, height:42, borderRadius:13, background:T.emerald, display:'flex', alignItems:'center', justifyContent:'center', fontSize:21, flexShrink:0, boxShadow:'0 4px 12px rgba(27,67,50,0.3)' }}>🌿</div>
          <div>
            <div style={{ fontWeight:800, fontSize:13, color:T.textPrimary, fontFamily:T.fontDisplay }}>Kenena Farm</div>
            <div style={{ fontSize:11, color:T.textMuted }}>Kihura, Uganda</div>
          </div>
        </div>
      </div>

      <nav style={{ flex:1, padding:'10px 8px', overflowY:'auto' }}>
        {visibleNav.map(item => {
          const isActive = active === item.id;
          return (
            <button key={item.id} onClick={() => onNav(item.id)} style={{ width:'100%', display:'flex', alignItems:'center', gap:11, padding:'0 12px', height:T.touch, borderRadius:T.radiusSm, border:'none', marginBottom:1, background:isActive ? T.emeraldFaint : 'transparent', color:isActive ? T.emerald : T.textSecondary, cursor:'pointer', fontSize:13, fontWeight:isActive ? 700 : 500, fontFamily:T.fontBody, transition:'all 0.15s', borderLeft:`3px solid ${isActive ? T.emerald : 'transparent'}`, textAlign:'left' }}>
              <span style={{ fontSize:17, width:20, textAlign:'center', flexShrink:0 }}>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div style={{ padding:'14px', borderTop:`1px solid ${T.border}` }}>
        <div style={{ display:'flex', alignItems:'center', gap:9, marginBottom:10 }}>
          <Avatar name={user?.full_name} size={36} />
          <div style={{ flex:1, overflow:'hidden' }}>
            <div style={{ fontSize:12, fontWeight:700, color:T.textPrimary, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{user?.full_name}</div>
            <span style={{ background:roleConfig.bg, color:roleConfig.text || T.white, fontSize:9, fontWeight:700, padding:'2px 6px', borderRadius:T.radiusFull, letterSpacing:0.3 }}>{roleConfig.label || role}</span>
          </div>
        </div>
        <button onClick={onLogout} style={{ width:'100%', height:36, background:T.bgLight, border:`1px solid ${T.border}`, borderRadius:T.radiusSm, color:T.textSecondary, fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:T.fontBody }}>
          Sign Out
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const { user, loading, logout, suspendedMsg } = useAuth();
  const [page, setPage] = useState('dashboard');

  // Handle deep links from service worker
  useEffect(() => {
    const handler = (e) => { if (e.data?.type === 'NAVIGATE') setPage(e.data.url?.replace('/?page=', '') || 'dashboard'); };
    navigator.serviceWorker?.addEventListener('message', handler);
    return () => navigator.serviceWorker?.removeEventListener('message', handler);
  }, []);

  // Check for ?page= URL param on load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const p = params.get('page');
    if (p) setPage(p);
  }, []);

  if (loading) return (
    <div style={{ minHeight:'100vh', background:T.bgLight, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:T.fontBody }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:48, marginBottom:16 }}>🌿</div>
        <div style={{ color:T.textSecondary, fontSize:15, fontWeight:600 }}>Loading Kenena Farm…</div>
      </div>
    </div>
  );

  if (!user) return <LoginPage />;

  const role = user?.role_name || user?.role;

  const renderPage = () => {
    switch (page) {
      case 'dashboard': return <SuperAdminDashboard />;
      case 'users':     return role === 'super_admin' ? <UsersPage /> : null;
      case 'livestock': return <LivestockPage />;
      case 'crops':     return <CropsPage />;
      case 'payroll':   return <PayrollPage />;
      case 'inventory': return <InventoryPage />;
      case 'finance':   return <FinancePage />;
      case 'wallet':    return <WalletPage />;
      case 'reports':   return <ReportsPage />;
      case 'scanner':   return <QRScannerPage />;
      case 'manager':   return <ManagerInterface />;
      default:          return <SuperAdminDashboard />;
    }
  };

  return (
    <div style={{ minHeight:'100vh', background:T.bgLight, fontFamily:T.fontBody }}>
      {suspendedMsg && (
        <div style={{ position:'fixed', top:0, left:0, right:0, zIndex:500, background:T.coral, color:T.white, padding:'14px 24px', textAlign:'center', fontWeight:700, fontSize:14 }}>
          🔒 {suspendedMsg}
        </div>
      )}

      <Sidebar active={page} onNav={setPage} user={user} onLogout={logout} />

      {/* Top bar */}
      <div style={{ position:'fixed', top:0, left:240, right:0, height:60, background:T.white, borderBottom:`1px solid ${T.border}`, display:'flex', alignItems:'center', justifyContent:'flex-end', padding:'0 28px', zIndex:90, boxShadow:'0 1px 4px rgba(27,67,50,0.06)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ fontSize:12, color:T.textMuted, textAlign:'right' }}>
            <div style={{ fontWeight:600, color:T.textSecondary }}>{new Date().toLocaleDateString('en-UG', { weekday:'short', day:'numeric', month:'short' })}</div>
          </div>
          <NotificationBell />
        </div>
      </div>

      <main style={{ marginLeft:240, padding:'88px 32px 40px', minHeight:'100vh', maxWidth:'100%' }}>
        {renderPage()}
      </main>

      <style>{`
        * { box-sizing:border-box; margin:0; padding:0; }
        body { background:${T.bgLight}; -webkit-tap-highlight-color:transparent; }
        ::-webkit-scrollbar { width:5px; height:5px; }
        ::-webkit-scrollbar-track { background:${T.bgLight}; }
        ::-webkit-scrollbar-thumb { background:${T.border}; border-radius:3px; }
        input,select,button,textarea { font-family:${T.fontBody}; }
        @media (max-width:768px) {
          main { margin-left:0 !important; padding:80px 16px 80px !important; }
        }
      `}</style>
    </div>
  );
}
