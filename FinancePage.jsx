import { useState, useEffect } from 'react';
import { T } from '../../theme';
import { SectionHeader, Btn, Badge, Alert, Drawer, Field, Input, Select } from '../../components/UI';
import { apiFetch } from '../../context/AuthContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';

const fmt = n => new Intl.NumberFormat('en-UG').format(Math.round(n));
const fmtUGX = n => `UGX ${fmt(n)}`;

const MOCK_PL = {
  period: { start: '2025-06-01', end: '2025-06-30' },
  income: { total: 4550000, vs_previous: '+10.9', by_category: [
    { category: 'Rabbit Sales', total: 1850000 },
    { category: 'Pig Sales', total: 1200000 },
    { category: 'Poultry Sales', total: 680000 },
    { category: 'Crop Sales', total: 550000 },
    { category: 'Egg Sales', total: 270000 },
  ]},
  expenses: { total: 1950000, vs_previous: '+7.1', by_category: [
    { category: 'Feed', total: 680000 },
    { category: 'Payroll', total: 750000 },
    { category: 'Veterinary', total: 320000 },
    { category: 'Construction', total: 120000 },
    { category: 'Fuel & Transport', total: 80000 },
  ]},
  net_profit: 2600000,
  profit_margin: '57.1',
};

const MOCK_CASHFLOW = [
  { month: 'Jan', income: 2800000, expenses: 1400000, net: 1400000 },
  { month: 'Feb', income: 3100000, expenses: 1550000, net: 1550000 },
  { month: 'Mar', income: 2950000, expenses: 1480000, net: 1470000 },
  { month: 'Apr', income: 3700000, expenses: 1600000, net: 2100000 },
  { month: 'May', income: 4100000, expenses: 1820000, net: 2280000 },
  { month: 'Jun', income: 4550000, expenses: 1950000, net: 2600000 },
];

const MOCK_INCOME_TXN = [
  { id: '1', transaction_date: '2025-06-28', category_name: 'Rabbit Sales', description: 'Sold 12 rabbits to Kampala buyer', amount: 480000, payment_method: 'Mobile Money' },
  { id: '2', transaction_date: '2025-06-25', category_name: 'Pig Sales', description: 'Sold 2 finished pigs — 95kg each', amount: 1200000, payment_method: 'Cash' },
  { id: '3', transaction_date: '2025-06-22', category_name: 'Egg Sales', description: 'Weekly egg sales — 340 trays', amount: 270000, payment_method: 'Mobile Money' },
  { id: '4', transaction_date: '2025-06-18', category_name: 'Crop Sales', description: 'Matoke harvest — 80 bunches', amount: 320000, payment_method: 'Cash' },
];

const MOCK_EXPENSE_TXN = [
  { id: '1', transaction_date: '2025-06-26', category_name: 'Feed', description: '20 bags layer mash — Kihura Agro', amount: 680000, status: 'paid' },
  { id: '2', transaction_date: '2025-06-20', category_name: 'Veterinary', description: 'FMD vaccination 12 pigs — Dr. Kato', amount: 320000, status: 'paid' },
  { id: '3', transaction_date: '2025-06-30', category_name: 'Payroll', description: 'June payroll disbursement', amount: 750000, status: 'pending' },
];

const PIE_COLORS = [T.teal, T.blue, T.amber, '#7B5EA7', T.coral, T.emeraldMid];

export default function FinancePage() {
  const [tab, setTab] = useState('pl');
  const [pl] = useState(MOCK_PL);
  const [cashflow] = useState(MOCK_CASHFLOW);
  const [incomeTxn] = useState(MOCK_INCOME_TXN);
  const [expenseTxn] = useState(MOCK_EXPENSE_TXN);
  const [recordOpen, setRecordOpen] = useState(null); // 'income' | 'expense'
  const [alert, setAlert] = useState(null);
  const [form, setForm] = useState({ category_id: '', amount: '', description: '', transaction_date: new Date().toISOString().split('T')[0], payment_method: 'cash' });

  const incomeCategories = ['Rabbit Sales', 'Pig Sales', 'Poultry Sales', 'Dairy Sales', 'Crop Sales', 'Egg Sales', 'Milk Sales', 'Manure Sales', 'Other'];
  const expenseCategories = ['Feed', 'Veterinary', 'Payroll', 'Construction', 'Fuel & Transport', 'Seeds & Fertilizer', 'Equipment', 'Miscellaneous'];

  const handleRecord = async () => {
    if (!form.amount || !form.description || !form.category_id) return;
    try {
      await apiFetch(`/finance/${recordOpen}`, { method: 'POST', body: JSON.stringify({ ...form, amount: parseFloat(form.amount), currency: 'UGX' }) });
    } catch { /* demo */ }
    setAlert({ type: 'success', msg: `${recordOpen === 'income' ? 'Income' : 'Expense'} of ${fmtUGX(parseFloat(form.amount))} recorded.` });
    setRecordOpen(null);
    setForm({ category_id: '', amount: '', description: '', transaction_date: new Date().toISOString().split('T')[0], payment_method: 'cash' });
    setTimeout(() => setAlert(null), 4000);
  };

  const TABS = [
    { id: 'pl', label: '📊 P&L Report' },
    { id: 'cashflow', label: '📈 Cash Flow' },
    { id: 'transactions', label: '📋 Transactions' },
  ];

  return (
    <div style={{ fontFamily: T.fontBody }}>
      <SectionHeader
        title="Finance & Reports"
        sub="Live virtual ledger — June 2025"
        action={
          <div style={{ display: 'flex', gap: 10 }}>
            <Btn variant="secondary" size="sm" icon="💸" onClick={() => setRecordOpen('expense')}>Record Expense</Btn>
            <Btn variant="primary" size="sm" icon="💰" onClick={() => setRecordOpen('income')}>Record Income</Btn>
          </div>
        }
      />

      {alert && <div style={{ marginBottom: 16 }}><Alert type={alert.type} onDismiss={() => setAlert(null)}>{alert.msg}</Alert></div>}

      {/* Top KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        <div style={{ background: T.white, borderRadius: T.radius, border: `1px solid ${T.border}`, boxShadow: T.shadowSm, padding: '20px 24px' }}>
          <div style={{ fontSize: 13, color: T.textMuted, marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Total Revenue</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: T.teal, fontFamily: T.fontDisplay }}>{fmtUGX(pl.income.total)}</div>
          <div style={{ fontSize: 13, color: T.teal, marginTop: 4, fontWeight: 600 }}>▲ {pl.income.vs_previous}% vs last month</div>
        </div>
        <div style={{ background: T.white, borderRadius: T.radius, border: `1px solid ${T.border}`, boxShadow: T.shadowSm, padding: '20px 24px' }}>
          <div style={{ fontSize: 13, color: T.textMuted, marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Total Expenses</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: T.amber, fontFamily: T.fontDisplay }}>{fmtUGX(pl.expenses.total)}</div>
          <div style={{ fontSize: 13, color: T.amberDark, marginTop: 4, fontWeight: 600 }}>▲ {pl.expenses.vs_previous}% vs last month</div>
        </div>
        <div style={{ background: T.emerald, borderRadius: T.radius, boxShadow: T.shadowMd, padding: '20px 24px' }}>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Net Profit</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: T.white, fontFamily: T.fontDisplay }}>{fmtUGX(pl.net_profit)}</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 4, fontWeight: 600 }}>{pl.profit_margin}% profit margin</div>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 20, borderBottom: `1px solid ${T.border}` }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '10px 22px', border: 'none', background: 'transparent',
            color: tab === t.id ? T.emerald : T.textSecondary,
            fontWeight: tab === t.id ? 700 : 500, fontSize: 14, cursor: 'pointer',
            borderBottom: `2px solid ${tab === t.id ? T.emerald : 'transparent'}`,
            marginBottom: -1, fontFamily: T.fontBody,
          }}>{t.label}</button>
        ))}
      </div>

      {/* P&L Tab */}
      {tab === 'pl' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Income breakdown */}
          <div style={{ background: T.white, borderRadius: T.radius, border: `1px solid ${T.border}`, boxShadow: T.shadowSm, padding: 24 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 800, color: T.teal, fontFamily: T.fontDisplay }}>💚 Income Breakdown</h3>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={pl.income.by_category} dataKey="total" nameKey="category" cx="50%" cy="50%" outerRadius={70} paddingAngle={3}>
                  {pl.income.by_category.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={v => fmtUGX(v)} contentStyle={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: T.radiusSm }} />
              </PieChart>
            </ResponsiveContainer>
            {pl.income.by_category.map((c, i) => (
              <div key={c.category} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: i < pl.income.by_category.length - 1 ? `1px solid ${T.border}` : 'none' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: T.textSecondary }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: PIE_COLORS[i], display: 'inline-block' }} />
                  {c.category}
                </span>
                <span style={{ fontWeight: 700, fontSize: 13, color: T.textPrimary, fontFamily: T.fontMono }}>{fmtUGX(c.total)}</span>
              </div>
            ))}
          </div>

          {/* Expense breakdown */}
          <div style={{ background: T.white, borderRadius: T.radius, border: `1px solid ${T.border}`, boxShadow: T.shadowSm, padding: 24 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 800, color: T.amberDark, fontFamily: T.fontDisplay }}>🔴 Expense Breakdown</h3>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={pl.expenses.by_category} dataKey="total" nameKey="category" cx="50%" cy="50%" outerRadius={70} paddingAngle={3}>
                  {pl.expenses.by_category.map((_, i) => <Cell key={i} fill={[T.amber, T.coral, T.blue, '#7B5EA7', T.emeraldMid][i % 5]} />)}
                </Pie>
                <Tooltip formatter={v => fmtUGX(v)} contentStyle={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: T.radiusSm }} />
              </PieChart>
            </ResponsiveContainer>
            {pl.expenses.by_category.map((c, i) => (
              <div key={c.category} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: i < pl.expenses.by_category.length - 1 ? `1px solid ${T.border}` : 'none' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: T.textSecondary }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: [T.amber, T.coral, T.blue, '#7B5EA7', T.emeraldMid][i], display: 'inline-block' }} />
                  {c.category}
                </span>
                <span style={{ fontWeight: 700, fontSize: 13, color: T.textPrimary, fontFamily: T.fontMono }}>{fmtUGX(c.total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cash Flow Tab */}
      {tab === 'cashflow' && (
        <div style={{ background: T.white, borderRadius: T.radius, border: `1px solid ${T.border}`, boxShadow: T.shadowSm, padding: 24 }}>
          <h3 style={{ margin: '0 0 20px', fontSize: 17, fontWeight: 800, color: T.textPrimary, fontFamily: T.fontDisplay }}>6-Month Cash Flow</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={cashflow} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
              <XAxis dataKey="month" tick={{ fill: T.textMuted, fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: T.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000000).toFixed(1)}M`} />
              <Tooltip contentStyle={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: T.radiusSm }} formatter={v => fmtUGX(v)} />
              <Bar dataKey="income" fill={T.teal} radius={[6, 6, 0, 0]} name="Revenue" />
              <Bar dataKey="expenses" fill={T.amber} radius={[6, 6, 0, 0]} name="Expenses" />
            </BarChart>
          </ResponsiveContainer>
          <div style={{ marginTop: 24 }}>
            <ResponsiveContainer width="100%" height={120}>
              <LineChart data={cashflow}>
                <XAxis dataKey="month" tick={{ fill: T.textMuted, fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis hide tickFormatter={v => `${(v / 1000000).toFixed(1)}M`} />
                <Tooltip contentStyle={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: T.radiusSm }} formatter={v => fmtUGX(v)} />
                <Line type="monotone" dataKey="net" stroke={T.emerald} strokeWidth={3} dot={{ fill: T.emerald, r: 4 }} name="Net Profit" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Transactions Tab */}
      {tab === 'transactions' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div style={{ background: T.white, borderRadius: T.radius, border: `1px solid ${T.border}`, boxShadow: T.shadowSm, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', background: T.emeraldFaint, borderBottom: `1px solid ${T.border}` }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: T.teal }}>💚 Income</h3>
            </div>
            {incomeTxn.map((t, i) => (
              <div key={t.id} style={{ padding: '14px 18px', borderBottom: i < incomeTxn.length - 1 ? `1px solid ${T.border}` : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontSize: 12, color: T.teal, fontWeight: 700 }}>{t.category_name}</span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: T.teal, fontFamily: T.fontMono }}>+{fmtUGX(t.amount)}</span>
                </div>
                <div style={{ fontSize: 13, color: T.textSecondary }}>{t.description}</div>
                <div style={{ fontSize: 11, color: T.textMuted, marginTop: 3 }}>{t.transaction_date} · {t.payment_method}</div>
              </div>
            ))}
          </div>
          <div style={{ background: T.white, borderRadius: T.radius, border: `1px solid ${T.border}`, boxShadow: T.shadowSm, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', background: '#FFF5F5', borderBottom: `1px solid ${T.border}` }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: T.coralDark }}>🔴 Expenses</h3>
            </div>
            {expenseTxn.map((t, i) => (
              <div key={t.id} style={{ padding: '14px 18px', borderBottom: i < expenseTxn.length - 1 ? `1px solid ${T.border}` : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontSize: 12, color: T.coral, fontWeight: 700 }}>{t.category_name}</span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: T.coral, fontFamily: T.fontMono }}>-{fmtUGX(t.amount)}</span>
                </div>
                <div style={{ fontSize: 13, color: T.textSecondary }}>{t.description}</div>
                <div style={{ fontSize: 11, color: T.textMuted, marginTop: 3, display: 'flex', gap: 8 }}>
                  <span>{t.transaction_date}</span>
                  <Badge status={t.status === 'paid' ? 'approved' : 'pending'}>{t.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Record Income/Expense Drawer */}
      <Drawer open={!!recordOpen} onClose={() => setRecordOpen(null)} title={recordOpen === 'income' ? '💰 Record Income' : '💸 Record Expense'}>
        <Field label="Category" required>
          <Select value={form.category_id} onChange={e => setForm(p => ({ ...p, category_id: e.target.value }))}>
            <option value="">Select category…</option>
            {(recordOpen === 'income' ? incomeCategories : expenseCategories).map(c => <option key={c} value={c}>{c}</option>)}
          </Select>
        </Field>
        <Field label="Amount (UGX)" required>
          <Input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} placeholder="e.g. 500000" />
        </Field>
        {form.amount && <div style={{ padding: '8px 12px', background: T.emeraldFaint, borderRadius: T.radiusSm, marginBottom: 12, fontSize: 13, color: T.teal, fontWeight: 600 }}>≈ USD {(parseFloat(form.amount || 0) * 0.000265).toFixed(2)}</div>}
        <Field label="Description" required>
          <Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Describe this transaction…" />
        </Field>
        <Field label="Date">
          <Input type="date" value={form.transaction_date} onChange={e => setForm(p => ({ ...p, transaction_date: e.target.value }))} />
        </Field>
        <Field label="Payment Method">
          <Select value={form.payment_method} onChange={e => setForm(p => ({ ...p, payment_method: e.target.value }))}>
            <option value="cash">Cash</option>
            <option value="mobile_money">Mobile Money (MTN/Airtel)</option>
            <option value="bank_transfer">Bank Transfer</option>
            <option value="cheque">Cheque</option>
          </Select>
        </Field>
        <Btn variant={recordOpen === 'income' ? 'primary' : 'danger'} full onClick={handleRecord} disabled={!form.amount || !form.description || !form.category_id} icon="✓">
          Save {recordOpen === 'income' ? 'Income' : 'Expense'} Record
        </Btn>
      </Drawer>
    </div>
  );
}
