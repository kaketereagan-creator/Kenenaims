import { useState } from 'react';
import { T } from '../../theme';
import { SectionHeader, Btn, Badge, Alert, Spinner } from '../../components/UI';
import { apiFetch } from '../../context/AuthContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';

const fmt = n => new Intl.NumberFormat('en-UG').format(Math.round(n));
const fmtUGX = n => `UGX ${fmt(n)}`;

const MOCK_ENTERPRISE = [
  { enterprise: 'Rabbit Sales', revenue: 1850000, color: '#40916C' },
  { enterprise: 'Pig Sales', revenue: 1200000, color: '#7B5EA7' },
  { enterprise: 'Poultry Sales', revenue: 680000, color: '#FFB703' },
  { enterprise: 'Crop Sales', revenue: 550000, color: '#2196F3' },
  { enterprise: 'Egg Sales', revenue: 270000, color: '#E07B39' },
];

const MOCK_MONTHLY = [
  { month: 'Jan', income: 2800000, expenses: 1400000, net: 1400000 },
  { month: 'Feb', income: 3100000, expenses: 1550000, net: 1550000 },
  { month: 'Mar', income: 2950000, expenses: 1480000, net: 1470000 },
  { month: 'Apr', income: 3700000, expenses: 1600000, net: 2100000 },
  { month: 'May', income: 4100000, expenses: 1820000, net: 2280000 },
  { month: 'Jun', income: 4550000, expenses: 1950000, net: 2600000 },
];

const MOCK_LIVESTOCK_REPORT = [
  { species: 'Rabbits', total: 48, born_this_month: 14, deaths_this_month: 1, sold_this_month: 12, healthy: 44, sick: 2, quarantined: 2 },
  { species: 'Pigs', total: 12, born_this_month: 0, deaths_this_month: 0, sold_this_month: 2, healthy: 12, sick: 0, quarantined: 0 },
  { species: 'Poultry', total: 156, born_this_month: 0, deaths_this_month: 3, sold_this_month: 20, healthy: 153, sick: 3, quarantined: 0 },
  { species: 'Cattle', total: 8, born_this_month: 0, deaths_this_month: 0, sold_this_month: 0, healthy: 8, sick: 0, quarantined: 0 },
];

async function exportReportPDF(title, data) {
  try {
    const { default: jsPDF } = await import('jspdf');
    await import('jspdf-autotable');
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();

    // Header
    doc.setFillColor(27, 67, 50);
    doc.rect(0, 0, pageW, 38, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    doc.text('🌿 Kenena Farm', 20, 16);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(title, 20, 25);
    doc.setFontSize(9);
    doc.setTextColor(180, 220, 190);
    doc.text(`Generated: ${new Date().toLocaleDateString('en-UG', { day: 'numeric', month: 'long', year: 'numeric' })}`, pageW - 20, 25, { align: 'right' });

    // Table
    if (Array.isArray(data) && data.length > 0) {
      const headers = Object.keys(data[0]);
      const rows = data.map(row => headers.map(h => {
        const v = row[h];
        return typeof v === 'number' && h.toLowerCase().includes('amount') || h.toLowerCase().includes('revenue') || h.toLowerCase().includes('income') || h.toLowerCase().includes('expense') || h.toLowerCase().includes('net')
          ? fmtUGX(v) : String(v ?? '—');
      }));
      doc.autoTable({
        startY: 48,
        head: [headers.map(h => h.replace(/_/g, ' ').toUpperCase())],
        body: rows,
        margin: { left: 20, right: 20 },
        headStyles: { fillColor: [27, 67, 50], textColor: [255, 255, 255], fontSize: 9, fontStyle: 'bold' },
        bodyStyles: { fontSize: 9, textColor: [13, 31, 23] },
        alternateRowStyles: { fillColor: [240, 250, 243] },
        theme: 'grid',
      });
    }

    // Footer
    const pageH = doc.internal.pageSize.getHeight();
    doc.setFillColor(27, 67, 50);
    doc.rect(0, pageH - 12, pageW, 12, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(180, 220, 190);
    doc.text('Kenena Farm Management System · Kihura Sub-county, Uganda', pageW / 2, pageH - 5, { align: 'center' });

    doc.save(`${title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
    return true;
  } catch (err) {
    console.error('PDF export failed:', err);
    return false;
  }
}

function ReportCard({ icon, title, description, onGenerate, loading }) {
  return (
    <div style={{ background: T.white, borderRadius: T.radius, border: `1px solid ${T.border}`, boxShadow: T.shadowSm, padding: '20px 22px', display: 'flex', gap: 16, alignItems: 'flex-start' }}>
      <div style={{ fontSize: 32, flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: T.textPrimary, marginBottom: 4, fontFamily: T.fontDisplay }}>{title}</div>
        <div style={{ fontSize: 13, color: T.textSecondary, marginBottom: 14, lineHeight: 1.5 }}>{description}</div>
        <Btn variant="secondary" size="sm" icon="📥" onClick={onGenerate} disabled={loading}>
          {loading ? 'Generating…' : 'Export PDF'}
        </Btn>
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [loadingReport, setLoadingReport] = useState(null);
  const [alert, setAlert] = useState(null);

  const handleExport = async (reportKey, title, data) => {
    setLoadingReport(reportKey);
    const success = await exportReportPDF(title, data);
    setLoadingReport(null);
    setAlert({ type: success ? 'success' : 'error', msg: success ? `${title} exported successfully.` : 'PDF export failed. Check browser permissions.' });
    setTimeout(() => setAlert(null), 4000);
  };

  const totalRevenue = MOCK_MONTHLY.reduce((s, m) => s + m.income, 0);
  const totalExpenses = MOCK_MONTHLY.reduce((s, m) => s + m.expenses, 0);
  const totalAnimals = MOCK_LIVESTOCK_REPORT.reduce((s, r) => s + r.total, 0);
  const topEnterprise = MOCK_ENTERPRISE.sort((a, b) => b.revenue - a.revenue)[0];

  const TABS = [
    { id: 'overview', label: '📊 Overview' },
    { id: 'financial', label: '💰 Financial' },
    { id: 'livestock', label: '🐾 Livestock' },
    { id: 'export', label: '📥 Export' },
  ];

  return (
    <div style={{ fontFamily: T.fontBody }}>
      <SectionHeader title="Reports & Analytics" sub="Year-to-date farm performance" />

      {alert && <div style={{ marginBottom: 16 }}><Alert type={alert.type} onDismiss={() => setAlert(null)}>{alert.msg}</Alert></div>}

      {/* KPI Summary Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { icon: '📈', label: 'YTD Revenue', value: fmtUGX(totalRevenue), color: T.teal },
          { icon: '📉', label: 'YTD Expenses', value: fmtUGX(totalExpenses), color: T.amber },
          { icon: '💵', label: 'YTD Net Profit', value: fmtUGX(totalRevenue - totalExpenses), color: T.emerald },
          { icon: '🏆', label: 'Top Enterprise', value: topEnterprise.enterprise, color: '#7B5EA7' },
        ].map(s => (
          <div key={s.label} style={{ background: T.white, borderRadius: T.radius, border: `1px solid ${T.border}`, boxShadow: T.shadowSm, padding: '18px 20px' }}>
            <div style={{ fontSize: 26, marginBottom: 8 }}>{s.icon}</div>
            <div style={{ fontSize: s.label === 'Top Enterprise' ? 14 : 18, fontWeight: 800, color: s.color, fontFamily: T.fontDisplay }}>{s.value}</div>
            <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 3 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 20, borderBottom: `1px solid ${T.border}` }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            padding: '10px 20px', border: 'none', background: 'transparent',
            color: activeTab === t.id ? T.emerald : T.textSecondary,
            fontWeight: activeTab === t.id ? 700 : 500, fontSize: 14,
            cursor: 'pointer', borderBottom: `2px solid ${activeTab === t.id ? T.emerald : 'transparent'}`,
            marginBottom: -1, fontFamily: T.fontBody,
          }}>{t.label}</button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 20 }}>
          <div style={{ background: T.white, borderRadius: T.radius, border: `1px solid ${T.border}`, boxShadow: T.shadowSm, padding: 24 }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 800, color: T.textPrimary, fontFamily: T.fontDisplay }}>6-Month Revenue vs Expenses</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={MOCK_MONTHLY} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
                <XAxis dataKey="month" tick={{ fill: T.textMuted, fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: T.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000000).toFixed(1)}M`} />
                <Tooltip contentStyle={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: T.radiusSm }} formatter={v => fmtUGX(v)} />
                <Bar dataKey="income" fill={T.teal} radius={[5, 5, 0, 0]} name="Revenue" />
                <Bar dataKey="expenses" fill={T.amber} radius={[5, 5, 0, 0]} name="Expenses" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ background: T.white, borderRadius: T.radius, border: `1px solid ${T.border}`, boxShadow: T.shadowSm, padding: 24 }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 800, color: T.textPrimary, fontFamily: T.fontDisplay }}>Enterprise Revenue</h3>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={MOCK_ENTERPRISE} dataKey="revenue" nameKey="enterprise" cx="50%" cy="50%" outerRadius={75} paddingAngle={3}>
                  {MOCK_ENTERPRISE.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip formatter={v => fmtUGX(v)} contentStyle={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: T.radiusSm }} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
              {MOCK_ENTERPRISE.map(e => (
                <div key={e.enterprise} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: T.textSecondary }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: e.color, display: 'inline-block' }} />{e.enterprise}
                  </span>
                  <span style={{ fontWeight: 700, color: T.textPrimary, fontFamily: T.fontMono }}>{fmtUGX(e.revenue)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Financial Tab */}
      {activeTab === 'financial' && (
        <div>
          <div style={{ background: T.white, borderRadius: T.radius, border: `1px solid ${T.border}`, boxShadow: T.shadowSm, padding: 24, marginBottom: 20 }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 800, color: T.textPrimary, fontFamily: T.fontDisplay }}>Net Profit Trend</h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={MOCK_MONTHLY}>
                <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
                <XAxis dataKey="month" tick={{ fill: T.textMuted, fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: T.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000000).toFixed(1)}M`} />
                <Tooltip contentStyle={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: T.radiusSm }} formatter={v => fmtUGX(v)} />
                <Line type="monotone" dataKey="net" stroke={T.emerald} strokeWidth={3} dot={{ fill: T.emerald, r: 5 }} name="Net Profit" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div style={{ background: T.white, borderRadius: T.radius, border: `1px solid ${T.border}`, boxShadow: T.shadowSm, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', background: T.bgLight, borderBottom: `1px solid ${T.border}` }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>Monthly Summary</h3>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: T.emerald }}>
                  {['Month', 'Revenue', 'Expenses', 'Net Profit', 'Margin'].map(h => (
                    <th key={h} style={{ padding: '11px 18px', textAlign: 'left', color: T.white, fontSize: 12, fontWeight: 700, letterSpacing: 0.4 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MOCK_MONTHLY.map((row, i) => {
                  const margin = ((row.net / row.income) * 100).toFixed(1);
                  return (
                    <tr key={row.month} style={{ background: i % 2 === 0 ? T.white : T.bgLight }}>
                      <td style={{ padding: '12px 18px', fontWeight: 700, color: T.textPrimary }}>{row.month}</td>
                      <td style={{ padding: '12px 18px', color: T.teal, fontWeight: 700, fontFamily: T.fontMono }}>{fmtUGX(row.income)}</td>
                      <td style={{ padding: '12px 18px', color: T.amberDark, fontFamily: T.fontMono }}>{fmtUGX(row.expenses)}</td>
                      <td style={{ padding: '12px 18px', color: T.emerald, fontWeight: 800, fontFamily: T.fontMono }}>{fmtUGX(row.net)}</td>
                      <td style={{ padding: '12px 18px' }}>
                        <span style={{ background: T.emeraldPale, color: T.teal, borderRadius: T.radiusFull, padding: '3px 10px', fontSize: 12, fontWeight: 700 }}>{margin}%</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Livestock Tab */}
      {activeTab === 'livestock' && (
        <div style={{ background: T.white, borderRadius: T.radius, border: `1px solid ${T.border}`, boxShadow: T.shadowSm, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', background: T.bgLight, borderBottom: `1px solid ${T.border}` }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>Livestock Report — June 2025</h3>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: T.emerald }}>
                {['Species', 'Total', 'Births', 'Deaths', 'Sold', 'Healthy', 'Sick/Quarantined'].map(h => (
                  <th key={h} style={{ padding: '11px 16px', textAlign: 'left', color: T.white, fontSize: 12, fontWeight: 700 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MOCK_LIVESTOCK_REPORT.map((row, i) => (
                <tr key={row.species} style={{ background: i % 2 === 0 ? T.white : T.bgLight }}>
                  <td style={{ padding: '14px 16px', fontWeight: 700, color: T.textPrimary }}>{row.species}</td>
                  <td style={{ padding: '14px 16px', fontWeight: 800, fontSize: 16, color: T.emerald, fontFamily: T.fontDisplay }}>{row.total}</td>
                  <td style={{ padding: '14px 16px' }}><span style={{ color: T.teal, fontWeight: 700 }}>+{row.born_this_month}</span></td>
                  <td style={{ padding: '14px 16px' }}><span style={{ color: row.deaths_this_month > 0 ? T.coral : T.textMuted, fontWeight: 700 }}>{row.deaths_this_month > 0 ? `−${row.deaths_this_month}` : '0'}</span></td>
                  <td style={{ padding: '14px 16px', color: T.blue, fontWeight: 700 }}>{row.sold_this_month}</td>
                  <td style={{ padding: '14px 16px' }}><span style={{ color: T.teal, fontWeight: 600 }}>{row.healthy}</span></td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{ color: (row.sick + row.quarantined) > 0 ? T.coral : T.textMuted, fontWeight: 700 }}>
                      {row.sick + row.quarantined}
                    </span>
                  </td>
                </tr>
              ))}
              <tr style={{ background: T.emeraldFaint, borderTop: `2px solid ${T.emeraldLight}` }}>
                <td style={{ padding: '14px 16px', fontWeight: 800, color: T.emerald }}>TOTAL</td>
                <td style={{ padding: '14px 16px', fontWeight: 900, fontSize: 18, color: T.emerald, fontFamily: T.fontDisplay }}>{totalAnimals}</td>
                <td style={{ padding: '14px 16px', fontWeight: 700, color: T.teal }}>+{MOCK_LIVESTOCK_REPORT.reduce((s, r) => s + r.born_this_month, 0)}</td>
                <td style={{ padding: '14px 16px', fontWeight: 700, color: T.coral }}>−{MOCK_LIVESTOCK_REPORT.reduce((s, r) => s + r.deaths_this_month, 0)}</td>
                <td style={{ padding: '14px 16px', fontWeight: 700, color: T.blue }}>{MOCK_LIVESTOCK_REPORT.reduce((s, r) => s + r.sold_this_month, 0)}</td>
                <td colSpan={2} />
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Export Tab */}
      {activeTab === 'export' && (
        <div>
          <p style={{ color: T.textSecondary, fontSize: 14, marginBottom: 20 }}>
            Export any report as a professional PDF document. Files download directly to your device.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
            <ReportCard icon="📊" title="Monthly P&L Report" description="Income, expenses, and net profit breakdown by category for the current month." onGenerate={() => handleExport('pl', 'Monthly Profit & Loss Report', MOCK_MONTHLY)} loading={loadingReport === 'pl'} />
            <ReportCard icon="🐾" title="Livestock Summary" description="All animals by species — births, deaths, sales, and health status this month." onGenerate={() => handleExport('livestock', 'Livestock Summary Report', MOCK_LIVESTOCK_REPORT)} loading={loadingReport === 'livestock'} />
            <ReportCard icon="🏆" title="Enterprise Profitability" description="Revenue comparison across all farm enterprises — rabbits, pigs, poultry, crops." onGenerate={() => handleExport('enterprise', 'Enterprise Profitability Report', MOCK_ENTERPRISE)} loading={loadingReport === 'enterprise'} />
            <ReportCard icon="📈" title="6-Month Cash Flow" description="Monthly revenue, expenses, and net profit trend for the last 6 months." onGenerate={() => handleExport('cashflow', '6-Month Cash Flow Report', MOCK_MONTHLY)} loading={loadingReport === 'cashflow'} />
            <ReportCard icon="👷" title="Payroll Summary" description="All employee earnings, deductions, and net pay for the current payroll period." onGenerate={() => handleExport('payroll', 'Payroll Summary Report', [{ employee: 'Moses Byaruhanga', gross: 382500, deductions: 50000, net: 332500 }, { employee: 'Grace Tumusiime', gross: 308000, deductions: 0, net: 308000 }])} loading={loadingReport === 'payroll'} />
            <ReportCard icon="📦" title="Inventory Status" description="Current stock levels, low stock items, and estimated total inventory value." onGenerate={() => handleExport('inventory', 'Inventory Status Report', [{ item: 'Layer Mash', stock: 8, unit: 'bags', reorder: 10, status: 'Low' }, { item: 'RHD Vaccine', stock: 4, unit: 'vials', reorder: 10, status: 'Low' }])} loading={loadingReport === 'inventory'} />
          </div>
        </div>
      )}
    </div>
  );
}
