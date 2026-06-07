import { useState } from 'react';
import { T } from '../../theme';
import { SectionHeader, Btn, Badge, Alert, Drawer, Field, Input, Select, EmptyState } from '../../components/UI';
import { smartFetch } from '../../services/offlineSync';

const fmt = n => new Intl.NumberFormat('en-UG').format(Math.round(n));
const fmtUGX = n => `UGX ${fmt(n)}`;

const MOCK_FIELDS = [
  {
    id: '1', field_name: 'Matoke Plot A', field_code: 'FLD-001',
    acreage: 1.5, crop_type: 'Banana/Matoke', status: 'growing',
    planting_date: '2025-01-15', expected_harvest_date: '2025-08-15',
    expected_yield: 2400, yield_unit: 'kg',
    last_fertilizer: '2025-05-10', fertilizer_type: 'NPK 25kg',
    notes: 'Good growth. Second ratoon cycle.',
    activities: [
      { date: '2025-05-10', type: 'fertilizing', detail: 'NPK application 25kg', cost: 65000 },
      { date: '2025-04-20', type: 'weeding', detail: 'Manual weeding full plot', cost: 45000 },
      { date: '2025-01-15', type: 'planting', detail: 'Initial planting 240 suckers', cost: 120000 },
    ]
  },
  {
    id: '2', field_name: 'Maize Block B', field_code: 'FLD-002',
    acreage: 0.75, crop_type: 'Maize', status: 'harvested',
    planting_date: '2025-02-01', expected_harvest_date: '2025-06-01',
    actual_harvest_date: '2025-06-05', expected_yield: 900, actual_yield: 870,
    yield_unit: 'kg', revenue: 348000,
    notes: 'Season A complete. Good yield.',
    activities: [
      { date: '2025-06-05', type: 'harvesting', detail: '870kg harvested', cost: 35000 },
      { date: '2025-04-15', type: 'spraying', detail: 'Herbicide application', cost: 28000 },
    ]
  },
  {
    id: '3', field_name: 'Bean Plot C', field_code: 'FLD-003',
    acreage: 0.5, crop_type: 'Beans', status: 'planted',
    planting_date: '2025-06-10', expected_harvest_date: '2025-09-10',
    expected_yield: 350, yield_unit: 'kg',
    notes: 'Season B planting. K132 variety.',
    activities: [
      { date: '2025-06-10', type: 'planting', detail: 'K132 beans planted', cost: 40000 },
    ]
  },
  {
    id: '4', field_name: 'Cassava Plot D', field_code: 'FLD-004',
    acreage: 1.0, crop_type: 'Cassava', status: 'growing',
    planting_date: '2024-12-01', expected_harvest_date: '2026-03-01',
    expected_yield: 8000, yield_unit: 'kg',
    notes: 'NASE 14 variety. 18 months cycle.',
    activities: [
      { date: '2025-03-01', type: 'weeding', detail: 'First weeding', cost: 30000 },
    ]
  },
];

const statusConfig = {
  planned:   { bg: T.blueLight, color: '#1565C0', label: 'Planned', icon: '📋' },
  planted:   { bg: T.amberLight, color: T.amberDark, label: 'Planted', icon: '🌱' },
  growing:   { bg: T.emeraldPale, color: T.teal, label: 'Growing', icon: '🌿' },
  harvested: { bg: '#F3E5F5', color: '#7B5EA7', label: 'Harvested', icon: '✅' },
  failed:    { bg: T.coralLight, color: T.coralDark, label: 'Failed', icon: '❌' },
};

const activityIcons = { planting: '🌱', weeding: '🌾', fertilizing: '💊', spraying: '💧', irrigation: '🚿', harvesting: '🌾', other: '📝' };

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr) - new Date();
  return Math.ceil(diff / 86400000);
}

// ── FIELD CARD ─────────────────────────────────────────────────────────────────
function FieldCard({ field, onSelect }) {
  const st = statusConfig[field.status] || statusConfig.planted;
  const daysToHarvest = field.expected_harvest_date && field.status !== 'harvested' ? daysUntil(field.expected_harvest_date) : null;
  const harvestSoon = daysToHarvest !== null && daysToHarvest <= 30 && daysToHarvest > 0;
  const overdue = daysToHarvest !== null && daysToHarvest < 0 && field.status !== 'harvested';

  // Planting progress
  let progressPct = 0;
  if (field.planting_date && field.expected_harvest_date) {
    const total = new Date(field.expected_harvest_date) - new Date(field.planting_date);
    const elapsed = new Date() - new Date(field.planting_date);
    progressPct = Math.min(100, Math.max(0, (elapsed / total) * 100));
  }

  return (
    <div onClick={() => onSelect(field)} style={{
      background: T.white, borderRadius: T.radius,
      border: `1.5px solid ${overdue ? T.coral + '44' : harvestSoon ? T.amber + '44' : T.border}`,
      boxShadow: T.shadowSm, cursor: 'pointer', overflow: 'hidden',
      transition: 'box-shadow 0.2s, transform 0.15s',
    }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = T.shadowMd; e.currentTarget.style.transform = 'translateY(-2px)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = T.shadowSm; e.currentTarget.style.transform = 'none'; }}
    >
      {/* Color strip */}
      <div style={{ height: 5, background: field.status === 'harvested' ? '#7B5EA7' : field.status === 'growing' ? T.emeraldMid : T.amber }} />

      <div style={{ padding: '16px 18px' }}>
        {/* Header row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: T.textPrimary, fontFamily: T.fontDisplay, marginBottom: 2 }}>{field.field_name}</div>
            <div style={{ fontSize: 12, color: T.textMuted, fontFamily: T.fontMono }}>{field.field_code}</div>
          </div>
          <span style={{ background: st.bg, color: st.color, borderRadius: T.radiusFull, padding: '4px 10px', fontSize: 12, fontWeight: 700 }}>
            {st.icon} {st.label}
          </span>
        </div>

        {/* Alert banners */}
        {overdue && <div style={{ background: T.coralLight, borderRadius: T.radiusSm, padding: '7px 10px', marginBottom: 10, fontSize: 12, color: T.coralDark, fontWeight: 700 }}>⚠️ Harvest overdue by {Math.abs(daysToHarvest)} days</div>}
        {harvestSoon && <div style={{ background: T.amberLight, borderRadius: T.radiusSm, padding: '7px 10px', marginBottom: 10, fontSize: 12, color: T.amberDark, fontWeight: 700 }}>🌾 Harvest in {daysToHarvest} days</div>}

        {/* Stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: 13, marginBottom: 14 }}>
          <div><span style={{ color: T.textMuted }}>Crop: </span><span style={{ fontWeight: 700, color: T.textPrimary }}>{field.crop_type}</span></div>
          <div><span style={{ color: T.textMuted }}>Area: </span><span style={{ fontWeight: 700, color: T.textPrimary }}>{field.acreage} acres</span></div>
          <div><span style={{ color: T.textMuted }}>Planted: </span><span style={{ fontWeight: 600, color: T.textPrimary }}>{new Date(field.planting_date).toLocaleDateString('en-UG', { day: 'numeric', month: 'short' })}</span></div>
          {field.status === 'harvested' && field.actual_yield
            ? <div><span style={{ color: T.textMuted }}>Yield: </span><span style={{ fontWeight: 700, color: '#7B5EA7' }}>{fmt(field.actual_yield)} {field.yield_unit}</span></div>
            : <div><span style={{ color: T.textMuted }}>Exp. yield: </span><span style={{ fontWeight: 600, color: T.textPrimary }}>{fmt(field.expected_yield)} {field.yield_unit}</span></div>
          }
        </div>

        {/* Progress bar */}
        {field.status !== 'harvested' && field.status !== 'planned' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: T.textMuted, marginBottom: 4 }}>
              <span>Cycle progress</span>
              <span>{Math.round(progressPct)}%</span>
            </div>
            <div style={{ background: T.bgMuted, borderRadius: T.radiusFull, height: 6 }}>
              <div style={{ width: `${progressPct}%`, height: '100%', borderRadius: T.radiusFull, background: T.emeraldMid, transition: 'width 0.5s' }} />
            </div>
          </div>
        )}

        {/* Revenue if harvested */}
        {field.status === 'harvested' && field.revenue && (
          <div style={{ marginTop: 10, padding: '8px 12px', background: T.emeraldFaint, borderRadius: T.radiusSm, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: T.textSecondary, fontWeight: 600 }}>Revenue</span>
            <span style={{ fontSize: 15, fontWeight: 800, color: T.teal, fontFamily: T.fontDisplay }}>{fmtUGX(field.revenue)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── HARVEST REPORT FORM ────────────────────────────────────────────────────────
function HarvestForm({ field, onSave, onClose }) {
  const [form, setForm] = useState({ actual_yield: '', yield_unit: field?.yield_unit || 'kg', sale_price_per_unit: '', buyer_name: '', notes: '' });
  const [loading, setLoading] = useState(false);

  const totalRevenue = parseFloat(form.actual_yield || 0) * parseFloat(form.sale_price_per_unit || 0);

  const handleSave = async () => {
    if (!form.actual_yield) return;
    setLoading(true);
    await smartFetch(`/crops/${field.id}/harvest`, {
      method: 'POST',
      body: JSON.stringify({ ...form, actual_yield: parseFloat(form.actual_yield), actual_harvest_date: new Date().toISOString().split('T')[0], total_revenue: totalRevenue }),
    }, { type: 'harvest', label: `Harvest ${field.field_name}` });
    setLoading(false);
    onSave({ ...form, total_revenue: totalRevenue });
    onClose();
  };

  return (
    <div>
      <div style={{ padding: '12px 16px', background: '#F3E5F5', borderRadius: T.radiusSm, marginBottom: 20, border: '1px solid #CE93D8' }}>
        <p style={{ fontSize: 13, color: '#6A1B9A', fontWeight: 700, margin: 0 }}>📋 Recording harvest for: {field?.field_name}</p>
        <p style={{ fontSize: 12, color: T.textSecondary, margin: '4px 0 0' }}>Expected yield was {fmt(field?.expected_yield)} {field?.yield_unit}</p>
      </div>
      <Field label={`Actual Yield (${form.yield_unit})`} required>
        <Input type="number" value={form.actual_yield} onChange={e => setForm(p => ({ ...p, actual_yield: e.target.value }))} placeholder={`e.g. ${field?.expected_yield}`} />
      </Field>
      <Field label="Sale Price per Unit (UGX)">
        <Input type="number" value={form.sale_price_per_unit} onChange={e => setForm(p => ({ ...p, sale_price_per_unit: e.target.value }))} placeholder="e.g. 400" />
      </Field>
      {totalRevenue > 0 && (
        <div style={{ padding: '10px 14px', background: T.emeraldFaint, borderRadius: T.radiusSm, marginBottom: 16, fontSize: 13, fontWeight: 700, color: T.teal }}>
          Total Revenue: {fmtUGX(totalRevenue)}
        </div>
      )}
      <Field label="Buyer Name">
        <Input value={form.buyer_name} onChange={e => setForm(p => ({ ...p, buyer_name: e.target.value }))} placeholder="e.g. Kampala market trader" />
      </Field>
      <Field label="Notes">
        <Input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Quality notes, storage method, etc." />
      </Field>
      <Btn variant="primary" full onClick={handleSave} disabled={loading || !form.actual_yield} icon="🌾">
        {loading ? 'Recording…' : 'Record Harvest'}
      </Btn>
    </div>
  );
}

// ── MAIN CROPS PAGE ───────────────────────────────────────────────────────────
export default function CropsPage() {
  const [fields, setFields] = useState(MOCK_FIELDS);
  const [selected, setSelected] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [harvestOpen, setHarvestOpen] = useState(false);
  const [alert, setAlert] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [newField, setNewField] = useState({ field_name: '', acreage: '', crop_type: '', planting_date: '', expected_harvest_date: '', expected_yield: '', yield_unit: 'kg', notes: '' });
  const [addActivity, setAddActivity] = useState(false);
  const [activity, setActivity] = useState({ type: 'weeding', date: new Date().toISOString().split('T')[0], detail: '', cost: '' });

  const totalAcres = fields.reduce((s, f) => s + parseFloat(f.acreage || 0), 0);
  const totalExpectedYield = fields.filter(f => f.status !== 'harvested').reduce((s, f) => s + (f.expected_yield || 0), 0);
  const totalRevenue = fields.filter(f => f.status === 'harvested').reduce((s, f) => s + (f.revenue || 0), 0);
  const harvestSoonCount = fields.filter(f => { const d = daysUntil(f.expected_harvest_date); return d !== null && d <= 30 && d > 0 && f.status !== 'harvested'; }).length;

  const filtered = statusFilter === 'all' ? fields : fields.filter(f => f.status === statusFilter);

  const handleAddField = async () => {
    if (!newField.field_name || !newField.crop_type) return;
    const code = `FLD-${String(fields.length + 1).padStart(3, '0')}`;
    const f = { id: Date.now().toString(), field_code: code, status: 'planted', activities: [], ...newField, acreage: parseFloat(newField.acreage) || 0, expected_yield: parseFloat(newField.expected_yield) || 0 };
    setFields(p => [f, ...p]);
    setAddOpen(false);
    setAlert({ type: 'success', msg: `${newField.field_name} added.` });
    setNewField({ field_name: '', acreage: '', crop_type: '', planting_date: '', expected_harvest_date: '', expected_yield: '', yield_unit: 'kg', notes: '' });
    setTimeout(() => setAlert(null), 3000);
  };

  const handleLogActivity = () => {
    if (!activity.detail || !selected) return;
    const updated = { ...selected, activities: [{ ...activity, cost: parseFloat(activity.cost || 0) }, ...(selected.activities || [])] };
    setFields(p => p.map(f => f.id === selected.id ? updated : f));
    setSelected(updated);
    setAddActivity(false);
    setActivity({ type: 'weeding', date: new Date().toISOString().split('T')[0], detail: '', cost: '' });
    setAlert({ type: 'success', msg: 'Activity logged.' });
    setTimeout(() => setAlert(null), 3000);
  };

  const handleHarvestSaved = (data) => {
    const updated = { ...selected, status: 'harvested', actual_yield: parseFloat(data.actual_yield), revenue: data.total_revenue };
    setFields(p => p.map(f => f.id === selected.id ? updated : f));
    setSelected(null);
    setAlert({ type: 'success', msg: `Harvest recorded — ${fmtUGX(data.total_revenue)} revenue.` });
    setTimeout(() => setAlert(null), 4000);
  };

  return (
    <div style={{ fontFamily: T.fontBody }}>
      <SectionHeader
        title="Crop Management"
        sub={`${fields.length} fields · ${totalAcres.toFixed(1)} total acres`}
        action={<Btn variant="primary" size="sm" icon="+" onClick={() => setAddOpen(true)}>Add Field</Btn>}
      />

      {alert && <div style={{ marginBottom: 16 }}><Alert type={alert.type} onDismiss={() => setAlert(null)}>{alert.msg}</Alert></div>}

      {harvestSoonCount > 0 && (
        <div style={{ background: T.amberLight, border: `1px solid ${T.amber}44`, borderRadius: T.radiusSm, padding: '12px 18px', marginBottom: 20, fontSize: 14, color: T.amberDark, fontWeight: 700 }}>
          🌾 {harvestSoonCount} field{harvestSoonCount > 1 ? 's' : ''} approaching harvest within 30 days
        </div>
      )}

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { icon: '🗺️', label: 'Total Area', value: `${totalAcres.toFixed(1)} acres`, color: T.emeraldMid },
          { icon: '🌿', label: 'Active Fields', value: fields.filter(f => f.status === 'growing' || f.status === 'planted').length, color: T.teal },
          { icon: '🌾', label: 'Expected Yield', value: `${fmt(totalExpectedYield)} kg`, color: T.amberDark },
          { icon: '💰', label: 'Season Revenue', value: fmtUGX(totalRevenue), color: '#7B5EA7' },
        ].map(s => (
          <div key={s.label} style={{ background: T.white, borderRadius: T.radius, border: `1px solid ${T.border}`, boxShadow: T.shadowSm, padding: '18px 20px' }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>{s.icon}</div>
            <div style={{ fontSize: s.label === 'Season Revenue' || s.label === 'Expected Yield' ? 14 : 22, fontWeight: 800, color: s.color, fontFamily: T.fontDisplay }}>{s.value}</div>
            <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 3 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Status filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {[['all', '🗺️', 'All'], ['planted', '🌱', 'Planted'], ['growing', '🌿', 'Growing'], ['harvested', '✅', 'Harvested']].map(([key, icon, label]) => (
          <button key={key} onClick={() => setStatusFilter(key)} style={{
            height: 40, padding: '0 16px', borderRadius: T.radiusSm,
            background: statusFilter === key ? T.emerald : T.white,
            border: `1.5px solid ${statusFilter === key ? T.emerald : T.border}`,
            color: statusFilter === key ? T.white : T.textSecondary,
            cursor: 'pointer', fontSize: 13, fontWeight: 700,
          }}>{icon} {label}</button>
        ))}
      </div>

      {/* Field grid */}
      {filtered.length === 0
        ? <EmptyState icon="🌱" title="No fields found" sub="Add your first crop field to start tracking" action={<Btn variant="primary" icon="+" onClick={() => setAddOpen(true)}>Add Field</Btn>} />
        : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {filtered.map(f => <FieldCard key={f.id} field={f} onSelect={setSelected} />)}
          </div>
      }

      {/* Field Detail Drawer */}
      <Drawer open={!!selected && !harvestOpen && !addActivity} onClose={() => setSelected(null)} title={selected?.field_name || ''}>
        {selected && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
              {[
                { label: 'Field Code', value: selected.field_code },
                { label: 'Crop Type', value: selected.crop_type },
                { label: 'Area', value: `${selected.acreage} acres` },
                { label: 'Status', value: selected.status },
                { label: 'Planted', value: selected.planting_date ? new Date(selected.planting_date).toLocaleDateString() : '—' },
                { label: 'Harvest Date', value: selected.expected_harvest_date ? new Date(selected.expected_harvest_date).toLocaleDateString() : '—' },
                { label: 'Expected Yield', value: `${fmt(selected.expected_yield)} ${selected.yield_unit}` },
                { label: selected.actual_yield ? 'Actual Yield' : 'Days to Harvest', value: selected.actual_yield ? `${fmt(selected.actual_yield)} ${selected.yield_unit}` : (daysUntil(selected.expected_harvest_date) > 0 ? `${daysUntil(selected.expected_harvest_date)} days` : 'Overdue') },
              ].map(f => (
                <div key={f.label} style={{ background: T.bgLight, borderRadius: T.radiusSm, padding: '10px 14px' }}>
                  <div style={{ fontSize: 11, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 600, marginBottom: 3 }}>{f.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: T.textPrimary }}>{f.value}</div>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
              {selected.status !== 'harvested' && (
                <Btn variant="primary" full icon="🌾" onClick={() => setHarvestOpen(true)}>Report Yield / Harvest</Btn>
              )}
              <Btn variant="secondary" full icon="📝" onClick={() => setAddActivity(true)}>Log Farm Activity</Btn>
            </div>

            {/* Activity log */}
            {selected.activities?.length > 0 && (
              <div>
                <h4 style={{ fontSize: 13, fontWeight: 700, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 12px' }}>Activity History</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {selected.activities.map((a, i) => (
                    <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 14px', background: T.bgLight, borderRadius: T.radiusSm, border: `1px solid ${T.border}` }}>
                      <span style={{ fontSize: 18 }}>{activityIcons[a.type] || '📝'}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: T.textPrimary, textTransform: 'capitalize' }}>{a.type}</div>
                        <div style={{ fontSize: 12, color: T.textSecondary }}>{a.detail}</div>
                        <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>{a.date} {a.cost > 0 && `· Cost: ${fmtUGX(a.cost)}`}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Drawer>

      {/* Harvest Form Drawer */}
      <Drawer open={harvestOpen} onClose={() => setHarvestOpen(false)} title="🌾 Record Harvest">
        {selected && <HarvestForm field={selected} onSave={handleHarvestSaved} onClose={() => { setHarvestOpen(false); setSelected(null); }} />}
      </Drawer>

      {/* Log Activity Drawer */}
      <Drawer open={addActivity} onClose={() => setAddActivity(false)} title="📝 Log Farm Activity">
        <Field label="Activity Type">
          <Select value={activity.type} onChange={e => setActivity(p => ({ ...p, type: e.target.value }))}>
            {Object.keys(activityIcons).map(k => <option key={k} value={k}>{activityIcons[k]} {k.charAt(0).toUpperCase() + k.slice(1)}</option>)}
          </Select>
        </Field>
        <Field label="Date">
          <Input type="date" value={activity.date} onChange={e => setActivity(p => ({ ...p, date: e.target.value }))} />
        </Field>
        <Field label="Description" required>
          <Input value={activity.detail} onChange={e => setActivity(p => ({ ...p, detail: e.target.value }))} placeholder="e.g. Applied NPK fertilizer 25kg bag" />
        </Field>
        <Field label="Labour / Material Cost (UGX)">
          <Input type="number" value={activity.cost} onChange={e => setActivity(p => ({ ...p, cost: e.target.value }))} placeholder="0" />
        </Field>
        <Btn variant="primary" full onClick={handleLogActivity} disabled={!activity.detail} icon="✓">Save Activity</Btn>
      </Drawer>

      {/* Add Field Drawer */}
      <Drawer open={addOpen} onClose={() => setAddOpen(false)} title="🌱 Add New Field">
        <Field label="Field / Plot Name" required>
          <Input value={newField.field_name} onChange={e => setNewField(p => ({ ...p, field_name: e.target.value }))} placeholder="e.g. Matoke Plot B" />
        </Field>
        <Field label="Crop Type" required>
          <Select value={newField.crop_type} onChange={e => setNewField(p => ({ ...p, crop_type: e.target.value }))}>
            <option value="">Select crop…</option>
            {['Banana/Matoke', 'Maize', 'Beans', 'Cassava', 'Sweet Potato', 'Coffee', 'Sugarcane', 'Vegetables', 'Other'].map(c => <option key={c} value={c}>{c}</option>)}
          </Select>
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label="Acreage" required><Input type="number" value={newField.acreage} onChange={e => setNewField(p => ({ ...p, acreage: e.target.value }))} placeholder="e.g. 1.5" /></Field>
          <Field label="Expected Yield"><Input type="number" value={newField.expected_yield} onChange={e => setNewField(p => ({ ...p, expected_yield: e.target.value }))} placeholder="kg" /></Field>
          <Field label="Planting Date"><Input type="date" value={newField.planting_date} onChange={e => setNewField(p => ({ ...p, planting_date: e.target.value }))} /></Field>
          <Field label="Expected Harvest"><Input type="date" value={newField.expected_harvest_date} onChange={e => setNewField(p => ({ ...p, expected_harvest_date: e.target.value }))} /></Field>
        </div>
        <Field label="Notes"><Input value={newField.notes} onChange={e => setNewField(p => ({ ...p, notes: e.target.value }))} placeholder="Variety, soil notes, etc." /></Field>
        <Btn variant="primary" full onClick={handleAddField} disabled={!newField.field_name || !newField.crop_type} icon="✓">Add Field</Btn>
      </Drawer>
    </div>
  );
}
