import { useState } from 'react';
import { T, statusColors, roleColors } from '../theme';

export function Card({ children, style, onClick, hover }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div onClick={onClick} onMouseEnter={() => hover && setHovered(true)} onMouseLeave={() => hover && setHovered(false)}
      style={{ background: T.white, borderRadius: T.radius, border: `1px solid ${T.border}`, boxShadow: hovered ? T.shadowMd : T.shadowSm, transition: 'box-shadow 0.2s, transform 0.15s', transform: hovered && onClick ? 'translateY(-2px)' : 'none', cursor: onClick ? 'pointer' : 'default', ...style }}>
      {children}
    </div>
  );
}

export function StatCard({ icon, label, value, sub, accent = T.emeraldMid, trend, onClick }) {
  return (
    <div onClick={onClick} style={{ background: T.white, borderRadius: T.radius, border: `1px solid ${T.border}`, boxShadow: T.shadowSm, padding: '20px 22px', cursor: onClick ? 'pointer' : 'default', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, right: 0, width: 80, height: 80, background: accent + '12', borderRadius: '0 12px 0 80px' }} />
      <div style={{ fontSize: 28, marginBottom: 12 }}>{icon}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: accent, fontFamily: T.fontDisplay, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 13, color: T.textSecondary, marginTop: 4, fontWeight: 500 }}>{label}</div>
      {sub && <div style={{ fontSize: 12, color: T.textMuted, marginTop: 3 }}>{sub}</div>}
      {trend && (
        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 12, color: parseFloat(trend) >= 0 ? T.teal : T.coral, fontWeight: 700 }}>{parseFloat(trend) >= 0 ? '▲' : '▼'} {Math.abs(parseFloat(trend))}%</span>
          <span style={{ fontSize: 11, color: T.textMuted }}>vs last month</span>
        </div>
      )}
    </div>
  );
}

export function Badge({ status, children, color, bg }) {
  const s = status ? statusColors[status] : null;
  return (
    <span style={{ background: bg || s?.bg || T.emeraldPale, color: color || s?.text || T.emeraldMid, borderRadius: T.radiusFull, padding: '4px 12px', fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 5, letterSpacing: 0.3, whiteSpace: 'nowrap' }}>
      {s?.dot && <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot, display: 'inline-block' }} />}
      {children}
    </span>
  );
}

export function RoleBadge({ role }) {
  const r = roleColors[role] || { bg: T.textMuted, text: T.white, label: role };
  return <span style={{ background: r.bg, color: r.text, borderRadius: T.radiusFull, padding: '3px 10px', fontSize: 11, fontWeight: 700, letterSpacing: 0.4 }}>{r.label}</span>;
}

export function Avatar({ name, photo, size = 40 }) {
  const initials = (name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const colors = [T.emeraldMid, T.teal, '#7B5EA7', T.blue, '#E07B39'];
  const color = colors[(name || '').charCodeAt(0) % colors.length];
  if (photo) return <img src={photo} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }} />;
  return <div style={{ width: size, height: size, borderRadius: '50%', background: color, color: T.white, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.35, fontWeight: 800, fontFamily: T.fontDisplay, flexShrink: 0, letterSpacing: 0.5 }}>{initials}</div>;
}

export function Drawer({ open, onClose, title, children, width = 520 }) {
  if (!open) return null;
  const w = typeof window !== 'undefined' ? Math.min(width, window.innerWidth) : width;
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 200, backdropFilter: 'blur(2px)' }} />
      <div style={{ position: 'fixed', right: 0, top: 0, bottom: 0, width: w, background: T.white, zIndex: 201, boxShadow: '-8px 0 40px rgba(27,67,50,0.2)', display: 'flex', flexDirection: 'column', animation: 'slideInRight 0.25s ease' }}>
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: T.emerald }}>
          <h3 style={{ margin: 0, color: T.white, fontSize: 17, fontWeight: 700, fontFamily: T.fontDisplay }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, width: 36, height: 36, cursor: 'pointer', color: T.white, fontSize: 18 }}>×</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>{children}</div>
      </div>
      <style>{`@keyframes slideInRight { from { transform: translateX(100%) } to { transform: translateX(0) } }`}</style>
    </>
  );
}

export function Btn({ children, onClick, variant = 'primary', size = 'md', disabled, icon, full, style: extraStyle }) {
  const variants = { primary: { bg: T.emerald, color: T.white, border: T.emerald }, secondary: { bg: T.white, color: T.emerald, border: T.emerald }, danger: { bg: T.coral, color: T.white, border: T.coral }, warning: { bg: T.amber, color: '#1a1a1a', border: T.amber }, ghost: { bg: 'transparent', color: T.textSecondary, border: T.border }, teal: { bg: T.teal, color: T.white, border: T.teal } };
  const sizes = { sm: { height: 36, padding: '0 14px', fontSize: 13 }, md: { height: T.touch, padding: '0 20px', fontSize: 14 }, lg: { height: 52, padding: '0 28px', fontSize: 16 } };
  const v = variants[variant]; const s = sizes[size];
  return (
    <button onClick={onClick} disabled={disabled} style={{ height: s.height, padding: s.padding, fontSize: s.fontSize, background: disabled ? T.bgMuted : v.bg, color: disabled ? T.textMuted : v.color, border: `1.5px solid ${disabled ? T.border : v.border}`, borderRadius: T.radiusSm, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: T.fontBody, display: 'inline-flex', alignItems: 'center', gap: 7, width: full ? '100%' : 'auto', justifyContent: full ? 'center' : undefined, boxShadow: disabled ? 'none' : T.shadowSm, transition: 'all 0.15s', ...extraStyle }}>
      {icon && <span>{icon}</span>}{children}
    </button>
  );
}

export function Field({ label, children, required, hint, error }) {
  return (
    <div style={{ marginBottom: 18 }}>
      {label && <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: T.textSecondary, marginBottom: 6 }}>{label}{required && <span style={{ color: T.coral }}> *</span>}</label>}
      {children}
      {hint && !error && <p style={{ fontSize: 12, color: T.textMuted, margin: '4px 0 0' }}>{hint}</p>}
      {error && <p style={{ fontSize: 12, color: T.coral, margin: '4px 0 0' }}>{error}</p>}
    </div>
  );
}

export function Input({ value, onChange, placeholder, type = 'text', disabled, onKeyDown, style: extra }) {
  return (
    <input type={type} value={value} onChange={onChange} placeholder={placeholder} disabled={disabled} onKeyDown={onKeyDown}
      style={{ width: '100%', height: T.touch, padding: '0 14px', border: `1.5px solid ${T.border}`, borderRadius: T.radiusSm, fontSize: 15, color: T.textPrimary, background: disabled ? T.bgLight : T.white, outline: 'none', boxSizing: 'border-box', fontFamily: T.fontBody, ...extra }}
      onFocus={e => e.target.style.borderColor = T.emerald}
      onBlur={e => e.target.style.borderColor = T.border}
    />
  );
}

export function Select({ value, onChange, children, disabled, style: extra }) {
  return (
    <select value={value} onChange={onChange} disabled={disabled}
      style={{ width: '100%', height: T.touch, padding: '0 14px', border: `1.5px solid ${T.border}`, borderRadius: T.radiusSm, fontSize: 15, color: T.textPrimary, background: T.white, outline: 'none', boxSizing: 'border-box', fontFamily: T.fontBody, cursor: 'pointer', ...extra }}>
      {children}
    </select>
  );
}

export function SectionHeader({ title, sub, action }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: T.textPrimary, fontFamily: T.fontDisplay }}>{title}</h2>
        {sub && <p style={{ margin: '3px 0 0', fontSize: 13, color: T.textSecondary }}>{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ icon, title, sub, action }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 24px' }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>{icon}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: T.textPrimary, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 14, color: T.textMuted, marginBottom: 20 }}>{sub}</div>
      {action}
    </div>
  );
}

export function Spinner({ size = 24 }) {
  return (
    <>
      <div style={{ width: size, height: size, border: `3px solid ${T.emeraldPale}`, borderTopColor: T.emerald, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </>
  );
}

export function Alert({ type = 'warning', children, onDismiss }) {
  const colors = { warning: { bg: T.amberLight, border: T.amber, text: T.amberDark, icon: '⚠️' }, error: { bg: T.coralLight, border: T.coral, text: T.coralDark, icon: '🚨' }, success: { bg: T.emeraldPale, border: T.emeraldLight, text: T.teal, icon: '✅' }, info: { bg: T.blueLight, border: T.blue, text: '#1565C0', icon: 'ℹ️' } };
  const c = colors[type] || colors.info;
  return (
    <div style={{ background: c.bg, border: `1px solid ${c.border}`, borderLeft: `4px solid ${c.border}`, borderRadius: T.radiusSm, padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
      <span>{c.icon}</span>
      <div style={{ flex: 1, fontSize: 14, color: c.text }}>{children}</div>
      {onDismiss && <button onClick={onDismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.text, fontSize: 18, lineHeight: 1 }}>×</button>}
    </div>
  );
}
