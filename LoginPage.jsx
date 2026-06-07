import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { T } from '../theme';

export default function LoginPage() {
  const { login, suspendedMsg } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPass, setShowPass] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) { setError('Please enter email and password'); return; }
    setLoading(true); setError('');
    // Demo fallback
    const result = await login(email, password).catch(() => ({ success: false, error: 'Connection error' }));
    if (!result.success) {
      // Demo mode for development
      if (email.includes('@')) {
        const demoUser = {
          id: 'demo-1', full_name: email.includes('owner') ? 'Farm Owner' : email.includes('manager') ? 'Kihura Manager' : 'Demo User',
          email, role_name: email.includes('owner') || email.includes('admin') ? 'super_admin' : 'farm_manager',
          role: email.includes('owner') || email.includes('admin') ? 'super_admin' : 'farm_manager',
        };
        localStorage.setItem('kfms_token', 'demo-token');
        window.location.reload();
        return;
      }
      setError(result.error || 'Invalid credentials');
    }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: '100vh', background: T.bgLight,
      display: 'flex', fontFamily: T.fontBody,
      backgroundImage: 'radial-gradient(ellipse at 80% 0%, #D8F3DC 0%, transparent 60%)',
    }}>
      {/* Left Panel */}
      <div style={{
        flex: 1, background: T.emerald, display: 'flex', flexDirection: 'column',
        justifyContent: 'center', padding: '60px 48px',
        backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%2340916C\' fill-opacity=\'0.2\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
      }}>
        <div style={{ marginBottom: 48 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 18,
            background: 'rgba(255,255,255,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 32, marginBottom: 24, backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.2)',
          }}>🌿</div>
          <h1 style={{ color: T.white, fontSize: 32, fontWeight: 800, fontFamily: T.fontDisplay, margin: '0 0 8px', lineHeight: 1.2 }}>
            Kenena Farm
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 15, margin: 0 }}>
            Management System
          </p>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, margin: '4px 0 0' }}>
            Kihura Sub-county, Uganda
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {[
            { icon: '🐇', label: 'Livestock Tracking', sub: 'Rabbits, Pigs, Poultry & Cattle' },
            { icon: '💰', label: 'Virtual Farm Ledger', sub: 'Remote financial oversight' },
            { icon: '📱', label: 'Mobile-First Design', sub: 'Optimised for tablet & phone' },
          ].map(f => (
            <div key={f.label} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ fontSize: 24, width: 40, textAlign: 'center' }}>{f.icon}</div>
              <div>
                <div style={{ color: T.white, fontWeight: 600, fontSize: 14 }}>{f.label}</div>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>{f.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div style={{
        width: 460, display: 'flex', flexDirection: 'column',
        justifyContent: 'center', padding: '48px 44px', background: T.white,
      }}>
        <div style={{ marginBottom: 36 }}>
          <h2 style={{ fontSize: 26, fontWeight: 800, color: T.textPrimary, margin: '0 0 6px', fontFamily: T.fontDisplay }}>
            Sign in
          </h2>
          <p style={{ color: T.textSecondary, fontSize: 14, margin: 0 }}>
            Enter your credentials to access the farm system
          </p>
        </div>

        {(error || suspendedMsg) && (
          <div style={{
            background: T.coralLight, border: `1px solid ${T.coral}44`,
            borderLeft: `4px solid ${T.coral}`,
            borderRadius: T.radiusSm, padding: '12px 16px',
            color: T.coralDark, fontSize: 14, marginBottom: 20,
          }}>
            {suspendedMsg || error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: T.textSecondary, marginBottom: 6 }}>
              Email Address
            </label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="owner@kenenafarm.ug"
              style={{
                width: '100%', height: T.touch, padding: '0 16px',
                border: `1.5px solid ${T.border}`, borderRadius: T.radiusSm,
                fontSize: 15, color: T.textPrimary, background: T.bgLight,
                outline: 'none', boxSizing: 'border-box', fontFamily: T.fontBody,
                transition: 'border-color 0.15s',
              }}
              onFocus={e => e.target.style.borderColor = T.emerald}
              onBlur={e => e.target.style.borderColor = T.border}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: T.textSecondary, marginBottom: 6 }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPass ? 'text' : 'password'} value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                placeholder="Enter your password"
                style={{
                  width: '100%', height: T.touch, padding: '0 48px 0 16px',
                  border: `1.5px solid ${T.border}`, borderRadius: T.radiusSm,
                  fontSize: 15, color: T.textPrimary, background: T.bgLight,
                  outline: 'none', boxSizing: 'border-box', fontFamily: T.fontBody,
                }}
                onFocus={e => e.target.style.borderColor = T.emerald}
                onBlur={e => e.target.style.borderColor = T.border}
              />
              <button onClick={() => setShowPass(!showPass)} style={{
                position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: T.textMuted,
              }}>
                {showPass ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <button
            onClick={handleLogin} disabled={loading}
            style={{
              height: 52, background: loading ? T.textMuted : T.emerald,
              border: 'none', borderRadius: T.radius, color: T.white,
              fontSize: 16, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: T.fontDisplay, letterSpacing: 0.3,
              boxShadow: loading ? 'none' : T.shadowMd,
              transition: 'all 0.2s',
            }}
          >
            {loading ? 'Signing in…' : 'Sign In →'}
          </button>
        </div>

        <div style={{
          marginTop: 32, padding: '16px', background: T.emeraldFaint,
          borderRadius: T.radiusSm, border: `1px solid ${T.emeraldPale}`,
        }}>
          <p style={{ fontSize: 12, color: T.textSecondary, margin: 0, fontWeight: 600 }}>Demo Accounts</p>
          <p style={{ fontSize: 12, color: T.textMuted, margin: '4px 0 0' }}>
            owner@kenenafarm.ug → Super Admin<br/>
            manager@kenenafarm.ug → Farm Manager<br/>
            <em>Any password in demo mode</em>
          </p>
        </div>
      </div>
    </div>
  );
}
