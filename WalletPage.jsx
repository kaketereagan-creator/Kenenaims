import { useState, useEffect } from 'react';
import { T } from '../../theme';
import { SectionHeader, Btn, Badge, Alert, Drawer, Field, Input, Select } from '../../components/UI';
import { apiFetch } from '../../context/AuthContext';
import { useAuth } from '../../context/AuthContext';

const fmt = n => new Intl.NumberFormat('en-UG').format(Math.round(Math.abs(n)));
const fmtCurrency = (amount, currency) => {
  try { return new Intl.NumberFormat('en-UG', { style: 'currency', currency, minimumFractionDigits: 0 }).format(amount); }
  catch { return `${currency} ${fmt(amount)}`; }
};

const UGX_TO_USD = 0.000265;
const UGX_TO_GBP = 0.000211;

const TXN_LABELS = {
  capital_injection: { label: 'Capital Injection', color: T.teal, bg: T.emeraldPale, icon: '💰' },
  income:           { label: 'Farm Income',       color: T.teal, bg: T.emeraldPale, icon: '📈' },
  expense:          { label: 'Expense',           color: T.coral, bg: T.coralLight, icon: '💸' },
  payroll:          { label: 'Payroll',           color: '#7B5EA7', bg: '#F3E5F5', icon: '👷' },
  transfer:         { label: 'Transfer',          color: T.blue, bg: T.blueLight, icon: '↔️' },
};

const MOCK_WALLETS = [
  { id: 1, wallet_name: 'Main Farm Wallet', currency: 'UGX', balance: 14850000 },
  { id: 2, wallet_name: 'USD Reserve', currency: 'USD', balance: 1200 },
  { id: 3, wallet_name: 'GBP Wallet', currency: 'GBP', balance: 480 },
];

const MOCK_TRANSACTIONS = [
  { id: '1', transaction_type: 'capital_injection', direction: 'credit', amount: 5000000, currency: 'UGX', balance_after: 14850000, description: 'Monthly remittance from UK — June 2025', created_at: '2025-06-28T10:30:00Z', created_by_name: 'Farm Owner' },
  { id: '2', transaction_type: 'income', direction: 'credit', amount: 1200000, currency: 'UGX', balance_after: 9850000, description: 'Pig sales — 2 finished pigs 95kg each', created_at: '2025-06-25T14:00:00Z', created_by_name: 'Kihura Manager' },
  { id: '3', transaction_type: 'expense', direction: 'debit', amount: 680000, currency: 'UGX', balance_after: 8650000, description: 'Feed purchase — 20 bags layer mash, Kihura Agro', created_at: '2025-06-22T09:00:00Z', created_by_name: 'Farm Owner' },
  { id: '4', transaction_type: 'income', direction: 'credit', amount: 480000, currency: 'UGX', balance_after: 9330000, description: 'Rabbit sales — 12 units to Kampala buyer', created_at: '2025-06-20T16:00:00Z', created_by_name: 'Kihura Manager' },
  { id: '5', transaction_type: 'payroll', direction: 'debit', amount: 1516500, currency: 'UGX', balance_after: 8850000, description: 'May 2025 payroll disbursement — 5 employees', created_at: '2025-06-01T08:00:00Z', created_by_name: 'Farm Owner' },
  { id: '6', transaction_type: 'expense', direction: 'debit', amount: 320000, currency: 'UGX', balance_after: 10366500, description: 'Pig vaccination — Dr. Kato Veterinary Services', created_at: '2025-05-28T11:00:00Z', created_by_name: 'Farm Owner' },
  { id: '7', transaction_type: 'capital_injection', direction: 'credit', amount: 3000000, currency: 'UGX', balance_after: 10686500, description: 'Capital top-up — May remittance', created_at: '2025-05-25T09:00:00Z', created_by_name: 'Farm Owner' },
];

export default function WalletPage() {
  const { user } = useAuth();
  const [wallets, setWallets] = useState(MOCK_WALLETS);
  const [transactions, setTransactions] = useState(MOCK_TRANSACTIONS);
  const [filter, setFilter] = useState('all');
  const [injectOpen, setInjectOpen] = useState(false);
  const [alert, setAlert] = useState(null);
  const [inject, setInject] = useState({ wallet_id: '1', amount: '', currency: 'UGX', description: '' });
  const [loading, setLoading] = useState(false);
  const isAdmin = user?.role_name === 'super_admin' || user?.role === 'super_admin';

  const ugxBalance = wallets.find(w => w.currency === 'UGX')?.balance || 0;
  const totalCredits = transactions.filter(t => t.direction === 'credit').reduce((s, t) => s + t.amount, 0);
  const totalDebits = transactions.filter(t => t.direction === 'debit').reduce((s, t) => s + t.amount, 0);

  const filtered = filter === 'all' ? transactions : transactions.filter(t => t.transaction_type === filter);

  const handleInject = async () => {
    if (!inject.amount || !inject.description) return;
    setLoading(true);
    const amount = parseFloat(inject.amount);
    try {
      await apiFetch('/wallet/inject', { method: 'POST', body: JSON.stringify({ ...inject, amount, wallet_id: parseInt(inject.wallet_id) }) });
    } catch { /* demo */ }
    const newTxn = { id: Date.now().toString(), transaction_type: 'capital_injection', direction: 'credit', amount, currency: inject.currency, balance_after: ugxBalance + (inject.currency === 'UGX' ? amount : 0), description: inject.description, created_at: new Date().toISOString(), created_by_name: user?.full_name };
    setTransactions(p => [newTxn, ...p]);
    if (inject.currency === 'UGX') setWallets(p => p.map(w => w.currency === 'UGX' ? { ...w, balance: w.balance + amount } : w));
    setLoading(false);
    setInjectOpen(false);
    setInject({ wallet_id: '1', amount: '', currency: 'UGX', description: '' });
    setAlert({ type: 'success', msg: `${inject.currency} ${new Intl.NumberFormat('en-UG').format(amount)} injected successfully.` });
    setTimeout(() => setAlert(null), 5000);
  };

  return (
    <div style={{ fontFamily: T.fontBody }}>
      <SectionHeader
        title="Farm Wallet"
        sub="Immutable ledger — all farm financial movements"
        action={isAdmin && <Btn variant="primary" size="sm" icon="💰" onClick={() => setInjectOpen(true)}>Inject Capital</Btn>}
      />

      {alert && <div style={{ marginBottom: 16 }}><Alert type={alert.type} onDismiss={() => setAlert(null)}>{alert.msg}</Alert></div>}

      {/* Wallet balance cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        {wallets.map((w, i) => (
          <div key={w.id} style={{
            background: i === 0 ? T.emerald : T.white,
            borderRadius: T.radius,
            border: `1px solid ${i === 0 ? T.emerald : T.border}`,
            boxShadow: i === 0 ? T.shadowLg : T.shadowSm,
            padding: '22px 24px',
            backgroundImage: i === 0 ? 'radial-gradient(ellipse at top right, #40916C 0%, transparent 70%)' : 'none',
          }}>
            <div style={{ fontSize: 22, marginBottom: 8 }}>{w.currency === 'UGX' ? '🇺🇬' : w.currency === 'USD' ? '🇺🇸' : '🇬🇧'}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: i === 0 ? T.white : T.textPrimary, fontFamily: T.fontDisplay, fontVariantNumeric: 'tabular-nums' }}>
              {fmtCurrency(w.balance, w.currency)}
            </div>
            <div style={{ fontSize: 13, color: i === 0 ? 'rgba(255,255,255,0.65)' : T.textSecondary, marginTop: 4 }}>{w.wallet_name}</div>
            {i === 0 && (
              <div style={{ marginTop: 10, fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                ≈ USD {(w.balance * UGX_TO_USD).toFixed(0)} · GBP {(w.balance * UGX_TO_GBP).toFixed(0)}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Summary strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Total Credits', value: `UGX ${fmt(totalCredits)}`, color: T.teal, icon: '▲' },
          { label: 'Total Debits', value: `UGX ${fmt(totalDebits)}`, color: T.coral, icon: '▼' },
          { label: 'Net Flow', value: `UGX ${fmt(totalCredits - totalDebits)}`, color: totalCredits > totalDebits ? T.teal : T.coral, icon: totalCredits > totalDebits ? '▲' : '▼' },
        ].map(s => (
          <div key={s.label} style={{ background: T.white, borderRadius: T.radius, border: `1px solid ${T.border}`, boxShadow: T.shadowSm, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ fontSize: 22, color: s.color, fontWeight: 900 }}>{s.icon}</span>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: s.color, fontFamily: T.fontMono }}>{s.value}</div>
              <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 2 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Transaction ledger */}
      <div style={{ background: T.white, borderRadius: T.radius, border: `1px solid ${T.border}`, boxShadow: T.shadowSm, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${T.border}`, background: T.bgLight, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: T.textPrimary }}>Transaction Ledger</h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {['all', 'capital_injection', 'income', 'expense', 'payroll'].map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                height: 34, padding: '0 14px', borderRadius: T.radiusSm,
                background: filter === f ? T.emerald : T.white,
                border: `1px solid ${filter === f ? T.emerald : T.border}`,
                color: filter === f ? T.white : T.textSecondary,
                cursor: 'pointer', fontSize: 12, fontWeight: 700,
              }}>
                {f === 'all' ? 'All' : TXN_LABELS[f]?.label || f}
              </button>
            ))}
          </div>
        </div>

        {filtered.map((txn, i) => {
          const t = TXN_LABELS[txn.transaction_type] || { label: txn.transaction_type, color: T.textMuted, bg: T.bgLight, icon: '💳' };
          return (
            <div key={txn.id} style={{
              display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px',
              borderBottom: i < filtered.length - 1 ? `1px solid ${T.border}` : 'none',
              background: i % 2 === 0 ? T.white : T.bgLight + '60',
            }}>
              {/* Icon */}
              <div style={{ width: 42, height: 42, borderRadius: 12, background: t.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0, border: `1px solid ${t.color}22` }}>
                {t.icon}
              </div>

              {/* Details */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <span style={{ background: t.bg, color: t.color, borderRadius: T.radiusFull, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>{t.label}</span>
                  <span style={{ fontSize: 11, color: T.textMuted }}>{txn.created_by_name}</span>
                </div>
                <div style={{ fontSize: 14, color: T.textPrimary, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{txn.description}</div>
                <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>{new Date(txn.created_at).toLocaleString('en-UG', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
              </div>

              {/* Amount */}
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 17, fontWeight: 800, color: txn.direction === 'credit' ? T.teal : T.coral, fontFamily: T.fontMono }}>
                  {txn.direction === 'credit' ? '+' : '−'} {txn.currency} {fmt(txn.amount)}
                </div>
                {txn.balance_after && (
                  <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>
                    Balance: UGX {fmt(txn.balance_after)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Inject Capital Drawer */}
      <Drawer open={injectOpen} onClose={() => setInjectOpen(false)} title="💰 Inject Capital">
        <div style={{ padding: '12px 16px', background: T.emeraldFaint, borderRadius: T.radiusSm, marginBottom: 20, border: `1px solid ${T.emeraldPale}` }}>
          <p style={{ fontSize: 13, color: T.emeraldMid, fontWeight: 700, margin: '0 0 4px' }}>Super Admin Action</p>
          <p style={{ fontSize: 13, color: T.textSecondary, margin: 0 }}>Records funds you've physically transferred into the farm account. Creates an immutable ledger entry.</p>
        </div>
        <Field label="Target Wallet">
          <Select value={inject.wallet_id} onChange={e => setInject(p => ({ ...p, wallet_id: e.target.value }))}>
            {wallets.map(w => <option key={w.id} value={w.id}>{w.currency} — {w.wallet_name}</option>)}
          </Select>
        </Field>
        <Field label="Currency">
          <Select value={inject.currency} onChange={e => setInject(p => ({ ...p, currency: e.target.value }))}>
            <option value="UGX">UGX — Ugandan Shilling</option>
            <option value="USD">USD — US Dollar</option>
            <option value="GBP">GBP — British Pound</option>
            <option value="EUR">EUR — Euro</option>
          </Select>
        </Field>
        <Field label="Amount" required>
          <Input type="number" value={inject.amount} onChange={e => setInject(p => ({ ...p, amount: e.target.value }))} placeholder={inject.currency === 'UGX' ? 'e.g. 5000000' : 'e.g. 500'} />
        </Field>
        {inject.amount && inject.currency !== 'UGX' && (
          <div style={{ padding: '8px 12px', background: T.blueLight, borderRadius: T.radiusSm, marginBottom: 12, fontSize: 13, color: '#1565C0', fontWeight: 600 }}>
            ≈ UGX {fmt(parseFloat(inject.amount || 0) * (inject.currency === 'USD' ? 1 / UGX_TO_USD : inject.currency === 'GBP' ? 1 / UGX_TO_GBP : 3700))}
          </div>
        )}
        <Field label="Source / Description" required hint="e.g. Monthly remittance from UK — June 2025">
          <Input value={inject.description} onChange={e => setInject(p => ({ ...p, description: e.target.value }))} placeholder="Describe the source of this capital" />
        </Field>
        <Btn variant="primary" full onClick={handleInject} disabled={loading || !inject.amount || !inject.description} icon="✓">
          {loading ? 'Processing…' : `Inject ${inject.currency} ${inject.amount || '0'}`}
        </Btn>
      </Drawer>
    </div>
  );
}
