import { useState, useEffect } from 'react';
import { T } from '../../theme';
import { SectionHeader, Btn, Badge, Drawer, Field, Input, Select, Alert, Spinner, EmptyState } from '../../components/UI';
import { apiFetch } from '../../context/AuthContext';
import { smartFetch } from '../../services/offlineSync';

const fmt = n => new Intl.NumberFormat('en-UG').format(Math.round(n));
const fmtUGX = n => `UGX ${fmt(n)}`;

// ── SPECIES CONFIG ────────────────────────────────────────────────────────────
const SPECIES = {
  rabbit: { icon: '🐇', color: '#40916C', gestationDays: 31, label: 'Rabbit', prefix: 'RBT' },
  pig:    { icon: '🐷', color: '#7B5EA7', gestationDays: 114, label: 'Pig', prefix: 'PIG' },
  poultry:{ icon: '🐔', color: '#FFB703', gestationDays: 21, label: 'Poultry', prefix: 'PLT' },
  cattle: { icon: '🐄', color: '#2196F3', gestationDays: 283, label: 'Cattle', prefix: 'CAT' },
};

// ── MOCK DATA ─────────────────────────────────────────────────────────────────
const MOCK_ANIMALS = [
  { id: '1', animal_id: 'RBT-000001', species_name: 'rabbit', breed_name: 'New Zealand White', name: 'Bella', sex: 'female', status: 'active', current_weight: 2.4, housing_name: 'Rabbit Pen A', health_status: 'healthy', date_of_birth: '2024-08-15' },
  { id: '2', animal_id: 'RBT-000002', species_name: 'rabbit', breed_name: 'Flemish Giant', name: 'Rex', sex: 'male', status: 'active', current_weight: 3.1, housing_name: 'Rabbit Pen A', health_status: 'healthy', date_of_birth: '2024-07-20' },
  { id: '3', animal_id: 'RBT-000003', species_name: 'rabbit', breed_name: 'New Zealand White', sex: 'female', status: 'active', current_weight: 2.8, housing_name: 'Rabbit Pen B', health_status: 'pregnant', date_of_birth: '2024-06-10', breeding_date: new Date(Date.now() - 18 * 86400000).toISOString() },
  { id: '4', animal_id: 'PIG-000001', species_name: 'pig', breed_name: 'Large White', name: 'Mama Sue', sex: 'female', status: 'active', current_weight: 68.5, housing_name: 'Pig Pen 1', health_status: 'pregnant', date_of_birth: '2023-11-20', breeding_date: new Date(Date.now() - 60 * 86400000).toISOString() },
  { id: '5', animal_id: 'PIG-000002', species_name: 'pig', breed_name: 'Landrace', name: 'Boris', sex: 'male', status: 'active', current_weight: 95, housing_name: 'Pig Pen 2', health_status: 'healthy', date_of_birth: '2023-09-05' },
  { id: '6', animal_id: 'PLT-000001', species_name: 'poultry', breed_name: 'Broiler', sex: 'unknown', status: 'active', current_weight: 1.8, housing_name: 'Poultry House 1', health_status: 'healthy', date_of_birth: '2025-04-01' },
  { id: '7', animal_id: 'PLT-000002', species_name: 'poultry', breed_name: 'Layer', sex: 'female', status: 'active', current_weight: 1.6, housing_name: 'Poultry House 2', health_status: 'healthy', date_of_birth: '2025-02-10' },
  { id: '8', animal_id: 'CAT-000001', species_name: 'cattle', breed_name: 'Ankole', name: 'Nakato', sex: 'female', status: 'active', current_weight: 320, housing_name: 'Kraal A', health_status: 'healthy', date_of_birth: '2022-03-15' },
  { id: '9', animal_id: 'RBT-000004', species_name: 'rabbit', breed_name: 'Rex', sex: 'female', status: 'active', current_weight: 2.1, housing_name: 'Rabbit Pen B', health_status: 'quarantined', date_of_birth: '2024-09-01' },
];

// ── GESTATION TIMELINE ────────────────────────────────────────────────────────
function GestationTimeline({ animal }) {
  const sp = SPECIES[animal.species_name];
  if (!animal.breeding_date || !sp?.gestationDays) return null;

  const matingDate = new Date(animal.breeding_date);
  const expectedBirth = new Date(matingDate.getTime() + sp.gestationDays * 86400000);
  const now = new Date();
  const totalMs = expectedBirth - matingDate;
  const elapsedMs = now - matingDate;
  const progressPct = Math.min(100, Math.max(0, (elapsedMs / totalMs) * 100));
  const daysRemaining = Math.max(0, Math.ceil((expectedBirth - now) / 86400000));
  const daysPregnant = Math.floor(elapsedMs / 86400000);
  const isImminent = daysRemaining <= 3;

  const stages = animal.species_name === 'rabbit'
    ? [{ label: 'Mating', day: 0 }, { label: 'Palpation', day: 14 }, { label: 'Kindle', day: 31 }]
    : animal.species_name === 'pig'
    ? [{ label: 'Mating', day: 0 }, { label: 'Confirm', day: 21 }, { label: 'Farrow', day: 114 }]
    : [{ label: 'Mating', day: 0 }, { label: 'Mid', day: Math.floor(sp.gestationDays / 2) }, { label: 'Birth', day: sp.gestationDays }];

  return (
    <div style={{ marginTop: 12 }}>
      {isImminent && (
        <div style={{ background: T.coralLight, border: `1px solid ${T.coral}44`, borderRadius: T.radiusSm, padding: '8px 12px', marginBottom: 10, fontSize: 12, color: T.coralDark, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
          🚨 Birth imminent — {daysRemaining === 0 ? 'DUE TODAY' : `${daysRemaining} day${daysRemaining > 1 ? 's' : ''} remaining`}
        </div>
      )}

      <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
        <span>Day {daysPregnant} of {sp.gestationDays}</span>
        <span style={{ color: isImminent ? T.coral : T.textMuted }}>
          {daysRemaining > 0 ? `${daysRemaining}d to birth` : 'Due today!'}
        </span>
      </div>

      {/* Progress bar */}
      <div style={{ background: T.bgMuted, borderRadius: T.radiusFull, height: 8, position: 'relative', marginBottom: 8 }}>
        <div style={{ width: `${progressPct}%`, height: '100%', borderRadius: T.radiusFull, background: isImminent ? T.coral : T.emeraldMid, transition: 'width 0.5s' }} />
      </div>

      {/* Milestone track */}
      <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', padding: '0 4px' }}>
        {stages.map((stage, i) => {
          const stagePct = (stage.day / sp.gestationDays) * 100;
          const passed = progressPct >= stagePct;
          return (
            <div key={i} style={{ textAlign: 'center', flex: 1 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: passed ? T.emeraldMid : T.border, margin: '0 auto 3px', border: `2px solid ${passed ? T.emeraldMid : T.border}` }} />
              <div style={{ fontSize: 10, color: passed ? T.teal : T.textMuted, fontWeight: passed ? 700 : 400 }}>{stage.label}</div>
            </div>
          );
        })}
      </div>

      <div style={{ fontSize: 11, color: T.textMuted, marginTop: 6 }}>
        Expected: {expectedBirth.toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' })}
      </div>
    </div>
  );
}

// ── ANIMAL CARD ───────────────────────────────────────────────────────────────
const healthColors = {
  healthy:     { bg: T.emeraldPale, text: T.teal, icon: '🟢' },
  pregnant:    { bg: '#FFF3E0', text: '#E65100', icon: '🟡' },
  quarantined: { bg: T.coralLight, text: T.coralDark, icon: '🔴' },
  sick:        { bg: T.amberLight, text: T.amberDark, icon: '🟠' },
};

function AnimalCard({ animal, onClick }) {
  const sp = SPECIES[animal.species_name] || SPECIES.rabbit;
  const health = healthColors[animal.health_status] || healthColors.healthy;
  const isPregnant = animal.health_status === 'pregnant' && animal.breeding_date;

  return (
    <div onClick={() => onClick(animal)} style={{
      background: T.white, borderRadius: T.radius,
      border: `1px solid ${animal.health_status === 'quarantined' ? T.coral + '44' : T.border}`,
      boxShadow: T.shadowSm, cursor: 'pointer',
      overflow: 'hidden', transition: 'box-shadow 0.2s, transform 0.15s',
    }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = T.shadowMd; e.currentTarget.style.transform = 'translateY(-2px)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = T.shadowSm; e.currentTarget.style.transform = 'none'; }}
    >
      {/* Species color strip */}
      <div style={{ height: 4, background: sp.color }} />

      <div style={{ padding: '14px 16px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12, flexShrink: 0,
            background: sp.color + '18', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 26, border: `1px solid ${sp.color}33`,
          }}>{sp.icon}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontFamily: T.fontMono, color: sp.color, fontWeight: 700, marginBottom: 2 }}>{animal.animal_id}</div>
            {animal.name && <div style={{ fontSize: 14, fontWeight: 700, color: T.textPrimary, fontFamily: T.fontDisplay }}>{animal.name}</div>}
            <div style={{ fontSize: 11, color: T.textMuted }}>{animal.breed_name}</div>
          </div>
          <div style={{ background: health.bg, color: health.text, borderRadius: T.radiusFull, padding: '3px 8px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
            {health.icon} {animal.health_status}
          </div>
        </div>

        {/* Details grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px', fontSize: 12 }}>
          <div><span style={{ color: T.textMuted }}>Sex: </span><span style={{ color: T.textPrimary, fontWeight: 600 }}>{animal.sex}</span></div>
          <div><span style={{ color: T.textMuted }}>Weight: </span><span style={{ color: T.textPrimary, fontWeight: 600 }}>{animal.current_weight} kg</span></div>
          <div style={{ gridColumn: 'span 2' }}><span style={{ color: T.textMuted }}>Housing: </span><span style={{ color: T.textPrimary, fontWeight: 600 }}>{animal.housing_name}</span></div>
        </div>

        {/* Gestation timeline if pregnant */}
        {isPregnant && <GestationTimeline animal={animal} />}
      </div>
    </div>
  );
}

// ── ADD ANIMAL DRAWER ─────────────────────────────────────────────────────────
function AddAnimalDrawer({ open, onClose, onAdded }) {
  const [form, setForm] = useState({ species_name: 'rabbit', breed_name: '', name: '', sex: 'female', date_of_birth: '', current_weight: '', housing_name: '', source: 'born_on_farm', purchase_price: '' });
  const [loading, setLoading] = useState(false);

  const breedOptions = {
    rabbit: ['New Zealand White', 'Flemish Giant', 'Rex', 'Californian', 'Other'],
    pig: ['Large White', 'Landrace', 'Duroc', 'Local Breed', 'Other'],
    poultry: ['Broiler', 'Layer', 'Kuroiler', 'Local', 'Other'],
    cattle: ['Ankole', 'Friesian', 'Cross Breed', 'Zebu', 'Other'],
  };

  const handleSubmit = async () => {
    if (!form.species_name || !form.sex) return;
    setLoading(true);
    const res = await smartFetch('/animals', {
      method: 'POST',
      body: JSON.stringify(form),
    }, { type: 'add_animal', label: `New ${form.species_name}` });
    const data = await res.json();
    setLoading(false);
    onAdded({ ...form, animal_id: data.animal_id || `${SPECIES[form.species_name].prefix}-PENDING`, id: data.id || Date.now().toString(), status: 'active', health_status: 'healthy' });
    onClose();
    setForm({ species_name: 'rabbit', breed_name: '', name: '', sex: 'female', date_of_birth: '', current_weight: '', housing_name: '', source: 'born_on_farm', purchase_price: '' });
  };

  return (
    <Drawer open={open} onClose={onClose} title="🐾 Add New Animal">
      <Field label="Species" required>
        <Select value={form.species_name} onChange={e => setForm(p => ({ ...p, species_name: e.target.value, breed_name: '' }))}>
          {Object.entries(SPECIES).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
        </Select>
      </Field>
      <Field label="Breed">
        <Select value={form.breed_name} onChange={e => setForm(p => ({ ...p, breed_name: e.target.value }))}>
          <option value="">Select breed…</option>
          {(breedOptions[form.species_name] || []).map(b => <option key={b} value={b}>{b}</option>)}
        </Select>
      </Field>
      <Field label="Name (optional)">
        <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Bella" />
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Field label="Sex" required>
          <Select value={form.sex} onChange={e => setForm(p => ({ ...p, sex: e.target.value }))}>
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="unknown">Unknown</option>
          </Select>
        </Field>
        <Field label="Weight (kg)">
          <Input type="number" value={form.current_weight} onChange={e => setForm(p => ({ ...p, current_weight: e.target.value }))} placeholder="e.g. 2.4" />
        </Field>
      </div>
      <Field label="Date of Birth">
        <Input type="date" value={form.date_of_birth} onChange={e => setForm(p => ({ ...p, date_of_birth: e.target.value }))} />
      </Field>
      <Field label="Housing Unit">
        <Input value={form.housing_name} onChange={e => setForm(p => ({ ...p, housing_name: e.target.value }))} placeholder="e.g. Rabbit Pen A" />
      </Field>
      <Field label="Source">
        <Select value={form.source} onChange={e => setForm(p => ({ ...p, source: e.target.value }))}>
          <option value="born_on_farm">Born on Farm</option>
          <option value="purchased">Purchased</option>
        </Select>
      </Field>
      {form.source === 'purchased' && (
        <Field label="Purchase Price (UGX)">
          <Input type="number" value={form.purchase_price} onChange={e => setForm(p => ({ ...p, purchase_price: e.target.value }))} placeholder="e.g. 80000" />
        </Field>
      )}
      <Btn variant="primary" full onClick={handleSubmit} disabled={loading} icon="✓">
        {loading ? 'Saving…' : 'Add Animal'}
      </Btn>
    </Drawer>
  );
}

// ── MAIN LIVESTOCK PAGE ───────────────────────────────────────────────────────
export default function LivestockPage() {
  const [animals, setAnimals] = useState(MOCK_ANIMALS);
  const [filter, setFilter] = useState('all');
  const [healthFilter, setHealthFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const q = filter !== 'all' ? `?species=${filter}` : '';
    apiFetch(`/animals${q}`)
      .then(r => r.json())
      .then(d => { if (d?.animals?.length) setAnimals(d.animals); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filter]);

  const filtered = animals.filter(a => {
    if (filter !== 'all' && a.species_name !== filter) return false;
    if (healthFilter !== 'all' && a.health_status !== healthFilter) return false;
    if (search && !a.animal_id.toLowerCase().includes(search.toLowerCase()) && !(a.name || '').toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const counts = {
    all: animals.length,
    rabbit: animals.filter(a => a.species_name === 'rabbit').length,
    pig: animals.filter(a => a.species_name === 'pig').length,
    poultry: animals.filter(a => a.species_name === 'poultry').length,
    cattle: animals.filter(a => a.species_name === 'cattle').length,
  };

  const pregnantAnimals = animals.filter(a => a.health_status === 'pregnant' && a.breeding_date);
  const imminentBirths = pregnantAnimals.filter(a => {
    const sp = SPECIES[a.species_name];
    if (!sp) return false;
    const expectedBirth = new Date(new Date(a.breeding_date).getTime() + sp.gestationDays * 86400000);
    return (expectedBirth - new Date()) / 86400000 <= 7;
  });

  return (
    <div style={{ fontFamily: T.fontBody }}>
      <SectionHeader
        title="Livestock Management"
        sub={`${animals.length} animals tracked · ${pregnantAnimals.length} pregnant`}
        action={<Btn variant="primary" size="sm" icon="+" onClick={() => setAddOpen(true)}>Add Animal</Btn>}
      />

      {/* Imminent birth alert */}
      {imminentBirths.length > 0 && (
        <div style={{ background: T.coralLight, border: `1px solid ${T.coral}44`, borderRadius: T.radius, padding: '14px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 24 }}>🚨</span>
          <div>
            <div style={{ fontWeight: 700, color: T.coralDark, fontSize: 14 }}>Imminent Births — {imminentBirths.length} animal{imminentBirths.length > 1 ? 's' : ''} due within 7 days</div>
            <div style={{ fontSize: 13, color: T.textSecondary, marginTop: 2 }}>
              {imminentBirths.map(a => a.animal_id).join(', ')}
            </div>
          </div>
        </div>
      )}

      {/* Species filter tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {[['all', '🐾', 'All'], ['rabbit', '🐇', 'Rabbits'], ['pig', '🐷', 'Pigs'], ['poultry', '🐔', 'Poultry'], ['cattle', '🐄', 'Cattle']].map(([key, icon, label]) => (
          <button key={key} onClick={() => setFilter(key)} style={{
            height: T.touch, padding: '0 16px', borderRadius: T.radiusSm,
            background: filter === key ? T.emerald : T.white,
            border: `1.5px solid ${filter === key ? T.emerald : T.border}`,
            color: filter === key ? T.white : T.textSecondary,
            cursor: 'pointer', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6,
          }}>
            {icon} {label}
            <span style={{ background: filter === key ? 'rgba(255,255,255,0.25)' : T.bgMuted, color: filter === key ? T.white : T.textMuted, borderRadius: T.radiusFull, fontSize: 11, padding: '1px 6px', fontWeight: 700 }}>
              {counts[key]}
            </span>
          </button>
        ))}

        {/* Health filter */}
        <Select value={healthFilter} onChange={e => setHealthFilter(e.target.value)} style={{ marginLeft: 'auto', width: 160, height: T.touch }}>
          <option value="all">All Health</option>
          <option value="healthy">🟢 Healthy</option>
          <option value="pregnant">🟡 Pregnant</option>
          <option value="quarantined">🔴 Quarantined</option>
          <option value="sick">🟠 Sick</option>
        </Select>

        {/* Search */}
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search ID or name…"
          style={{ height: T.touch, padding: '0 14px', border: `1.5px solid ${T.border}`, borderRadius: T.radiusSm, fontSize: 14, outline: 'none', fontFamily: T.fontBody, color: T.textPrimary, width: 200 }}
          onFocus={e => e.target.style.borderColor = T.emerald}
          onBlur={e => e.target.style.borderColor = T.border}
        />
      </div>

      {/* Animal grid */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner size={32} /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon="🐾" title="No animals found" sub="Try adjusting your filters or add a new animal" action={<Btn variant="primary" onClick={() => setAddOpen(true)} icon="+">Add Animal</Btn>} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {filtered.map(animal => <AnimalCard key={animal.id} animal={animal} onClick={setSelected} />)}
        </div>
      )}

      {/* Animal detail drawer */}
      <Drawer open={!!selected} onClose={() => setSelected(null)} title={selected ? `${SPECIES[selected.species_name]?.icon || '🐾'} ${selected.animal_id}` : ''}>
        {selected && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              {[
                { label: 'Animal ID', value: selected.animal_id },
                { label: 'Species', value: selected.species_name },
                { label: 'Breed', value: selected.breed_name || '—' },
                { label: 'Name', value: selected.name || '—' },
                { label: 'Sex', value: selected.sex },
                { label: 'Weight', value: `${selected.current_weight || '—'} kg` },
                { label: 'Housing', value: selected.housing_name || '—' },
                { label: 'Status', value: selected.status },
              ].map(f => (
                <div key={f.label} style={{ background: T.bgLight, borderRadius: T.radiusSm, padding: '10px 14px' }}>
                  <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 600 }}>{f.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: T.textPrimary }}>{f.value}</div>
                </div>
              ))}
            </div>
            {selected.health_status === 'pregnant' && selected.breeding_date && (
              <div style={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: 16, marginBottom: 16 }}>
                <h4 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 700, color: T.emerald }}>🤰 Gestation Progress</h4>
                <GestationTimeline animal={selected} />
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Btn variant="secondary" full icon="⚖️">Log Weight</Btn>
              <Btn variant="secondary" full icon="💉">Record Vaccination</Btn>
              <Btn variant="secondary" full icon="💊">Apply Treatment</Btn>
            </div>
          </div>
        )}
      </Drawer>

      <AddAnimalDrawer open={addOpen} onClose={() => setAddOpen(false)} onAdded={a => { setAnimals(p => [a, ...p]); }} />
    </div>
  );
}
