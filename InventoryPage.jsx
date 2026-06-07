import { useState, useEffect } from 'react';
import { T } from '../../theme';
import { SectionHeader, Btn, Badge, Alert, Drawer, Field, Input, Select, EmptyState, Spinner } from '../../components/UI';
import { apiFetch } from '../../context/AuthContext';

const fmt = n => new Intl.NumberFormat('en-UG').format(Math.round(n));
const fmtUGX = n => `UGX ${fmt(n)}`;

const MOCK_ITEMS = [
  { id: '1', item_code: 'ITM-0001', name: 'Layer Mash 25kg', category_name: 'feed', unit: 'bags', current_stock: 8, reorder_level: 10, unit_cost: 34000, stock_status: 'low', expiring_soon: false, supplier_name: 'Kihura Agro' },
  { id: '2', item_code: 'ITM-0002', name: 'Pig Finisher Feed', category_name: 'feed', unit: 'bags', current_stock: 15, reorder_level: 8, unit_cost: 38000, stock_status: 'ok', expiring_soon: false, supplier_name: 'Uganda Feeds Ltd' },
  { id: '3', item_code: 'ITM-0003', name: 'RHD Vaccine', category_name: 'medicine', unit: 'vials', current_stock: 4, reorder_level: 10, unit_cost: 18000, stock_status: 'low', expiring_soon: true, expiry_date: '2025-07-15', supplier_name: 'Dr. Kato Vet' },
  { id: '4', item_code: 'ITM-0004', name: 'Oxytetracycline 200ml', category_name: 'medicine', unit: 'bottles', current_stock: 0, reorder_level: 5, unit_cost: 25000, stock_status: 'out_of_stock', expiring_soon: false, supplier_name: 'Dr. Kato Vet' },
  { id: '5', item_code: 'ITM-0005', name: 'Rabbit Pellets 50kg', category_name: 'feed', unit: 'bags', current_stock: 22, reorder_level: 15, unit_cost: 42000, stock_status: 'ok', expiring_soon: false, supplier_name: 'Kihura Agro' },
  { id: '6', item_code: 'ITM-0006', name: 'Wheel Barrow', category_name: 'equipment', unit: 'pieces', current_stock: 3, reorder_level: 2, unit_cost: 85000, stock_status: 'ok', expiring_soon: false, supplier_name: '' },
  { id: '7', item_code: 'ITM-0007', name: 'NPK Fertilizer 50kg', category_name: 'feed', unit: 'bags', current_stock: 2, reorder_level: 5, unit_cost: 65000, stock_status: 'low', expiring_soon: false, supplier_name: 'Kihura Agro' },
  { id: '8', item_code: 'ITM-0008', name: 'Wormer Injection 100ml', category_name: 'medicine', unit: 'bottles', current_stock: 6, reorder_level: 4, unit_cost: 32000, stock_status: 'ok', expiring_soon: false, supplier_name: 'Dr. Kato Vet' },
];

const catColors = { feed: T.teal, medicine: T.coral, equipment: '#7B5EA7', tools: T.blue, other: T.textMuted };
const catIcons = { feed: '🌾', medicine: '💊', equipment: '🔧', tools: '🛠️', other: '📦' };

export default function InventoryPage() {
  const [items, setItems] = useState(MOCK_ITEMS);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [restockItem, setRestockItem] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [alert, setAlert] = useState(null);
  const [restock, setRestock] = useState({ quantity: '', unit_cost: '', invoice_number: '', notes: '' });
  const [newItem, setNewItem] = useState({ name: '', category_name: 'feed', unit: '', current_stock: '', reorder_level: '', unit_cost: '', expiry_date: '' });
  const [loading, setLoading] = useState(false);

  const lowStockCount = items.filter(i => i.stock_status === 'low').length;
  const outOfStockCount = items.filter(i => i.stock_status === 'out_of_stock').length;
  const expiringCount = items.filter(i => i.expiring_soon).length;
  const totalValue = items.reduce((s, i) => s + (i.current_stock * (i.unit_cost || 0)), 0);

  const filtered = items.filter(i => {
    if (filter === 'low_stock') return i.stock_status === 'low' || i.stock_status === 'out_of_stock';
    if (filter === 'expiring') return i.expiring_soon;
    if (filter !== 'all') return i.category_name === filter;
    if (search) return i.name.toLowerCase().includes(search.toLowerCase());
    return true;
  }).filter(i => !search || i.name.toLowerCase().includes(search.toLowerCase()));

  const handleRestock = async () => {
    if (!restock.quantity || !restockItem) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/inventory/items/${restockItem.id}/restock`, { method: 'POST', body: JSON.stringify({ quantity: parseFloat(restock.quantity), unit_cost: parseFloat(restock.unit_cost || restockItem.unit_cost), invoice_number: restock.invoice_number, notes: restock.notes, movement_date: new Date().toISOString().split('T')[0] }) });
      if (res.ok) { const d = await res.json(); setItems(p => p.map(i => i.id === restockItem.id ? { ...i, current_stock: d.new_stock, stock_status: d.new_stock > i.reorder_level ? 'ok' : 'low' } : i)); }
    } catch {
      setItems(p => p.map(i => i.id === restockItem.id ? { ...i, current_stock: i.current_stock + parseFloat(restock.quantity), stock_status: (i.current_stock + parseFloat(restock.quantity)) > i.reorder_level ? 'ok' : 'low' } : i));
    }
    setLoading(false);
    setAlert({ type: 'success', msg: `${restockItem.name} restocked — ${restock.quantity} ${restockItem.unit} added.` });
    setRestockItem(null);
    setRestock({ quantity: '', unit_cost: '', invoice_number: '', notes: '' });
    setTimeout(() => setAlert(null), 4000);
  };

  const handleAddItem = async () => {
    if (!newItem.name) return;
    setLoading(true);
    try {
      const res = await apiFetch('/inventory/items', { method: 'POST', body: JSON.stringify(newItem) });
      if (res.ok) { const d = await res.json(); setItems(p => [{ ...d, category_name: newItem.category_name, stock_status: parseFloat(newItem.current_stock) <= parseFloat(newItem.reorder_level) ? 'low' : 'ok', expiring_soon: false }, ...p]); }
    } catch {
      setItems(p => [{ id: Date.now().toString(), item_code: `ITM-${String(p.length + 1).padStart(4, '0')}`, ...newItem, current_stock: parseFloat(newItem.current_stock) || 0, reorder_level: parseFloat(newItem.reorder_level) || 0, unit_cost: parseFloat(newItem.unit_cost) || 0, stock_status: 'ok', expiring_soon: false }, ...p]);
    }
    setLoading(false);
    setAddOpen(false);
    setAlert({ type: 'success', msg: `${newItem.name} added to inventory.` });
    setNewItem({ name: '', category_name: 'feed', unit: '', current_stock: '', reorder_level: '', unit_cost: '', expiry_date: '' });
    setTimeout(() => setAlert(null), 3000);
  };

  const stockBg = { ok: T.emeraldPale, low: T.amberLight, out_of_stock: T.coralLight };
  const stockColor = { ok: T.teal, low: T.amberDark, out_of_stock: T.coralDark };
  const stockLabel = { ok: 'In Stock', low: 'Low Stock', out_of_stock: 'Out of Stock' };

  return (
    <div style={{ fontFamily: T.fontBody }}>
      <SectionHeader
        title="Inventory Ledger"
        sub={`${items.length} items · ${outOfStockCount} out of stock · ${lowStockCount} low`}
        action={<Btn variant="primary" size="sm" icon="+" onClick={() => setAddOpen(true)}>Add Item</Btn>}
      />

      {alert && <div style={{ marginBottom: 16 }}><Alert type={alert.type} onDismiss={() => setAlert(null)}>{alert.msg}</Alert></div>}

      {/* Alert banners */}
      {(outOfStockCount > 0 || expiringCount > 0) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          {outOfStockCount > 0 && <div style={{ background: T.coralLight, border: `1px solid ${T.coral}44`, borderRadius: T.radiusSm, padding: '12px 16px', fontSize: 14, color: T.coralDark, fontWeight: 600 }}>🚨 {outOfStockCount} item{outOfStockCount > 1 ? 's' : ''} are completely out of stock — restock immediately.</div>}
          {expiringCount > 0 && <div style={{ background: T.amberLight, border: `1px solid ${T.amber}44`, borderRadius: T.radiusSm, padding: '12px 16px', fontSize: 14, color: T.amberDark, fontWeight: 600 }}>⚠️ {expiringCount} medicine{expiringCount > 1 ? 's' : ''} expiring within 30 days.</div>}
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { icon: '📦', label: 'Total Items', value: items.length, color: T.emeraldMid },
          { icon: '🟡', label: 'Low Stock', value: lowStockCount, color: T.amberDark },
          { icon: '🔴', label: 'Out of Stock', value: outOfStockCount, color: T.coral },
          { icon: '💰', label: 'Stock Value', value: fmtUGX(totalValue), color: T.teal },
        ].map(s => (
          <div key={s.label} style={{ background: T.white, borderRadius: T.radius, border: `1px solid ${T.border}`, boxShadow: T.shadowSm, padding: '18px 20px' }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>{s.icon}</div>
            <div style={{ fontSize: s.label === 'Stock Value' ? 14 : 22, fontWeight: 800, color: s.color, fontFamily: T.fontDisplay }}>{s.value}</div>
            <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 3 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {[['all', '📦', 'All'], ['feed', '🌾', 'Feed'], ['medicine', '💊', 'Medicine'], ['equipment', '🔧', 'Equipment'], ['low_stock', '⚠️', 'Alerts']].map(([key, icon, label]) => (
          <button key={key} onClick={() => setFilter(key)} style={{
            height: 40, padding: '0 16px', borderRadius: T.radiusSm,
            background: filter === key ? T.emerald : T.white,
            border: `1.5px solid ${filter === key ? T.emerald : T.border}`,
            color: filter === key ? T.white : T.textSecondary,
            cursor: 'pointer', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6,
          }}>{icon} {label}</button>
        ))}
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search items…"
          style={{ marginLeft: 'auto', height: 40, padding: '0 14px', border: `1.5px solid ${T.border}`, borderRadius: T.radiusSm, fontSize: 14, outline: 'none', fontFamily: T.fontBody, color: T.textPrimary, width: 200 }}
          onFocus={e => e.target.style.borderColor = T.emerald}
          onBlur={e => e.target.style.borderColor = T.border}
        />
      </div>

      {/* Items list */}
      <div style={{ background: T.white, borderRadius: T.radius, border: `1px solid ${T.border}`, boxShadow: T.shadowSm, overflow: 'hidden' }}>
        {filtered.length === 0 ? (
          <EmptyState icon="📦" title="No items found" sub="Add inventory items to track stock levels" />
        ) : (
          filtered.map((item, i) => (
            <div key={item.id} style={{
              display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px',
              borderBottom: i < filtered.length - 1 ? `1px solid ${T.border}` : 'none',
              background: item.stock_status === 'out_of_stock' ? T.coralLight + '44' : item.stock_status === 'low' ? T.amberLight + '44' : 'transparent',
            }}>
              <div style={{ width: 42, height: 42, borderRadius: 10, background: (catColors[item.category_name] || T.textMuted) + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                {catIcons[item.category_name] || '📦'}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <span style={{ fontWeight: 700, fontSize: 14, color: T.textPrimary }}>{item.name}</span>
                  {item.expiring_soon && <span style={{ fontSize: 11, color: T.amberDark, background: T.amberLight, padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>Expiring Soon</span>}
                </div>
                <div style={{ fontSize: 12, color: T.textMuted }}>{item.item_code} · {item.supplier_name || 'No supplier'}</div>
              </div>

              {/* Stock level visual */}
              <div style={{ textAlign: 'center', minWidth: 100 }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: stockColor[item.stock_status], fontFamily: T.fontDisplay }}>
                  {item.current_stock}
                </div>
                <div style={{ fontSize: 11, color: T.textMuted }}>{item.unit} / reorder: {item.reorder_level}</div>
                <div style={{ marginTop: 4, background: T.bgMuted, borderRadius: 3, height: 4 }}>
                  <div style={{ width: `${Math.min(100, (item.current_stock / Math.max(item.reorder_level * 2, 1)) * 100)}%`, height: '100%', borderRadius: 3, background: stockColor[item.stock_status] }} />
                </div>
              </div>

              <div style={{ textAlign: 'right', minWidth: 100 }}>
                <div style={{ fontSize: 12, color: T.textMuted }}>Unit Cost</div>
                <div style={{ fontWeight: 700, fontSize: 13, color: T.textPrimary }}>{fmtUGX(item.unit_cost)}</div>
                <div style={{ fontSize: 12, color: T.textMuted }}>Total: {fmtUGX(item.current_stock * item.unit_cost)}</div>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <span style={{ background: stockBg[item.stock_status], color: stockColor[item.stock_status], borderRadius: T.radiusFull, padding: '4px 10px', fontSize: 11, fontWeight: 700 }}>
                  {stockLabel[item.stock_status]}
                </span>
                <Btn variant="secondary" size="sm" onClick={() => setRestockItem(item)}>+ Restock</Btn>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Restock Drawer */}
      <Drawer open={!!restockItem} onClose={() => setRestockItem(null)} title={`Restock: ${restockItem?.name || ''}`}>
        {restockItem && (
          <>
            <div style={{ padding: '12px 16px', background: T.bgLight, borderRadius: T.radiusSm, marginBottom: 20, border: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 13, color: T.textSecondary }}>Current stock: <strong style={{ color: stockColor[restockItem.stock_status] }}>{restockItem.current_stock} {restockItem.unit}</strong></div>
              <div style={{ fontSize: 13, color: T.textSecondary, marginTop: 4 }}>Reorder level: <strong>{restockItem.reorder_level} {restockItem.unit}</strong></div>
            </div>
            <Field label={`Quantity to Add (${restockItem.unit})`} required>
              <Input type="number" value={restock.quantity} onChange={e => setRestock(p => ({ ...p, quantity: e.target.value }))} placeholder="e.g. 20" />
            </Field>
            <Field label="Unit Cost (UGX)">
              <Input type="number" value={restock.unit_cost || restockItem.unit_cost} onChange={e => setRestock(p => ({ ...p, unit_cost: e.target.value }))} placeholder={`${restockItem.unit_cost}`} />
            </Field>
            {restock.quantity && (
              <div style={{ padding: '10px 14px', background: T.emeraldFaint, borderRadius: T.radiusSm, marginBottom: 16, fontSize: 13, color: T.teal, fontWeight: 600 }}>
                Total cost: {fmtUGX(parseFloat(restock.quantity || 0) * parseFloat(restock.unit_cost || restockItem.unit_cost || 0))}
              </div>
            )}
            <Field label="Invoice / Receipt Number">
              <Input value={restock.invoice_number} onChange={e => setRestock(p => ({ ...p, invoice_number: e.target.value }))} placeholder="e.g. INV-2025-001" />
            </Field>
            <Field label="Notes">
              <Input value={restock.notes} onChange={e => setRestock(p => ({ ...p, notes: e.target.value }))} placeholder="Optional notes…" />
            </Field>
            <Btn variant="primary" full onClick={handleRestock} disabled={loading || !restock.quantity} icon="✓">
              {loading ? 'Saving…' : `Confirm Restock — +${restock.quantity || 0} ${restockItem.unit}`}
            </Btn>
          </>
        )}
      </Drawer>

      {/* Add Item Drawer */}
      <Drawer open={addOpen} onClose={() => setAddOpen(false)} title="Add Inventory Item">
        <Field label="Item Name" required><Input value={newItem.name} onChange={e => setNewItem(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Layer Mash 25kg" /></Field>
        <Field label="Category">
          <Select value={newItem.category_name} onChange={e => setNewItem(p => ({ ...p, category_name: e.target.value }))}>
            <option value="feed">Feed</option>
            <option value="medicine">Medicine / Veterinary</option>
            <option value="equipment">Equipment</option>
            <option value="tools">Tools</option>
            <option value="other">Other</option>
          </Select>
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label="Unit of Measure" required><Input value={newItem.unit} onChange={e => setNewItem(p => ({ ...p, unit: e.target.value }))} placeholder="e.g. bags, vials" /></Field>
          <Field label="Opening Stock"><Input type="number" value={newItem.current_stock} onChange={e => setNewItem(p => ({ ...p, current_stock: e.target.value }))} placeholder="0" /></Field>
          <Field label="Reorder Level" hint="Alert when below this"><Input type="number" value={newItem.reorder_level} onChange={e => setNewItem(p => ({ ...p, reorder_level: e.target.value }))} placeholder="5" /></Field>
          <Field label="Unit Cost (UGX)"><Input type="number" value={newItem.unit_cost} onChange={e => setNewItem(p => ({ ...p, unit_cost: e.target.value }))} placeholder="0" /></Field>
        </div>
        {newItem.category_name === 'medicine' && (
          <Field label="Expiry Date" hint="Leave blank if not applicable">
            <Input type="date" value={newItem.expiry_date} onChange={e => setNewItem(p => ({ ...p, expiry_date: e.target.value }))} />
          </Field>
        )}
        <Btn variant="primary" full onClick={handleAddItem} disabled={loading || !newItem.name} icon="✓">Add to Inventory</Btn>
      </Drawer>
    </div>
  );
}
