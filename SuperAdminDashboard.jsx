import { useState, useEffect, useCallback } from 'react';
import { T } from '../theme';
import { StatCard, Btn, Badge, Avatar, Alert, Drawer, Field, Input, Select, Spinner, SectionHeader } from '../components/UI';
import { apiFetch } from '../context/AuthContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

// ── EXCHANGE RATES ────────────────────────────────────────────────────────────
const UGX_TO_USD = 0.000265;
const UGX_TO_GBP = 0.000211;

const fmt = n => new Intl.NumberFormat('en-UG').format(Math.round(n));
const fmtUGX = n => `UGX ${fmt(n)}`;

// ── MOCK DATA ─────────────────────────────────────────────────────────────────
const MOCK_WALLETS = [
  { wallet_name: 'Main Farm Wallet', currency: 'UGX', balance: 14850000 },
  { wallet_name: 'USD Reserve', currency: 'USD', balance: 1200 },
];

const MOCK_REVENUE = [
  { month: 'Jan', income: 2800000, expenses: 1400000 },
  { month: 'Feb', income: 3100000, expenses: 1550000 },
  { month: 'Mar', income: 2950000, expenses: 1480000 },
  { month: 'Apr', income: 3700000, expenses: 1600000 },
  { month: 'May', income: 4100000, expenses: 1820000 },
  { month: 'Jun', income: 4550000, expenses: 1950000 },
];

const MOCK_EXPENSE_BREAKDOWN = [
  { name: 'Feed', value: 680000, color: T.emeraldMid },
  { name: 'Veterinary', value: 320000, color: T.blue },
  { name: 'Payroll', value: 750000, color: T.amber },
  { name: 'Construction', value: 120000, color: '#7B5EA7' },
  { name: 'Fuel & Transport', value: 80000, color: T.coral },
];

const MOCK_PENDING = [
  {
    id: 'REQ-001', requested_by_name: 'Kihura Manager', requested_by_avatar: 'KM',
    purpose: 'Monthly rabbit feed purchase — Kihura Agro Suppliers', category: 'Feed',
    amount: 680000, currency: 'UGX', created_at: new Date(Date.now() - 3600000).toISOString(),
    items: [{ desc: '20 bags layer mash 25kg', qty: 20, unit_price: 34000 }],
    urgency: 'high',
  },
  {
    id: 'REQ-002', requested_by_name: 'Kihura Manager', requested_by_avatar: 'KM',
    purpose: 'Pig vaccination — Dr. Kato Veterinary Services', category: 'Veterinary',
    amount: 320000, currency: 'UGX', created_at: new Date(Date.now() - 86400000).toISOString(),
    items: [{ desc: 'FMD Vaccine × 12 doses', qty: 12, unit_price: 18000 }, { desc: 'Vet consultation fee', qty: 1, unit_price: 104000 }],
    urgency: 'medium',
  },
  {
    id: 'REQ-003', requested_by_name: 'Kihura Manager', requested_by_avatar: 'KM',
    purpose: 'Fence repair materials — Pen Block C', category: 'Construction',
    amount: 185000, currency: 'UGX', created_at: new Date(Date.now() - 172800000).toISOString(),
    items: [{ desc: 'Timber posts × 15', qty: 15, unit_price: 8000 }, { desc: 'Wire mesh roll', qty: 2, unit_price: 52500 }],
    urgency: 'low',
  },
];

const MOCK_PL = {
  period: { start: '2025-06-01', end: '2025-06-30' },
  income: { total: 4550000, vs_previous: '+10.9' },
  expenses: { total: 1950000, vs_previous: '+7.1' },
  net_profit: 2600000,
  profit_margin: '57.1',
  livestock_loss_value: 85000,
  payroll_total: 750000,
};

// ── NET PROFIT FORMULA ENGINE ─────────────────────────────────────────────────
function calcNetProfit(income, operatingExpenses, payroll, livestockLoss) {
  return income - (operatingExpenses + payroll + livestockLoss);
}

// ── INJECT CAPITAL DRAWER ─────────────────────────────────────────────────────
function InjectCapitalDrawer({ open, onClose, onSuccess }) {
  const [form, setForm] = useState({ wallet_id: '1', amount: '', currency: 'UGX', description: '' });
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    if (!form.amount || parseFloat(form.amount) <= 0) return;
    setLoading(true);
    try {
      const res = await apiFetch('/wallet/inject', { method: 'POST', body: JSON.stringify(form) });
      onSuccess(parseFloat(form.amount), form.currency, form.description);
    } catch {
      onSuccess(parseFloat(form.amount), form.currency, form.description);
    }
    setLoading(false);
    onClose();
    setForm({ wallet_id: '1', amount: '', currency: 'UGX', description: '' });
  };

  return (
    <Drawer open={open} onClose={onClose} title="💰 Inject Capital">
      <div style={{ marginBottom: 20, padding: 16, background: T.emeraldFaint, borderRadius: T.radiusSm, border: `1px solid ${T.emeraldPale}` }}>
        <p style={{ fontSize: 13, color: T.emeraldMid, fontWeight: 600, margin: '0 0 4px' }}>Super Admin Action Only</p>
        <p style={{ fontSize: 13, color: T.textSecondary, margin: 0 }}>
          Capital injection records funds you've physically moved into the farm account. This updates the virtual ledger balance and creates an immutable audit record.
        </p>
      </div>
      <Field label="Amount" required>
        <Input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} placeholder="e.g. 5000000" />
      </Field>
      <Field label="Currency">
        <Select value={form.currency} onChange={e => setForm(p => ({ ...p, currency: e.target.value }))}>
          <option value="UGX">UGX — Ugandan Shilling</option>
          <option value="USD">USD — US Dollar</option>
          <option value="GBP">GBP — British Pound</option>
          <option value="EUR">EUR — Euro</option>
        </Select>
      </Field>
      {form.amount && form.currency !== 'UGX' && (
        <div style={{ padding: '10px 14px', background: T.blueLight, borderRadius: T.radiusSm, marginBottom: 12, fontSize: 13, color: '#1565C0' }}>
          ≈ UGX {fmt(parseFloat(form.amount || 0) * (form.currency === 'USD' ? 1 / UGX_TO_USD : form.currency === 'GBP' ? 1 / UGX_TO_GBP : 3850))}
        </div>
      )}
      <Field label="Description / Source" required>
        <Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="e.g. Monthly remittance from UK" />
      </Field>
      <Btn variant="primary" full onClick={handle} disabled={loading || !form.amount || !form.description} icon="✓">
        {loading ? 'Processing…' : `Inject ${form.currency} ${form.amount || '0'}`}
      </Btn>
    </Drawer>
  );
}

// ── APPROVAL QUEUE CARD ───────────────────────────────────────────────────────
function ApprovalCard({ req, onApprove, onReject, processing }) {
  const [expanded, setExpanded] = useState(false);
  const urgencyColors = { high: T.coral, medium: T.amber, low: T.emeraldMid };
  const urgencyBg = { high: T.coralLight, medium: T.amberLight, low: T.emeraldPale };

  return (
    <div style={{
      background: T.white, borderRadius: T.radius,
      border: `1.5px solid ${req.urgency === 'high' ? T.coral + '44' : T.border}`,
      boxShadow: T.shadowSm, overflow: 'hidden',
      transition: 'box-shadow 0.2s',
    }}>
      {/* Urgency strip */}
      <div style={{ height: 3, background: urgencyColors[req.urgency || 'medium'] }} />

      <div style={{ padding: '18px 20px' }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 14 }}>
          <Avatar name={req.requested_by_name} size={42} />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: T.textPrimary }}>{req.requested_by_name}</span>
              <Badge bg={urgencyBg[req.urgency || 'medium']} color={urgencyColors[req.urgency || 'medium']}>
                {req.category}
              </Badge>
              <span style={{ fontSize: 11, color: T.textMuted, marginLeft: 'auto' }}>
                {new Date(req.created_at).toLocaleString('en-UG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <p style={{ fontSize: 14, color: T.textSecondary, margin: 0, lineHeight: 1.5 }}>{req.purpose}</p>
          </div>
        </div>

        {/* Amount */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', background: T.bgLight, borderRadius: T.radiusSm,
          marginBottom: 14,
        }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: T.coral, fontFamily: T.fontDisplay }}>
              {fmtUGX(req.amount)}
            </div>
            <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>
              ≈ USD {(req.amount * UGX_TO_USD).toFixed(2)} · GBP {(req.amount * UGX_TO_GBP).toFixed(2)}
            </div>
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.emeraldMid, fontSize: 13, fontWeight: 600 }}
          >
            {expanded ? '▲ Hide items' : '▼ View items'}
          </button>
        </div>

        {/* Item breakdown */}
        {expanded && req.items && (
          <div style={{ marginBottom: 14 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: T.bgLight }}>
                  {['Item', 'Qty', 'Unit Price', 'Total'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: T.textSecondary, fontWeight: 600, borderBottom: `1px solid ${T.border}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {req.items.map((item, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${T.border}` }}>
                    <td style={{ padding: '9px 12px', color: T.textPrimary }}>{item.desc}</td>
                    <td style={{ padding: '9px 12px', color: T.textSecondary }}>{item.qty}</td>
                    <td style={{ padding: '9px 12px', color: T.textSecondary }}>{fmtUGX(item.unit_price)}</td>
                    <td style={{ padding: '9px 12px', fontWeight: 700, color: T.textPrimary }}>{fmtUGX(item.qty * item.unit_price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 10 }}>
          <Btn
            variant="primary" full
            disabled={processing === req.id}
            onClick={() => onApprove(req)}
            icon="✓"
          >
            {processing === req.id ? 'Processing…' : 'APPROVE'}
          </Btn>
          <Btn
            variant="danger"
            style={{ minWidth: 100 }}
            disabled={processing === req.id}
            onClick={() => onReject(req)}
          >
            REJECT
          </Btn>
        </div>
      </div>
    </div>
  );
}

// ── MAIN DASHBOARD ────────────────────────────────────────────────────────────
export default function SuperAdminDashboard() {
  const [wallets, setWallets] = useState(MOCK_WALLETS);
  const [pending, setPending] = useState(MOCK_PENDING);
  const [pl, setPL] = useState(MOCK_PL);
  const [trend, setTrend] = useState(MOCK_REVENUE);
  const [injectOpen, setInjectOpen] = useState(false);
  const [processing, setProcessing] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);

  const ugxBalance = wallets.find(w => w.currency === 'UGX')?.balance || 0;

  // NET PROFIT FORMULA: Revenue - (Operating Expenses + Payroll + Livestock Loss)
  const operatingExpenses = pl.expenses.total - (pl.payroll_total || 0) - (pl.livestock_loss_value || 0);
  const netProfit = calcNetProfit(pl.income.total, operatingExpenses, pl.payroll_total || 0, pl.livestock_loss_value || 0);

  const addAlert = (msg, type = 'success') => {
    const id = Date.now();
    setAlerts(prev => [{ id, msg, type }, ...prev]);
    setTimeout(() => setAlerts(prev => prev.filter(a => a.id !== id)), 5000);
  };

  const handleApprove = async (req) => {
    if (ugxBalance < req.amount) {
      addAlert('Insufficient wallet balance to approve this request.', 'error'); return;
    }
    setProcessing(req.id);
    try {
      await apiFetch(`/wallet/approve-expense/${req.id}`, { method: 'POST' });
    } catch { /* demo */ }
    setWallets(prev => prev.map(w =>
      w.currency === req.currency ? { ...w, balance: w.balance - req.amount } : w
    ));
    setPending(prev => prev.filter(p => p.id !== req.id));
    setPL(prev => ({ ...prev, expenses: { ...prev.expenses, total: prev.expenses.total + req.amount } }));
    setProcessing(null);
    addAlert(`✅ ${req.category} request approved — ${fmtUGX(req.amount)} deducted from wallet.`);
  };

  const handleReject = async (req) => {
    setProcessing(req.id);
    try {
      await apiFetch(`/wallet/reject-expense/${req.id}`, { method: 'POST' });
    } catch { /* demo */ }
    setPending(prev => prev.filter(p => p.id !== req.id));
    setProcessing(null);
    addAlert(`Request from ${req.requested_by_name} rejected.`, 'warning');
  };

  const handleCapitalInjected = (amount, currency, desc) => {
    if (currency === 'UGX') {
      setWallets(prev => prev.map(w => w.currency === 'UGX' ? { ...w, balance: w.balance + amount } : w));
    }
    addAlert(`💰 ${currency} ${fmt(amount)} injected — "${desc}"`);
  };

  return (
    <div style={{ fontFamily: T.fontBody }}>
      {/* Alerts */}
      {alerts.length > 0 && (
        <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 300, display: 'flex', flexDirection: 'column', gap: 8, width: 380 }}>
          {alerts.map(a => <Alert key={a.id} type={a.type} onDismiss={() => setAlerts(p => p.filter(x => x.id !== a.id))}>{a.msg}</Alert>)}
        </div>
      )}

      {/* PAGE HEADER */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: T.emerald, margin: '0 0 4px', fontFamily: T.fontDisplay }}>
              Farm Ledger
            </h1>
            <p style={{ color: T.textSecondary, margin: 0, fontSize: 14 }}>
              {new Date().toLocaleDateString('en-UG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · Virtual cash ledger mirror
            </p>
          </div>
          <Btn variant="primary" icon="+" onClick={() => setInjectOpen(true)}>
            Inject Capital
          </Btn>
        </div>
      </div>

      {/* ── WALLET BALANCE HERO ── */}
      <div style={{
        background: T.emerald, borderRadius: T.radiusLg,
        padding: '32px 36px', marginBottom: 24, position: 'relative', overflow: 'hidden',
        backgroundImage: 'radial-gradient(ellipse at top right, #40916C 0%, transparent 70%)',
        boxShadow: T.shadowLg,
      }}>
        <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
        <div style={{ position: 'absolute', bottom: -60, right: 80, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />

        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', margin: '0 0 8px' }}>
          Total Wallet Balance
        </p>
        <div style={{ fontSize: 44, fontWeight: 800, color: T.white, fontFamily: T.fontDisplay, fontVariantNumeric: 'tabular-nums', lineHeight: 1, marginBottom: 8 }}>
          {fmtUGX(ugxBalance)}
        </div>
        <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 15 }}>
          ≈ USD {(ugxBalance * UGX_TO_USD).toFixed(2)} &nbsp;·&nbsp; GBP {(ugxBalance * UGX_TO_GBP).toFixed(2)}
        </div>

        {/* Sub wallet row */}
        <div style={{ display: 'flex', gap: 20, marginTop: 24, flexWrap: 'wrap' }}>
          {wallets.map(w => (
            <div key={w.currency} style={{ display: 'flex', gap: 12, alignItems: 'center', background: 'rgba(255,255,255,0.1)', borderRadius: T.radiusSm, padding: '10px 16px' }}>
              <span style={{ fontSize: 20 }}>{w.currency === 'UGX' ? '🇺🇬' : w.currency === 'USD' ? '🇺🇸' : '🇬🇧'}</span>
              <div>
                <div style={{ color: T.white, fontWeight: 700, fontSize: 16, fontVariantNumeric: 'tabular-nums' }}>
                  {w.currency} {fmt(w.balance)}
                </div>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>{w.wallet_name}</div>
              </div>
            </div>
          ))}
          <button
            onClick={() => setInjectOpen(true)}
            style={{
              background: 'rgba(255,255,255,0.15)', border: '1.5px solid rgba(255,255,255,0.3)',
              borderRadius: T.radiusSm, padding: '10px 20px', color: T.white,
              cursor: 'pointer', fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8,
            }}
          >
            + Record Injected Capital
          </button>
        </div>
      </div>

      {/* ── NET PROFIT FORMULA METRICS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <StatCard
          icon="📈" label="Monthly Revenue" accent={T.teal}
          value={fmtUGX(pl.income.total)}
          trend={pl.income.vs_previous}
          sub="All income sources"
        />
        <StatCard
          icon="📉" label="Operating Expenses" accent={T.amber}
          value={fmtUGX(operatingExpenses)}
          sub="Feed · Vet · Materials"
        />
        <StatCard
          icon="👷" label="Payroll + Loss" accent={T.coral}
          value={fmtUGX((pl.payroll_total || 0) + (pl.livestock_loss_value || 0))}
          sub={`Payroll: ${fmtUGX(pl.payroll_total || 0)}`}
        />
        <StatCard
          icon={netProfit >= 0 ? '💵' : '📛'} label="Net Profit (Formula)" accent={netProfit >= 0 ? T.teal : T.coral}
          value={fmtUGX(Math.abs(netProfit))}
          sub={`${pl.profit_margin}% margin · Revenue − (Opex + Payroll + Loss)`}
          trend={netProfit >= 0 ? `+${pl.profit_margin}` : `-${pl.profit_margin}`}
        />
      </div>

      {/* ── FORMULA BOX ── */}
      <div style={{
        background: T.white, borderRadius: T.radius, border: `1px solid ${T.border}`,
        boxShadow: T.shadowSm, padding: '16px 22px', marginBottom: 24,
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: T.textSecondary }}>NET PROFIT =</span>
        <span style={{ color: T.teal, fontWeight: 800, fontSize: 15, fontFamily: T.fontMono }}>{fmtUGX(pl.income.total)}</span>
        <span style={{ color: T.textMuted }}>−</span>
        <span style={{ color: T.textSecondary, fontSize: 13 }}>
          (
          <span style={{ color: T.amber, fontWeight: 700 }}>{fmtUGX(operatingExpenses)}</span>
          {' '}opex +{' '}
          <span style={{ color: T.coral, fontWeight: 700 }}>{fmtUGX(pl.payroll_total)}</span>
          {' '}payroll +{' '}
          <span style={{ color: T.coral, fontWeight: 700 }}>{fmtUGX(pl.livestock_loss_value)}</span>
          {' '}loss
          )
        </span>
        <span style={{ color: T.textMuted }}>=</span>
        <span style={{ color: netProfit >= 0 ? T.teal : T.coral, fontWeight: 900, fontSize: 17, fontFamily: T.fontDisplay }}>
          {fmtUGX(netProfit)}
        </span>
      </div>

      {/* ── CHARTS ROW ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 20, marginBottom: 24 }}>

        {/* Revenue Bar Chart */}
        <div style={{ background: T.white, borderRadius: T.radius, border: `1px solid ${T.border}`, boxShadow: T.shadowSm, padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: T.textPrimary, fontFamily: T.fontDisplay }}>Revenue vs Expenses</h3>
              <p style={{ margin: '3px 0 0', fontSize: 13, color: T.textSecondary }}>6-month trend</p>
            </div>
            <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
              <span style={{ color: T.teal }}>⬛ Revenue</span>
              <span style={{ color: T.amber }}>⬛ Expenses</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={trend} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
              <XAxis dataKey="month" tick={{ fill: T.textMuted, fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: T.textMuted, fontSize: 11 }} axisLine={false} tickLine={false}
                tickFormatter={v => `${(v / 1000000).toFixed(1)}M`} />
              <Tooltip
                contentStyle={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: T.radiusSm, boxShadow: T.shadowMd }}
                formatter={v => [fmtUGX(v)]}
              />
              <Bar dataKey="income" fill={T.teal} radius={[6, 6, 0, 0]} name="Revenue" />
              <Bar dataKey="expenses" fill={T.amber} radius={[6, 6, 0, 0]} name="Expenses" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Expense Donut */}
        <div style={{ background: T.white, borderRadius: T.radius, border: `1px solid ${T.border}`, boxShadow: T.shadowSm, padding: '24px' }}>
          <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800, color: T.textPrimary, fontFamily: T.fontDisplay }}>Expense Breakdown</h3>
          <p style={{ margin: '0 0 16px', fontSize: 13, color: T.textSecondary }}>Current month by category</p>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={MOCK_EXPENSE_BREAKDOWN} cx="50%" cy="50%" innerRadius={55} outerRadius={80}
                dataKey="value" paddingAngle={3}>
                {MOCK_EXPENSE_BREAKDOWN.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip formatter={v => fmtUGX(v)} contentStyle={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: T.radiusSm }} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {MOCK_EXPENSE_BREAKDOWN.map(e => (
              <div key={e.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: e.color, display: 'inline-block' }} />
                  <span style={{ color: T.textSecondary }}>{e.name}</span>
                </span>
                <span style={{ fontWeight: 700, color: T.textPrimary, fontFamily: T.fontMono }}>{fmtUGX(e.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── APPROVAL QUEUE ── */}
      <div>
        <SectionHeader
          title="Pending Approval Queue"
          sub={pending.length > 0 ? `${pending.length} requests awaiting your decision` : 'All clear — no pending requests'}
          action={pending.length > 0 && (
            <Badge bg={T.amberLight} color={T.amberDark}>{pending.length} Pending</Badge>
          )}
        />

        {pending.length === 0 ? (
          <div style={{ background: T.white, borderRadius: T.radius, border: `1px solid ${T.border}`, boxShadow: T.shadowSm, padding: '48px', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: T.textPrimary }}>No pending approvals</div>
            <div style={{ fontSize: 14, color: T.textMuted, marginTop: 4 }}>All expense requests have been processed</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: 16 }}>
            {pending.map(req => (
              <ApprovalCard key={req.id} req={req} onApprove={handleApprove} onReject={handleReject} processing={processing} />
            ))}
          </div>
        )}
      </div>

      <InjectCapitalDrawer open={injectOpen} onClose={() => setInjectOpen(false)} onSuccess={handleCapitalInjected} />
    </div>
  );
}
