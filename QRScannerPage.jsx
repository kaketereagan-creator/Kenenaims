import { useState, useEffect, useRef, useCallback } from 'react';
import { T } from '../../theme';
import { Btn, Badge, Avatar, Field, Input, Select, Spinner, Alert } from '../../components/UI';
import { smartFetch } from '../../services/offlineSync';

const fmt = n => new Intl.NumberFormat('en-UG').format(Math.round(n));
const fmtUGX = n => `UGX ${fmt(n)}`;

// Mock animal data for QR scan results
const MOCK_SCAN_RESULTS = {
  'RBT-000001': { animal_id: 'RBT-000001', species_name: 'rabbit', breed_name: 'New Zealand White', name: 'Bella', sex: 'female', status: 'active', current_weight: 2.4, housing_name: 'Rabbit Pen A', date_of_birth: '2024-08-15', last_vaccination: '2025-03-01', next_vaccination: '2025-09-01', vaccinations: [{ vaccine_name: 'RHD Vaccine', date_given: '2025-03-01', next_due_date: '2025-09-01' }] },
  'PIG-000001': { animal_id: 'PIG-000001', species_name: 'pig', breed_name: 'Large White', name: 'Mama Sue', sex: 'female', status: 'active', current_weight: 68.5, housing_name: 'Pig Pen 1', date_of_birth: '2023-11-20', last_vaccination: '2025-01-15', next_vaccination: '2025-07-15', vaccinations: [] },
  'PLT-000001': { animal_id: 'PLT-000001', species_name: 'poultry', breed_name: 'Broiler', sex: 'unknown', status: 'active', current_weight: 1.8, housing_name: 'Poultry House 1', date_of_birth: '2025-04-01', vaccinations: [] },
};

const SPECIES_ICONS = { rabbit: '🐇', pig: '🐷', poultry: '🐔', cattle: '🐄' };

// ── WEIGHT LOG FORM ───────────────────────────────────────────────────────────
function WeightForm({ animal, onSave, onClose }) {
  const [weight, setWeight] = useState('');
  const [loading, setLoading] = useState(false);
  const handleSave = async () => {
    if (!weight) return;
    setLoading(true);
    await smartFetch(`/animals/${animal.animal_id}/weight`, {
      method: 'POST',
      body: JSON.stringify({ weight: parseFloat(weight), weight_unit: 'kg', recorded_date: new Date().toISOString().split('T')[0] }),
    }, { type: 'animal_weight', label: `Weight for ${animal.animal_id}` });
    setLoading(false);
    onSave(parseFloat(weight));
    onClose();
  };
  return (
    <div>
      <p style={{ fontSize: 14, color: T.textSecondary, marginTop: 0 }}>Current weight: <strong>{animal.current_weight} kg</strong></p>
      <Field label="New Weight (kg)" required>
        <Input type="number" value={weight} onChange={e => setWeight(e.target.value)} placeholder="e.g. 2.6" />
      </Field>
      <div style={{ display: 'flex', gap: 10 }}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" full onClick={handleSave} disabled={loading || !weight}>
          {loading ? 'Saving…' : '✓ Save Weight'}
        </Btn>
      </div>
    </div>
  );
}

// ── TREATMENT FORM ────────────────────────────────────────────────────────────
function TreatmentForm({ animal, onSave, onClose }) {
  const [form, setForm] = useState({ diagnosis: '', treatment: '', medicine_used: '', dosage: '', vet_name: '', cost: '' });
  const [loading, setLoading] = useState(false);
  const handleSave = async () => {
    if (!form.diagnosis || !form.treatment) return;
    setLoading(true);
    await smartFetch(`/animals/${animal.animal_id}/treatment`, {
      method: 'POST',
      body: JSON.stringify({ ...form, treatment_date: new Date().toISOString().split('T')[0], cost: parseFloat(form.cost || 0) }),
    }, { type: 'treatment', label: `Treatment for ${animal.animal_id}` });
    setLoading(false);
    onSave();
    onClose();
  };
  return (
    <div>
      <Field label="Diagnosis / Condition" required>
        <Input value={form.diagnosis} onChange={e => setForm(p => ({ ...p, diagnosis: e.target.value }))} placeholder="e.g. Respiratory infection" />
      </Field>
      <Field label="Treatment Given" required>
        <Input value={form.treatment} onChange={e => setForm(p => ({ ...p, treatment: e.target.value }))} placeholder="e.g. Oxytetracycline injection" />
      </Field>
      <Field label="Medicine / Drug Used">
        <Input value={form.medicine_used} onChange={e => setForm(p => ({ ...p, medicine_used: e.target.value }))} placeholder="e.g. Oxytetracycline 20%" />
      </Field>
      <Field label="Dosage">
        <Input value={form.dosage} onChange={e => setForm(p => ({ ...p, dosage: e.target.value }))} placeholder="e.g. 2ml/10kg bodyweight" />
      </Field>
      <Field label="Vet Name">
        <Input value={form.vet_name} onChange={e => setForm(p => ({ ...p, vet_name: e.target.value }))} placeholder="e.g. Dr. Kato" />
      </Field>
      <Field label="Treatment Cost (UGX)">
        <Input type="number" value={form.cost} onChange={e => setForm(p => ({ ...p, cost: e.target.value }))} placeholder="e.g. 50000" />
      </Field>
      <div style={{ display: 'flex', gap: 10 }}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" full onClick={handleSave} disabled={loading}>
          {loading ? 'Saving…' : '✓ Save Treatment'}
        </Btn>
      </div>
    </div>
  );
}

// ── MORTALITY FORM ────────────────────────────────────────────────────────────
function MortalityForm({ animal, onSave, onClose }) {
  const [form, setForm] = useState({ cause: '', description: '', disposal_method: 'burial' });
  const [loading, setLoading] = useState(false);
  const handleSave = async () => {
    if (!form.cause) return;
    setLoading(true);
    await smartFetch(`/animals/${animal.animal_id}/death`, {
      method: 'POST',
      body: JSON.stringify({ ...form, death_date: new Date().toISOString().split('T')[0] }),
    }, { type: 'mortality', label: `Death record ${animal.animal_id}` });
    setLoading(false);
    onSave();
    onClose();
  };
  return (
    <div>
      <div style={{ padding: '12px 16px', background: T.coralLight, borderRadius: T.radiusSm, marginBottom: 16, border: `1px solid ${T.coral}44` }}>
        <p style={{ fontSize: 13, color: T.coralDark, fontWeight: 700, margin: 0 }}>⚠️ Mortality Record</p>
        <p style={{ fontSize: 13, color: T.textSecondary, margin: '4px 0 0' }}>This will mark {animal.animal_id} as deceased and update livestock count.</p>
      </div>
      <Field label="Cause of Death" required>
        <Select value={form.cause} onChange={e => setForm(p => ({ ...p, cause: e.target.value }))}>
          <option value="">Select cause…</option>
          <option value="disease">Disease / Illness</option>
          <option value="accident">Accident / Injury</option>
          <option value="predator">Predator Attack</option>
          <option value="unknown">Unknown</option>
          <option value="natural">Natural Causes</option>
        </Select>
      </Field>
      <Field label="Description">
        <Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Additional details…" />
      </Field>
      <Field label="Disposal Method">
        <Select value={form.disposal_method} onChange={e => setForm(p => ({ ...p, disposal_method: e.target.value }))}>
          <option value="burial">Buried on farm</option>
          <option value="incineration">Incinerated</option>
          <option value="composting">Composted</option>
          <option value="sold">Sold (dead stock)</option>
        </Select>
      </Field>
      <div style={{ display: 'flex', gap: 10 }}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="danger" full onClick={handleSave} disabled={loading}>
          {loading ? 'Recording…' : '⚠️ Confirm Mortality'}
        </Btn>
      </div>
    </div>
  );
}

// ── ANIMAL PROFILE DRAWER ─────────────────────────────────────────────────────
function AnimalProfileDrawer({ animal, onClose, onAction }) {
  const [activeAction, setActiveAction] = useState(null); // 'weight' | 'treatment' | 'mortality'
  const [alert, setAlert] = useState(null);
  if (!animal) return null;

  const actions = [
    { id: 'weight', icon: '⚖️', label: 'Log Weight', color: T.teal },
    { id: 'treatment', icon: '💉', label: 'Apply Treatment', color: T.blue },
    { id: 'mortality', icon: '💀', label: 'Report Mortality', color: T.coral },
  ];

  const vaccinationDue = animal.next_vaccination && new Date(animal.next_vaccination) <= new Date(Date.now() + 7 * 86400000);

  return (
    <>
      <div onClick={() => { if (!activeAction) onClose(); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 300, backdropFilter: 'blur(2px)' }} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 301,
        background: T.white, borderRadius: '20px 20px 0 0',
        boxShadow: '0 -8px 40px rgba(27,67,50,0.25)',
        animation: 'slideUp 0.28s cubic-bezier(0.4,0,0.2,1)',
        maxHeight: '85vh', overflowY: 'auto',
      }}>
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12 }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: T.border }} />
        </div>

        {activeAction ? (
          <div style={{ padding: '0 20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0 16px', borderBottom: `1px solid ${T.border}`, marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: T.emerald, fontFamily: T.fontDisplay }}>
                {actions.find(a => a.id === activeAction)?.icon} {actions.find(a => a.id === activeAction)?.label}
              </h3>
              <button onClick={() => setActiveAction(null)} style={{ background: T.bgLight, border: 'none', borderRadius: 8, width: 36, height: 36, cursor: 'pointer', fontSize: 18, color: T.textSecondary }}>←</button>
            </div>
            {activeAction === 'weight' && <WeightForm animal={animal} onSave={w => { setAlert({ type: 'success', msg: `Weight ${w}kg saved for ${animal.animal_id}` }); setActiveAction(null); onAction('weight', w); }} onClose={() => setActiveAction(null)} />}
            {activeAction === 'treatment' && <TreatmentForm animal={animal} onSave={() => { setAlert({ type: 'success', msg: `Treatment recorded for ${animal.animal_id}` }); setActiveAction(null); onAction('treatment'); }} onClose={() => setActiveAction(null)} />}
            {activeAction === 'mortality' && <MortalityForm animal={animal} onSave={() => { setAlert({ type: 'warning', msg: `Mortality recorded for ${animal.animal_id}` }); setActiveAction(null); onAction('mortality'); onClose(); }} onClose={() => setActiveAction(null)} />}
          </div>
        ) : (
          <div style={{ padding: '0 20px 32px' }}>
            {/* Animal Header */}
            <div style={{ display: 'flex', gap: 16, padding: '16px 0 20px', borderBottom: `1px solid ${T.border}`, marginBottom: 20 }}>
              <div style={{
                width: 72, height: 72, borderRadius: 16, flexShrink: 0,
                background: T.emeraldPale, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 36, border: `1px solid ${T.emeraldLight}`,
              }}>
                {SPECIES_ICONS[animal.species_name] || '🐾'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontFamily: T.fontMono, fontWeight: 800, fontSize: 16, color: T.emerald }}>{animal.animal_id}</span>
                  <Badge status={animal.status === 'active' ? 'active' : 'rejected'}>{animal.status}</Badge>
                </div>
                {animal.name && <div style={{ fontSize: 18, fontWeight: 700, color: T.textPrimary, fontFamily: T.fontDisplay }}>{animal.name}</div>}
                <div style={{ fontSize: 13, color: T.textSecondary, marginTop: 2 }}>{animal.breed_name} · {animal.sex} · {animal.housing_name}</div>
              </div>
              <button onClick={onClose} style={{ background: T.bgLight, border: 'none', borderRadius: 8, width: 36, height: 36, cursor: 'pointer', fontSize: 18, color: T.textSecondary, alignSelf: 'flex-start' }}>×</button>
            </div>

            {/* Vaccination alert */}
            {vaccinationDue && (
              <div style={{ padding: '10px 14px', background: T.amberLight, borderRadius: T.radiusSm, marginBottom: 16, border: `1px solid ${T.amber}44`, fontSize: 13, color: T.amberDark, fontWeight: 600 }}>
                💉 Vaccination due: {new Date(animal.next_vaccination).toLocaleDateString('en-UG', { day: 'numeric', month: 'short' })}
              </div>
            )}

            {alert && <div style={{ marginBottom: 14 }}><Alert type={alert.type} onDismiss={() => setAlert(null)}>{alert.msg}</Alert></div>}

            {/* Key metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 24 }}>
              {[
                { label: 'Weight', value: `${animal.current_weight} kg` },
                { label: 'Age', value: animal.date_of_birth ? `${Math.floor((Date.now() - new Date(animal.date_of_birth)) / (30 * 86400000))} mo` : 'Unknown' },
                { label: 'Housing', value: animal.housing_name?.replace('Rabbit ', '').replace('Pig ', '').replace('Poultry ', '') || '—' },
              ].map(m => (
                <div key={m.label} style={{ background: T.bgLight, borderRadius: T.radiusSm, padding: '12px', textAlign: 'center', border: `1px solid ${T.border}` }}>
                  <div style={{ fontWeight: 800, fontSize: 16, color: T.textPrimary, fontFamily: T.fontDisplay }}>{m.value}</div>
                  <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>{m.label}</div>
                </div>
              ))}
            </div>

            {/* Action buttons */}
            <h4 style={{ fontSize: 13, fontWeight: 700, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 12px' }}>Quick Actions</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {actions.map(a => (
                <button key={a.id} onClick={() => setActiveAction(a.id)} style={{
                  padding: '14px 10px', borderRadius: T.radius, border: `1.5px solid ${a.color}33`,
                  background: a.color + '12', cursor: 'pointer', textAlign: 'center',
                  transition: 'all 0.15s',
                }}>
                  <div style={{ fontSize: 24, marginBottom: 6 }}>{a.icon}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: a.color }}>{a.label}</div>
                </button>
              ))}
            </div>
          </div>
        )}
        <style>{`@keyframes slideUp { from { transform: translateY(100%) } to { transform: translateY(0) } }`}</style>
      </div>
    </>
  );
}

// ── BATCH SELECTION BAR ───────────────────────────────────────────────────────
function BatchActionBar({ selected, onClearSelect, onBatchAction }) {
  if (selected.length === 0) return null;
  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 150,
      background: T.emerald, padding: '14px 20px',
      display: 'flex', alignItems: 'center', gap: 12,
      boxShadow: '0 -4px 20px rgba(27,67,50,0.3)',
    }}>
      <span style={{ color: T.white, fontWeight: 700, fontSize: 14, flex: 1 }}>{selected.length} selected</span>
      <Btn variant="secondary" size="sm" onClick={() => onBatchAction('vaccinate')}>💉 Vaccinate All</Btn>
      <Btn size="sm" style={{ background: '#7B5EA7', color: T.white, border: 'none' }} onClick={() => onBatchAction('move')}>📦 Move Pen</Btn>
      <button onClick={onClearSelect} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: T.white, borderRadius: T.radiusSm, width: 36, height: 36, cursor: 'pointer', fontSize: 18 }}>×</button>
    </div>
  );
}

// ── MAIN QR SCANNER PAGE ──────────────────────────────────────────────────────
export default function QRScannerPage() {
  const [scanning, setScanning] = useState(false);
  const [scannedAnimal, setScannedAnimal] = useState(null);
  const [manualId, setManualId] = useState('');
  const [alert, setAlert] = useState(null);
  const [recentScans, setRecentScans] = useState([]);
  const [selectedAnimals, setSelectedAnimals] = useState([]);
  const [batchMode, setBatchMode] = useState(false);
  const scannerRef = useRef(null);
  const html5QrCodeRef = useRef(null);

  const handleScanSuccess = useCallback((decodedText) => {
    let animalId = decodedText;
    try {
      const parsed = JSON.parse(decodedText);
      animalId = parsed.id || decodedText;
    } catch { /* raw text */ }

    stopScanner();
    lookupAnimal(animalId);
  }, []);

  const startScanner = async () => {
    setScanning(true);
    setAlert(null);
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      html5QrCodeRef.current = new Html5Qrcode('qr-reader');
      await html5QrCodeRef.current.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        handleScanSuccess,
        () => {}
      );
    } catch (err) {
      setScanning(false);
      setAlert({ type: 'error', msg: `Camera error: ${err.message}. Use manual entry below.` });
    }
  };

  const stopScanner = () => {
    if (html5QrCodeRef.current) {
      html5QrCodeRef.current.stop().catch(() => {});
      html5QrCodeRef.current = null;
    }
    setScanning(false);
  };

  useEffect(() => () => stopScanner(), []);

  const lookupAnimal = async (animalId) => {
    const upper = animalId.toUpperCase().trim();
    // Try API first, fallback to mock
    try {
      const res = await smartFetch(`/animals/${upper}`);
      if (res.ok && !res.offline) {
        const data = await res.json();
        if (data.animal_id) { openProfile(data); return; }
      }
    } catch { /* fallback */ }
    // Mock lookup
    const mock = MOCK_SCAN_RESULTS[upper];
    if (mock) {
      openProfile(mock);
    } else {
      setAlert({ type: 'error', msg: `Animal ${upper} not found in system.` });
    }
  };

  const openProfile = (animal) => {
    setScannedAnimal(animal);
    setRecentScans(prev => [animal, ...prev.filter(a => a.animal_id !== animal.animal_id)].slice(0, 5));
  };

  const handleManualLookup = () => {
    if (!manualId) return;
    lookupAnimal(manualId);
    setManualId('');
  };

  const toggleSelect = (animal) => {
    setSelectedAnimals(prev =>
      prev.find(a => a.animal_id === animal.animal_id)
        ? prev.filter(a => a.animal_id !== animal.animal_id)
        : [...prev, animal]
    );
  };

  return (
    <div style={{ fontFamily: T.fontBody, maxWidth: 600, margin: '0 auto', paddingBottom: selectedAnimals.length > 0 ? 80 : 0 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: T.emerald, margin: '0 0 4px', fontFamily: T.fontDisplay }}>QR Scanner</h1>
        <p style={{ color: T.textSecondary, fontSize: 14, margin: 0 }}>Scan animal ear tags or enter ID manually</p>
      </div>

      {alert && <div style={{ marginBottom: 16 }}><Alert type={alert.type} onDismiss={() => setAlert(null)}>{alert.msg}</Alert></div>}

      {/* Camera viewfinder */}
      <div style={{
        background: T.textPrimary, borderRadius: T.radius, overflow: 'hidden',
        marginBottom: 20, position: 'relative', minHeight: 300,
        border: `2px solid ${scanning ? T.emeraldLight : T.border}`,
        boxShadow: scanning ? `0 0 0 3px ${T.emeraldPale}` : T.shadowSm,
      }}>
        <div id="qr-reader" style={{ width: '100%' }} />

        {!scanning && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            {/* Viewfinder frame */}
            <div style={{ position: 'relative', width: 200, height: 200, marginBottom: 24 }}>
              {/* Corner brackets */}
              {[['0 auto auto 0', 'borderTop,borderLeft'], ['0 0 auto auto', 'borderTop,borderRight'], ['auto auto 0 0', 'borderBottom,borderLeft'], ['auto 0 0 auto', 'borderBottom,borderRight']].map(([inset, borders], i) => (
                <div key={i} style={{
                  position: 'absolute', width: 30, height: 30,
                  top: inset.split(' ')[0] === 'auto' ? 'auto' : 0,
                  bottom: inset.split(' ')[2] === 'auto' ? 'auto' : 0,
                  left: inset.split(' ')[3] === 'auto' ? 'auto' : 0,
                  right: inset.split(' ')[1] === 'auto' ? 'auto' : 0,
                  borderTop: borders.includes('borderTop') ? `3px solid ${T.emeraldLight}` : 'none',
                  borderBottom: borders.includes('borderBottom') ? `3px solid ${T.emeraldLight}` : 'none',
                  borderLeft: borders.includes('borderLeft') ? `3px solid ${T.emeraldLight}` : 'none',
                  borderRight: borders.includes('borderRight') ? `3px solid ${T.emeraldLight}` : 'none',
                }} />
              ))}
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48 }}>📷</div>
            </div>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, textAlign: 'center', margin: '0 0 20px' }}>
              Point camera at animal QR ear tag
            </p>
            <Btn variant="primary" size="lg" icon="📷" onClick={startScanner}>Start Camera Scanner</Btn>
          </div>
        )}

        {scanning && (
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.7)', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: T.emeraldLight, animation: 'pulse 1s infinite' }} />
              <span style={{ color: T.white, fontSize: 13, fontWeight: 600 }}>Scanning…</span>
            </div>
            <Btn variant="danger" size="sm" onClick={stopScanner}>Stop</Btn>
          </div>
        )}
      </div>

      {/* Manual entry */}
      <div style={{ background: T.white, borderRadius: T.radius, border: `1px solid ${T.border}`, boxShadow: T.shadowSm, padding: '20px', marginBottom: 20 }}>
        <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700, color: T.textPrimary }}>Manual ID Entry</h3>
        <div style={{ display: 'flex', gap: 10 }}>
          <Input value={manualId} onChange={e => setManualId(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && handleManualLookup()}
            placeholder="e.g. RBT-000001" style={{ fontFamily: T.fontMono, letterSpacing: 1 }} />
          <Btn variant="primary" onClick={handleManualLookup} disabled={!manualId} icon="🔍">Look Up</Btn>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          {['RBT-000001', 'PIG-000001', 'PLT-000001'].map(id => (
            <button key={id} onClick={() => lookupAnimal(id)} style={{
              padding: '6px 12px', borderRadius: T.radiusFull, border: `1px solid ${T.border}`,
              background: T.bgLight, color: T.textSecondary, fontSize: 12, cursor: 'pointer', fontFamily: T.fontMono,
            }}>{id}</button>
          ))}
        </div>
      </div>

      {/* Batch mode toggle + recent scans */}
      {recentScans.length > 0 && (
        <div style={{ background: T.white, borderRadius: T.radius, border: `1px solid ${T.border}`, boxShadow: T.shadowSm, overflow: 'hidden', marginBottom: 20 }}>
          <div style={{ padding: '14px 18px', borderBottom: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: T.bgLight }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: T.textSecondary }}>Recent Scans</h3>
            <button onClick={() => { setBatchMode(!batchMode); setSelectedAnimals([]); }} style={{
              padding: '6px 12px', borderRadius: T.radiusSm, border: `1px solid ${batchMode ? T.emerald : T.border}`,
              background: batchMode ? T.emeraldPale : T.white, color: batchMode ? T.emerald : T.textSecondary,
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}>
              {batchMode ? '✓ Batch ON' : '☐ Batch Mode'}
            </button>
          </div>
          {recentScans.map((a, i) => (
            <div key={a.animal_id} onClick={() => batchMode ? toggleSelect(a) : openProfile(a)} style={{
              display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px',
              borderBottom: i < recentScans.length - 1 ? `1px solid ${T.border}` : 'none',
              cursor: 'pointer', background: selectedAnimals.find(s => s.animal_id === a.animal_id) ? T.emeraldFaint : 'transparent',
              transition: 'background 0.15s',
            }}
              onMouseEnter={e => { if (!selectedAnimals.find(s => s.animal_id === a.animal_id)) e.currentTarget.style.background = T.bgLight; }}
              onMouseLeave={e => { if (!selectedAnimals.find(s => s.animal_id === a.animal_id)) e.currentTarget.style.background = 'transparent'; }}
            >
              {batchMode && (
                <div style={{
                  width: 22, height: 22, borderRadius: 6, border: `2px solid ${selectedAnimals.find(s => s.animal_id === a.animal_id) ? T.emerald : T.border}`,
                  background: selectedAnimals.find(s => s.animal_id === a.animal_id) ? T.emerald : T.white,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  {selectedAnimals.find(s => s.animal_id === a.animal_id) && <span style={{ color: T.white, fontSize: 13 }}>✓</span>}
                </div>
              )}
              <div style={{ fontSize: 28 }}>{SPECIES_ICONS[a.species_name]}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontFamily: T.fontMono, fontWeight: 700, fontSize: 13, color: T.emerald }}>{a.animal_id}</span>
                  {a.name && <span style={{ fontSize: 13, color: T.textPrimary, fontWeight: 600 }}>{a.name}</span>}
                </div>
                <div style={{ fontSize: 12, color: T.textMuted }}>{a.breed_name} · {a.current_weight}kg · {a.housing_name}</div>
              </div>
              <span style={{ color: T.textMuted, fontSize: 18 }}>›</span>
            </div>
          ))}
        </div>
      )}

      <AnimalProfileDrawer
        animal={scannedAnimal}
        onClose={() => setScannedAnimal(null)}
        onAction={(type, val) => {
          if (type === 'weight') {
            setRecentScans(prev => prev.map(a => a.animal_id === scannedAnimal?.animal_id ? { ...a, current_weight: val } : a));
          }
          setAlert({ type: 'success', msg: `${type} recorded for ${scannedAnimal?.animal_id}` });
          setTimeout(() => setAlert(null), 3000);
        }}
      />

      <BatchActionBar
        selected={selectedAnimals}
        onClearSelect={() => { setSelectedAnimals([]); setBatchMode(false); }}
        onBatchAction={(action) => {
          setAlert({ type: 'success', msg: `${action} queued for ${selectedAnimals.length} animals` });
          setSelectedAnimals([]);
          setBatchMode(false);
          setTimeout(() => setAlert(null), 3000);
        }}
      />

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
    </div>
  );
}
