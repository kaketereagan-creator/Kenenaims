import { useState, useEffect } from 'react';
import { T } from '../../theme';
import { SectionHeader, Btn, Badge, Avatar, Drawer, Field, Input, Select, Alert, Spinner } from '../../components/UI';
import { apiFetch } from '../../context/AuthContext';
import { generatePayslip, downloadPayslip, sharePayslip } from '../../services/pdfPayslip';

const fmt = n => new Intl.NumberFormat('en-UG').format(Math.round(n));
const fmtUGX = n => `UGX ${fmt(n)}`;

const DEMO_EMPLOYEES = [
  { id: '1', employee_code: 'EMP-0001', full_name: 'Moses Byaruhanga', position: 'Livestock Attendant', department: 'Livestock', salary_type: 'daily', salary_rate: 15000, mobile_money_number: '+256700000001', mobile_money_provider: 'MTN MoMo', is_active: true },
  { id: '2', employee_code: 'EMP-0002', full_name: 'Grace Tumusiime', position: 'Field Worker', department: 'Crops', salary_type: 'daily', salary_rate: 12000, mobile_money_number: '+256700000002', mobile_money_provider: 'Airtel Money', is_active: true },
  { id: '3', employee_code: 'EMP-0003', full_name: 'John Mugisha', position: 'Driver / Transport', department: 'Operations', salary_type: 'monthly', salary_rate: 350000, mobile_money_number: '+256700000003', mobile_money_provider: 'MTN MoMo', is_active: true },
  { id: '4', employee_code: 'EMP-0004', full_name: 'Sarah Nakalema', position: 'Store Assistant', department: 'Inventory', salary_type: 'daily', salary_rate: 12000, mobile_money_number: '+256700000004', mobile_money_provider: 'MTN MoMo', is_active: true },
  { id: '5', employee_code: 'EMP-0005', full_name: 'Peter Kato', position: 'Security Guard', department: 'Security', salary_type: 'monthly', salary_rate: 280000, mobile_money_number: '+256700000005', mobile_money_provider: 'Airtel Money', is_active: true },
];

const DEMO_PAYROLL = [
  { employee_id: '1', base_pay: 360000, overtime_pay: 22500, bonus: 0, advance_deduction: 50000, other_deductions: 0, gross_pay: 382500, net_pay: 332500, days_worked: 24, overtime_hours: 3, payment_status: 'pending' },
  { employee_id: '2', base_pay: 288000, overtime_pay: 0, bonus: 20000, advance_deduction: 0, other_deductions: 0, gross_pay: 308000, net_pay: 308000, days_worked: 24, overtime_hours: 0, payment_status: 'pending' },
  { employee_id: '3', base_pay: 350000, overtime_pay: 0, bonus: 0, advance_deduction: 0, other_deductions: 0, gross_pay: 350000, net_pay: 350000, days_worked: null, overtime_hours: 0, payment_status: 'pending' },
  { employee_id: '4', base_pay: 276000, overtime_pay: 0, bonus: 0, advance_deduction: 30000, other_deductions: 0, gross_pay: 276000, net_pay: 246000, days_worked: 23, overtime_hours: 0, payment_status: 'pending' },
  { employee_id: '5', base_pay: 280000, overtime_pay: 0, bonus: 0, advance_deduction: 0, other_deductions: 0, gross_pay: 280000, net_pay: 280000, days_worked: null, overtime_hours: 0, payment_status: 'pending' },
];

const DEMO_PERIOD = { period_name: 'June 2025', start_date: '2025-06-01', end_date: '2025-06-30', payment_date: '2025-06-30', status: 'draft' };

export default function PayrollPage() {
  const [employees, setEmployees] = useState(DEMO_EMPLOYEES);
  const [payroll, setPayroll] = useState(DEMO_PAYROLL);
  const [period] = useState(DEMO_PERIOD);
  const [tab, setTab] = useState('payroll');
  const [generatingId, setGeneratingId] = useState(null);
  const [generatingAll, setGeneratingAll] = useState(false);
  const [alert, setAlert] = useState(null);
  const [addEmpOpen, setAddEmpOpen] = useState(false);
  const [newEmp, setNewEmp] = useState({ full_name: '', position: '', salary_type: 'daily', salary_rate: '', mobile_money_number: '', mobile_money_provider: 'MTN MoMo' });

  const totalNetPayroll = payroll.reduce((s, r) => s + r.net_pay, 0);
  const totalGross = payroll.reduce((s, r) => s + r.gross_pay, 0);
  const totalDeductions = payroll.reduce((s, r) => s + r.advance_deduction + r.other_deductions, 0);

  const handleDownloadSlip = async (employeeId) => {
    const emp = employees.find(e => e.id === employeeId);
    const rec = payroll.find(r => r.employee_id === employeeId);
    if (!emp || !rec) return;
    setGeneratingId(employeeId);
    try {
      const blob = await generatePayslip(emp, rec, period);
      const shared = await sharePayslip(blob, emp.full_name, period.period_name);
      if (!shared) setAlert({ type: 'success', msg: `Payslip downloaded for ${emp.full_name}` });
    } catch (err) {
      setAlert({ type: 'error', msg: `PDF generation failed: ${err.message}` });
    }
    setGeneratingId(null);
    setTimeout(() => setAlert(null), 4000);
  };

  const handleDownloadAll = async () => {
    setGeneratingAll(true);
    try {
      for (const emp of employees) {
        const rec = payroll.find(r => r.employee_id === emp.id);
        if (!rec) continue;
        const blob = await generatePayslip(emp, rec, period);
        downloadPayslip(blob, emp.full_name, period.period_name);
        await new Promise(r => setTimeout(r, 300)); // small delay between downloads
      }
      setAlert({ type: 'success', msg: `All ${employees.length} payslips downloaded.` });
    } catch (err) {
      setAlert({ type: 'error', msg: `Error: ${err.message}` });
    }
    setGeneratingAll(false);
    setTimeout(() => setAlert(null), 5000);
  };

  const handleAddEmployee = async () => {
    if (!newEmp.full_name || !newEmp.salary_rate) return;
    try {
      const res = await apiFetch('/payroll/employees', { method: 'POST', body: JSON.stringify(newEmp) });
      if (res.ok) { const d = await res.json(); setEmployees(p => [...p, d]); }
    } catch {
      const emp = { id: Date.now().toString(), employee_code: `EMP-${String(employees.length + 1).padStart(4, '0')}`, ...newEmp, salary_rate: parseFloat(newEmp.salary_rate), is_active: true };
      setEmployees(p => [...p, emp]);
    }
    setAddEmpOpen(false);
    setNewEmp({ full_name: '', position: '', salary_type: 'daily', salary_rate: '', mobile_money_number: '', mobile_money_provider: 'MTN MoMo' });
    setAlert({ type: 'success', msg: 'Employee added.' });
    setTimeout(() => setAlert(null), 3000);
  };

  const TABS = [
    { id: 'payroll', label: '💰 Payroll Run' },
    { id: 'employees', label: '👷 Employees' },
  ];

  return (
    <div style={{ fontFamily: T.fontBody }}>
      <SectionHeader
        title="Payroll Management"
        sub={`${period.period_name} · ${employees.length} employees`}
        action={
          <div style={{ display: 'flex', gap: 10 }}>
            <Btn variant="ghost" size="sm" icon="📄" onClick={handleDownloadAll} disabled={generatingAll}>
              {generatingAll ? 'Generating…' : 'Download All Payslips'}
            </Btn>
            <Btn variant="primary" size="sm" icon="+" onClick={() => setAddEmpOpen(true)}>Add Employee</Btn>
          </div>
        }
      />

      {alert && <div style={{ marginBottom: 16 }}><Alert type={alert.type} onDismiss={() => setAlert(null)}>{alert.msg}</Alert></div>}

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { icon: '💰', label: 'Total Gross', value: fmtUGX(totalGross), color: T.teal },
          { icon: '➖', label: 'Deductions', value: fmtUGX(totalDeductions), color: T.coral },
          { icon: '💵', label: 'Net Payroll', value: fmtUGX(totalNetPayroll), color: T.emerald },
          { icon: '👷', label: 'Employees', value: employees.length, color: T.blue },
        ].map(s => (
          <div key={s.label} style={{ background: T.white, borderRadius: T.radius, border: `1px solid ${T.border}`, boxShadow: T.shadowSm, padding: '18px 20px' }}>
            <div style={{ fontSize: 26, marginBottom: 8 }}>{s.icon}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: s.color, fontFamily: T.fontDisplay, fontVariantNumeric: 'tabular-nums' }}>{s.value}</div>
            <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 3 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 20, borderBottom: `1px solid ${T.border}` }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '10px 20px', border: 'none', background: 'transparent',
            color: tab === t.id ? T.emerald : T.textSecondary,
            fontWeight: tab === t.id ? 700 : 500, fontSize: 14, cursor: 'pointer',
            borderBottom: `2px solid ${tab === t.id ? T.emerald : 'transparent'}`,
            marginBottom: -1, transition: 'all 0.15s', fontFamily: T.fontBody,
          }}>{t.label}</button>
        ))}
      </div>

      {tab === 'payroll' && (
        <div style={{ background: T.white, borderRadius: T.radius, border: `1px solid ${T.border}`, boxShadow: T.shadowSm, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', background: T.bgLight, borderBottom: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontWeight: 700, fontSize: 14, color: T.textPrimary }}>{period.period_name} Payroll</span>
              <span style={{ fontSize: 12, color: T.textMuted, marginLeft: 10 }}>{period.start_date} → {period.end_date}</span>
            </div>
            <Badge bg={T.amberLight} color={T.amberDark}>Draft</Badge>
          </div>

          {employees.map((emp, i) => {
            const rec = payroll.find(r => r.employee_id === emp.id);
            if (!rec) return null;
            return (
              <div key={emp.id} style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px',
                borderBottom: i < employees.length - 1 ? `1px solid ${T.border}` : 'none',
                background: i % 2 === 0 ? T.white : T.bgLight + '80',
              }}>
                <Avatar name={emp.full_name} size={44} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: T.textPrimary, marginBottom: 2 }}>{emp.full_name}</div>
                  <div style={{ fontSize: 12, color: T.textMuted }}>
                    {emp.position} ·{' '}
                    {emp.salary_type === 'daily' ? `${rec.days_worked || 0} days × ${fmtUGX(emp.salary_rate)}` : `Monthly: ${fmtUGX(emp.salary_rate)}`}
                    {rec.overtime_hours > 0 && ` + ${rec.overtime_hours}h OT`}
                  </div>
                </div>

                <div style={{ textAlign: 'center', minWidth: 90 }}>
                  <div style={{ fontSize: 13, color: T.textMuted, marginBottom: 2 }}>Gross</div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: T.textPrimary, fontFamily: T.fontMono }}>{fmtUGX(rec.gross_pay)}</div>
                </div>

                {(rec.advance_deduction > 0 || rec.other_deductions > 0) && (
                  <div style={{ textAlign: 'center', minWidth: 80 }}>
                    <div style={{ fontSize: 13, color: T.textMuted, marginBottom: 2 }}>Deduct.</div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: T.coral, fontFamily: T.fontMono }}>-{fmtUGX(rec.advance_deduction + rec.other_deductions)}</div>
                  </div>
                )}

                <div style={{ textAlign: 'center', minWidth: 110 }}>
                  <div style={{ fontSize: 13, color: T.textMuted, marginBottom: 2 }}>Net Pay</div>
                  <div style={{ fontWeight: 800, fontSize: 16, color: T.teal, fontFamily: T.fontDisplay }}>{fmtUGX(rec.net_pay)}</div>
                </div>

                <Btn variant="secondary" size="sm" icon="📄"
                  disabled={generatingId === emp.id}
                  onClick={() => handleDownloadSlip(emp.id)}>
                  {generatingId === emp.id ? '…' : 'Payslip'}
                </Btn>
              </div>
            );
          })}

          {/* Total row */}
          <div style={{ padding: '16px 20px', background: T.emerald, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ color: 'rgba(255,255,255,0.8)', fontWeight: 700 }}>TOTAL NET PAYROLL</span>
            <span style={{ color: T.white, fontWeight: 900, fontSize: 20, fontFamily: T.fontDisplay }}>{fmtUGX(totalNetPayroll)}</span>
          </div>
        </div>
      )}

      {tab === 'employees' && (
        <div style={{ background: T.white, borderRadius: T.radius, border: `1px solid ${T.border}`, boxShadow: T.shadowSm, overflow: 'hidden' }}>
          {employees.map((emp, i) => (
            <div key={emp.id} style={{
              display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px',
              borderBottom: i < employees.length - 1 ? `1px solid ${T.border}` : 'none',
            }}>
              <Avatar name={emp.full_name} size={46} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: T.textPrimary, marginBottom: 3 }}>{emp.full_name}</div>
                <div style={{ fontSize: 12, color: T.textSecondary }}>{emp.position} · {emp.department}</div>
                <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>{emp.mobile_money_provider} — {emp.mobile_money_number}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <Badge bg={T.emeraldPale} color={T.teal}>{emp.salary_type}</Badge>
                <div style={{ fontWeight: 800, fontSize: 15, color: T.textPrimary, marginTop: 6, fontFamily: T.fontMono }}>
                  {fmtUGX(emp.salary_rate)}{emp.salary_type === 'daily' ? '/day' : '/mo'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Employee Drawer */}
      <Drawer open={addEmpOpen} onClose={() => setAddEmpOpen(false)} title="Add Employee">
        <Field label="Full Name" required><Input value={newEmp.full_name} onChange={e => setNewEmp(p => ({ ...p, full_name: e.target.value }))} placeholder="e.g. James Mukasa" /></Field>
        <Field label="Position"><Input value={newEmp.position} onChange={e => setNewEmp(p => ({ ...p, position: e.target.value }))} placeholder="e.g. Livestock Attendant" /></Field>
        <Field label="Pay Type" required>
          <Select value={newEmp.salary_type} onChange={e => setNewEmp(p => ({ ...p, salary_type: e.target.value }))}>
            <option value="daily">Daily Rate</option>
            <option value="weekly">Weekly Rate</option>
            <option value="monthly">Monthly Salary</option>
          </Select>
        </Field>
        <Field label={`Rate (UGX/${newEmp.salary_type === 'monthly' ? 'month' : 'day'})`} required>
          <Input type="number" value={newEmp.salary_rate} onChange={e => setNewEmp(p => ({ ...p, salary_rate: e.target.value }))} placeholder={newEmp.salary_type === 'monthly' ? '350000' : '15000'} />
        </Field>
        <Field label="Mobile Money Number">
          <Input value={newEmp.mobile_money_number} onChange={e => setNewEmp(p => ({ ...p, mobile_money_number: e.target.value }))} placeholder="+256700000000" />
        </Field>
        <Field label="Mobile Money Provider">
          <Select value={newEmp.mobile_money_provider} onChange={e => setNewEmp(p => ({ ...p, mobile_money_provider: e.target.value }))}>
            <option value="MTN MoMo">MTN MoMo</option>
            <option value="Airtel Money">Airtel Money</option>
            <option value="Bank Transfer">Bank Transfer</option>
          </Select>
        </Field>
        <Btn variant="primary" full onClick={handleAddEmployee} icon="✓">Add Employee</Btn>
      </Drawer>
    </div>
  );
}
