import { useState, useEffect, useRef } from 'react';
import { T } from '../../theme';
import { Btn, Badge, Avatar, Alert, Field, Input, Select, Spinner } from '../../components/UI';
import { smartFetch, getPendingCount, runSync } from '../../services/offlineSync';
import { useAuth } from '../../context/AuthContext';

const fmt = n => new Intl.NumberFormat('en-UG').format(Math.round(n));
const fmtUGX = n => `UGX ${fmt(n)}`;

// ── MOCK DATA ─────────────────────────────────────────────────────────────────
const MOCK_TASKS = [
  { id: 1, title: 'Vaccinate Rabbit Litter B4', description: 'Apply RHD vaccine to 8 kits in Pen B4. Check weights first.', category: 'health', due_date: new Date().toISOString(), priority: 'urgent', assigned_to: 'Moses B', status: 'pending' },
  { id: 2, title: 'Feed Pigs — Morning Round', description: 'Pen 1-3: 2kg sow meal each. Record consumption in logbook.', category: 'feeding', due_date: new Date().toISOString(), priority: 'high', assigned_to: 'Grace T', status: 'pending' },
  { id: 3, title: 'Matoke Plot A — Fertilizer', description: 'Apply NPK fertilizer to Plot A (1.5 acres). Use 25kg bag from store.', category: 'crops', due_date: new Date(Date.now() + 86400000).toISOString(), priority: 'medium', assigned_to: 'John M', status: 'pending' },
  { id: 4, title: 'Weigh Broiler Batch 3', description: 'Random sample 10 birds from House 2, record weights in system.', category: 'livestock', due_date: new Date(Date.now() + 86400000).toISOString(), priority: 'medium', assigned_to: 'Moses B', status: 'pending' },
  { id: 5, title: 'Clean Pig Pens 1 & 2', description: 'Full disinfection. Use Farmer Graz at 1:20 dilution. Allow 2hr dry time.', category: 'maintenance', due_date: new Date(Date.now() - 86400000).toISOString(), priority: 'high', assigned_to: 'Grace T', status: 'overdue' },
];

const MOCK_EMPLOYEES = [
  { id: '1', employee_code: 'EMP-0001', full_name: 'Moses Byaruhanga', position: 'Livestock Attendant', salary_type: 'daily', salary_rate: 15000 },
  { id: '2', employee_code: 'EMP-0002', full_name: 'Grace Tumusiime', position: 'Field Worker', salary_type: 'daily', salary_rate: 12000 },
  { id: '3', employee_code: 'EMP-0003', full_name: 'John Mugisha', position: 'Driver', salary_type: 'monthly', salary_rate: 350000 },
  { id: '4', employee_code: 'EMP-0004', full_name: 'Sarah Nakalema', position: 'Store Assistant', salary_type: 'daily', salary_rate: 12000 },
  { id: '5', employee_code: 'EMP-0005', full_name: 'Peter Kato', position: 'Security', salary_type: 'monthly', salary_rate: 280000 },
];

// ── CONNECTIVITY BADGE ────────────────────────────────────────────────────────
function ConnectivityBadge({ pendingOps }) {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: T.radiusFull, background: online ? T.emeraldPale : T.amberLight, border: `1px solid ${online ? T.emeraldLight : T.amber}` }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: online ? T.emeraldLight : T.amber, animation: !online ? 'pulse 1.5s infinite' : 'none' }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: online ? T.teal : T.amberDark }}>{online ? 'Online' : 'Offline'}</span>
      </div>
      {pendingOps > 0 && (
        <div style={{ padding: '6px 10px', borderRadius: T.radiusFull, background: T.amberLight, border: `1px solid ${T.amber}`, fontSize: 12, fontWeight: 700, color: T.amberDark }}>
          {pendingOps} pending sync
        </div>
      )}
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
    </div>
  );
}

// ── TASK CARD ─────────────────────────────────────────────────────────────────
function TaskCard({ task, onComplete }) {
  const [completing, setCompleting] = useState(false);
  const isOverdue = new Date(task.due_date) < new Date() && task.status !== 'completed';
  const isToday = new Date(task.due_date).toDateString() === new Date().toDateString();

  const catColors = { health: T.coral, feeding: T.teal, crops: T.emeraldMid, livestock: T.blue, maintenance: '#7B5EA7' };
  const catIcons  = { health: '💉', feeding: '🌾', crops: '🌱', livestock: '🐾', maintenance: '🔧' };
  const priorityColors = { urgent: T.coral, high: T.amber, medium: T.blue, low: T.textMuted };

  const handleComplete = async () => {
    setCompleting(true);
    await smartFetch(`/tasks/${task.id}/complete`, { method: 'PATCH', body: JSON.stringify({ completed_at: new Date().toISOString() }) }, { type: 'task_complete', label: task.title });
    onComplete(task.id);
    setCompleting(false);
  };

  return (
    <div style={{
      background: T.white, borderRadius: T.radius,
      border: `1px solid ${isOverdue ? T.coral + '44' : T.border}`,
      boxShadow: T.shadowSm, overflow: 'hidden',
      borderLeft: `4px solid ${catColors[task.category] || T.emeraldMid}`,
    }}>
      <div style={{ padding: '16px 18px' }}>
        {/* Top row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
          <div style={{ display: 'flex', align: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 18 }}>{catIcons[task.category]}</span>
            {isOverdue && <Badge bg={T.coralLight} color={T.coral}>⚠ OVERDUE</Badge>}
            {isToday && !isOverdue && <Badge bg={T.amberLight} color={T.amberDark}>📅 Due Today</Badge>}
            <Badge bg={priorityColors[task.priority] + '22'} color={priorityColors[task.priority]}>{task.priority}</Badge>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <Avatar name={task.assigned_to} size={28} />
            <span style={{ fontSize: 12, color: T.textMuted }}>{task.assigned_to}</span>
          </div>
        </div>

        <h3 style={{ fontSize: 15, fontWeight: 700, color: T.textPrimary, margin: '0 0 6px', fontFamily: T.fontDisplay }}>{task.title}</h3>
        <p style={{ fontSize: 13, color: T.textSecondary, margin: '0 0 14px', lineHeight: 1.5 }}>{task.description}</p>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, color: T.textMuted }}>
            📅 {new Date(task.due_date).toLocaleDateString('en-UG', { day: 'numeric', month: 'short' })}
          </span>
          <Btn variant="primary" size="sm" disabled={completing} onClick={handleComplete} icon="✓">
            {completing ? 'Saving…' : 'Mark Done'}
          </Btn>
        </div>
      </div>
    </div>
  );
}

// ── EXPENSE REQUEST DRAWER ────────────────────────────────────────────────────
function ExpenseDrawer({ open, onClose, onSubmitted }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ category: '', description: '', amount: '', payee: '', urgency: 'medium', notes: '' });
  const [loading, setLoading] = useState(false);

  const categories = ['Feed', 'Veterinary', 'Construction', 'Fuel & Transport', 'Seeds & Fertilizer', 'Equipment Repair', 'Miscellaneous'];

  const handleSubmit = async () => {
    if (!form.category || !form.description || !form.amount) return;
    setLoading(true);
    const res = await smartFetch('/wallet/request-expense', {
      method: 'POST',
      body: JSON.stringify({ purpose: form.description, amount: parseFloat(form.amount), currency: 'UGX', expense_category: form.category, payee_name: form.payee, notes: form.notes }),
    }, { type: 'expense_request', label: form.description });
    setLoading(false);
    onSubmitted({ ...form, offline: res.offline });
    onClose();
    setForm({ category: '', description: '', amount: '', payee: '', urgency: 'medium', notes: '' });
    setStep(1);
  };

  if (!open) return null;

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200, backdropFilter: 'blur(2px)' }} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 201,
        background: T.white, borderRadius: '20px 20px 0 0',
        boxShadow: '0 -8px 40px rgba(27,67,50,0.2)',
        animation: 'slideUp 0.28s cubic-bezier(0.4,0,0.2,1)',
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12 }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: T.border }} />
        </div>

        {/* Header */}
        <div style={{ padding: '16px 20px 12px', borderBottom: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: T.emerald, fontFamily: T.fontDisplay }}>💸 Request Funds</h3>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: T.textMuted }}>Step {step} of 2 — Goes to Super Admin queue</p>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <div style={{ width: 24, height: 4, borderRadius: 2, background: step >= 1 ? T.emerald : T.border }} />
            <div style={{ width: 24, height: 4, borderRadius: 2, background: step >= 2 ? T.emerald : T.border }} />
          </div>
        </div>

        <div style={{ padding: '20px' }}>
          {step === 1 && (
            <>
              <Field label="Expense Category" required>
                <Select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
                  <option value="">Select category…</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </Select>
              </Field>
              <Field label="What is the money for?" required hint="Be specific — Admin reviews this before approving">
                <textarea
                  value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="e.g. 20 bags layer mash from Kihura Agro Suppliers for 300 broilers…"
                  rows={3}
                  style={{ width: '100%', padding: '12px 14px', border: `1.5px solid ${T.border}`, borderRadius: T.radiusSm, fontSize: 15, color: T.textPrimary, fontFamily: T.fontBody, resize: 'none', outline: 'none', boxSizing: 'border-box' }}
                  onFocus={e => e.target.style.borderColor = T.emerald}
                  onBlur={e => e.target.style.borderColor = T.border}
                />
              </Field>
              <Field label="Amount (UGX)" required>
                <Input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} placeholder="e.g. 680000" />
              </Field>
              {form.amount && (
                <div style={{ padding: '10px 14px', background: T.emeraldFaint, borderRadius: T.radiusSm, marginTop: -8, marginBottom: 16, fontSize: 13 }}>
                  <span style={{ color: T.textSecondary }}>≈ </span>
                  <span style={{ fontWeight: 700, color: T.teal }}>USD {(parseFloat(form.amount) * 0.000265).toFixed(2)}</span>
                </div>
              )}
              <Btn variant="primary" full onClick={() => form.category && form.description && form.amount && setStep(2)}>
                Next →
              </Btn>
            </>
          )}

          {step === 2 && (
            <>
              <div style={{ padding: '14px 16px', background: T.bgLight, borderRadius: T.radiusSm, marginBottom: 20, border: `1px solid ${T.border}` }}>
                <p style={{ margin: 0, fontSize: 13, color: T.textSecondary, fontWeight: 600 }}>Request Summary</p>
                <p style={{ margin: '6px 0 2px', fontSize: 15, fontWeight: 800, color: T.coral }}>{fmtUGX(parseFloat(form.amount || 0))}</p>
                <p style={{ margin: 0, fontSize: 13, color: T.textSecondary }}>{form.category} — {form.description?.slice(0, 60)}{form.description?.length > 60 ? '…' : ''}</p>
              </div>

              <Field label="Supplier / Payee Name">
                <Input value={form.payee} onChange={e => setForm(p => ({ ...p, payee: e.target.value }))} placeholder="e.g. Kihura Agro Suppliers" />
              </Field>
              <Field label="Urgency">
                <Select value={form.urgency} onChange={e => setForm(p => ({ ...p, urgency: e.target.value }))}>
                  <option value="low">Low — Can wait a few days</option>
                  <option value="medium">Medium — Needed this week</option>
                  <option value="high">High — Needed within 24hrs</option>
                </Select>
              </Field>
              <Field label="Additional Notes">
                <Input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Optional — any extra details for Admin" />
              </Field>

              <div style={{ display: 'flex', gap: 10 }}>
                <Btn variant="ghost" onClick={() => setStep(1)}>← Back</Btn>
                <Btn variant="primary" full onClick={handleSubmit} disabled={loading} icon="📤">
                  {loading ? 'Submitting…' : 'Submit to Admin Queue'}
                </Btn>
              </div>
            </>
          )}
        </div>
        <style>{`@keyframes slideUp { from { transform: translateY(100%) } to { transform: translateY(0) } }`}</style>
      </div>
    </>
  );
}

// ── ATTENDANCE MATRIX ─────────────────────────────────────────────────────────
function AttendancePage() {
  const today = new Date().toISOString().split('T')[0];
  const [employees] = useState(MOCK_EMPLOYEES);
  const [attendance, setAttendance] = useState({});
  const [saving, setSaving] = useState({});
  const [saved, setSaved] = useState({});

  // Calculate payroll preview
  const workingDays = 26; // typical month
  const payrollPreview = employees.map(emp => {
    const presentDays = Object.values(attendance).filter((v, i) => {
      const empAtt = Object.entries(attendance).find(([k]) => k.startsWith(emp.id));
      return empAtt?.[1] === 'present';
    }).length;
    const presentCount = Object.entries(attendance)
      .filter(([k, v]) => k.startsWith(emp.id + '_') && v === 'present').length;
    let earned = 0;
    if (emp.salary_type === 'daily') earned = presentCount * parseFloat(emp.salary_rate);
    else earned = parseFloat(emp.salary_rate); // monthly always full
    return { ...emp, days_present: presentCount, earned };
  });

  const toggleAttendance = async (empId, status) => {
    const key = `${empId}_${today}`;
    setAttendance(p => ({ ...p, [key]: status }));
    setSaving(p => ({ ...p, [empId]: true }));
    await smartFetch('/payroll/attendance', {
      method: 'POST',
      body: JSON.stringify({ employee_id: empId, date: today, status, hours_worked: status === 'present' ? 8 : 0 }),
    }, { type: 'attendance', label: `Attendance ${status}` });
    setSaving(p => ({ ...p, [empId]: false }));
    setSaved(p => ({ ...p, [empId]: true }));
    setTimeout(() => setSaved(p => ({ ...p, [empId]: false })), 2000);
  };

  const getStatus = (empId) => attendance[`${empId}_${today}`] || null;
  const totalPayroll = payrollPreview.reduce((s, e) => s + e.earned, 0);

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: T.emerald, margin: '0 0 4px', fontFamily: T.fontDisplay }}>Attendance — {new Date().toLocaleDateString('en-UG', { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
        <p style={{ color: T.textSecondary, fontSize: 13, margin: 0 }}>Tap Present or Absent for each worker. Auto-saves.</p>
      </div>

      {/* Employee attendance cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
        {employees.map(emp => {
          const status = getStatus(emp.id);
          return (
            <div key={emp.id} style={{
              background: T.white, borderRadius: T.radius,
              border: `1px solid ${status === 'present' ? T.emeraldLight : status === 'absent' ? T.coral + '44' : T.border}`,
              boxShadow: T.shadowSm, padding: '14px 16px',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <Avatar name={emp.full_name} size={44} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: T.textPrimary }}>{emp.full_name}</div>
                <div style={{ fontSize: 12, color: T.textMuted }}>{emp.position} · {emp.salary_type === 'daily' ? `${fmtUGX(emp.salary_rate)}/day` : `${fmtUGX(emp.salary_rate)}/month`}</div>
              </div>
              {saved[emp.id] && <span style={{ fontSize: 12, color: T.teal, fontWeight: 700 }}>✓ Saved</span>}
              {saving[emp.id] && <Spinner size={16} />}
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => toggleAttendance(emp.id, 'present')} style={{
                  height: T.touch, padding: '0 14px', borderRadius: T.radiusSm, border: `1.5px solid ${T.emeraldLight}`,
                  background: status === 'present' ? T.emerald : T.white,
                  color: status === 'present' ? T.white : T.teal,
                  fontWeight: 700, fontSize: 13, cursor: 'pointer',
                }}>✓ Present</button>
                <button onClick={() => toggleAttendance(emp.id, 'absent')} style={{
                  height: T.touch, padding: '0 14px', borderRadius: T.radiusSm, border: `1.5px solid ${T.coral + '44'}`,
                  background: status === 'absent' ? T.coral : T.white,
                  color: status === 'absent' ? T.white : T.coral,
                  fontWeight: 700, fontSize: 13, cursor: 'pointer',
                }}>✗ Absent</button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Payroll Preview Block */}
      <div style={{ background: T.white, borderRadius: T.radius, border: `1px solid ${T.border}`, boxShadow: T.shadowSm, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', background: T.emerald, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: T.white, fontFamily: T.fontDisplay }}>Payroll Preview</h3>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>Based on attendance logged today</span>
        </div>
        {payrollPreview.map((emp, i) => (
          <div key={emp.id} style={{
            padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 14,
            borderBottom: i < payrollPreview.length - 1 ? `1px solid ${T.border}` : 'none',
            background: i % 2 === 0 ? T.white : T.bgLight,
          }}>
            <Avatar name={emp.full_name} size={36} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: T.textPrimary }}>{emp.full_name}</div>
              <div style={{ fontSize: 12, color: T.textMuted }}>{emp.salary_type === 'daily' ? `${emp.days_present} days present` : 'Monthly salary'}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 800, fontSize: 15, color: T.teal, fontFamily: T.fontMono }}>{fmtUGX(emp.earned)}</div>
              <div style={{ fontSize: 11, color: T.textMuted }}>this month so far</div>
            </div>
          </div>
        ))}
        <div style={{ padding: '16px 20px', background: T.emeraldFaint, borderTop: `2px solid ${T.emeraldLight}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, color: T.textSecondary, fontSize: 14 }}>TOTAL PAYROLL</span>
          <span style={{ fontWeight: 900, fontSize: 20, color: T.emerald, fontFamily: T.fontDisplay }}>{fmtUGX(totalPayroll)}</span>
        </div>
      </div>
    </div>
  );
}

// ── MAIN MANAGER INTERFACE ────────────────────────────────────────────────────
export default function ManagerInterface() {
  const { user } = useAuth();
  const [tab, setTab] = useState('tasks');
  const [tasks, setTasks] = useState(MOCK_TASKS);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [pendingOps, setPendingOps] = useState(0);
  const [alert, setAlert] = useState(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    getPendingCount().then(setPendingOps);
    const interval = setInterval(() => getPendingCount().then(setPendingOps), 5000);
    return () => clearInterval(interval);
  }, []);

  const handleTaskComplete = (id) => {
    setTasks(p => p.map(t => t.id === id ? { ...t, status: 'completed' } : t));
    setAlert({ type: 'success', msg: 'Task marked complete. Syncing…' });
    setTimeout(() => setAlert(null), 3000);
  };

  const handleExpenseSubmitted = (data) => {
    setAlert({ type: data.offline ? 'warning' : 'success', msg: data.offline ? `Expense queued offline — will sync when connected.` : `${fmtUGX(parseFloat(data.amount))} request sent to Admin for approval.` });
    setTimeout(() => setAlert(null), 5000);
  };

  const handleManualSync = async () => {
    setSyncing(true);
    await runSync();
    const count = await getPendingCount();
    setPendingOps(count);
    setSyncing(false);
    setAlert({ type: 'success', msg: 'Sync complete.' });
    setTimeout(() => setAlert(null), 3000);
  };

  const activeTasks = tasks.filter(t => t.status !== 'completed');
  const overdueTasks = activeTasks.filter(t => new Date(t.due_date) < new Date());
  const todayTasks = activeTasks.filter(t => new Date(t.due_date).toDateString() === new Date().toDateString() && new Date(t.due_date) >= new Date());

  const TABS = [
    { id: 'tasks', label: 'Tasks', icon: '📋', count: activeTasks.length },
    { id: 'attendance', label: 'Attendance', icon: '👷', count: null },
    { id: 'expenses', label: 'Expenses', icon: '💸', count: null },
  ];

  return (
    <div style={{ fontFamily: T.fontBody, maxWidth: 680, margin: '0 auto' }}>
      {/* Mobile App Header */}
      <div style={{
        background: T.emerald, padding: '20px 20px 0',
        borderRadius: '0 0 24px 24px', marginBottom: 20,
        boxShadow: T.shadowLg,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, margin: '0 0 3px', letterSpacing: 0.5 }}>GROUND MANAGER</p>
            <h1 style={{ color: T.white, fontSize: 22, fontWeight: 800, margin: 0, fontFamily: T.fontDisplay }}>
              {user?.full_name?.split(' ')[0] || 'Manager'}'s Dashboard
            </h1>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
            <ConnectivityBadge pendingOps={pendingOps} />
            {pendingOps > 0 && (
              <button onClick={handleManualSync} disabled={syncing} style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: T.radiusFull, padding: '4px 10px', cursor: 'pointer', fontWeight: 600 }}>
                {syncing ? '⟳ Syncing…' : '↑ Sync now'}
              </button>
            )}
          </div>
        </div>

        {/* Quick stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
          {[
            { label: 'Overdue', value: overdueTasks.length, color: T.coral },
            { label: 'Due Today', value: todayTasks.length, color: T.amber },
            { label: 'Total Active', value: activeTasks.length, color: 'rgba(255,255,255,0.9)' },
          ].map(s => (
            <div key={s.label} style={{ background: 'rgba(255,255,255,0.1)', borderRadius: T.radiusSm, padding: '10px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: s.color, fontFamily: T.fontDisplay }}>{s.value}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 2 }}>
          {TABS.map(tab_ => (
            <button key={tab_.id} onClick={() => setTab(tab_.id)} style={{
              flex: 1, padding: '10px 4px', border: 'none', cursor: 'pointer',
              background: 'transparent', color: tab === tab_.id ? T.white : 'rgba(255,255,255,0.5)',
              fontSize: 13, fontWeight: tab === tab_.id ? 700 : 500, fontFamily: T.fontBody,
              borderBottom: `3px solid ${tab === tab_.id ? T.white : 'transparent'}`,
              transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            }}>
              {tab_.icon} {tab_.label}
              {tab_.count !== null && tab_.count > 0 && (
                <span style={{ background: T.coral, color: T.white, borderRadius: T.radiusFull, fontSize: 10, fontWeight: 800, padding: '1px 6px', minWidth: 18, textAlign: 'center' }}>{tab_.count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Alert */}
      {alert && (
        <div style={{ marginBottom: 16 }}>
          <Alert type={alert.type} onDismiss={() => setAlert(null)}>{alert.msg}</Alert>
        </div>
      )}

      {/* Tab Content */}
      {tab === 'tasks' && (
        <div>
          {overdueTasks.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: T.coral, textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
                🚨 Overdue ({overdueTasks.length})
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {overdueTasks.map(t => <TaskCard key={t.id} task={t} onComplete={handleTaskComplete} />)}
              </div>
            </div>
          )}

          {todayTasks.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: T.amberDark, textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 10px' }}>📅 Due Today ({todayTasks.length})</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {todayTasks.map(t => <TaskCard key={t.id} task={t} onComplete={handleTaskComplete} />)}
              </div>
            </div>
          )}

          {activeTasks.filter(t => new Date(t.due_date) > new Date() && new Date(t.due_date).toDateString() !== new Date().toDateString()).length > 0 && (
            <div>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 10px' }}>📆 Upcoming</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {activeTasks.filter(t => new Date(t.due_date) > new Date() && new Date(t.due_date).toDateString() !== new Date().toDateString())
                  .map(t => <TaskCard key={t.id} task={t} onComplete={handleTaskComplete} />)}
              </div>
            </div>
          )}

          {activeTasks.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: T.textPrimary, fontFamily: T.fontDisplay }}>All tasks complete!</div>
              <div style={{ color: T.textMuted, fontSize: 14, marginTop: 6 }}>Great work today. Check back tomorrow.</div>
            </div>
          )}
        </div>
      )}

      {tab === 'attendance' && <AttendancePage />}

      {tab === 'expenses' && (
        <div>
          <div style={{ textAlign: 'center', padding: '40px 20px 30px' }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>💸</div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: T.textPrimary, fontFamily: T.fontDisplay, margin: '0 0 8px' }}>Request Funds</h2>
            <p style={{ color: T.textSecondary, fontSize: 14, margin: '0 0 24px' }}>Submit expense requests directly to the Super Admin approval queue.</p>
            <Btn variant="primary" size="lg" icon="+" onClick={() => setExpenseOpen(true)}>New Expense Request</Btn>
          </div>
        </div>
      )}

      <ExpenseDrawer open={expenseOpen} onClose={() => setExpenseOpen(false)} onSubmitted={handleExpenseSubmitted} />

      {/* FAB for expense on tasks tab */}
      {tab === 'tasks' && (
        <button onClick={() => setExpenseOpen(true)} style={{
          position: 'fixed', bottom: 24, right: 24,
          width: 56, height: 56, borderRadius: '50%',
          background: T.coral, border: 'none', cursor: 'pointer',
          boxShadow: '0 4px 20px rgba(230,57,70,0.4)',
          fontSize: 24, color: T.white,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 50,
        }} title="Request expense">💸</button>
      )}
    </div>
  );
}
