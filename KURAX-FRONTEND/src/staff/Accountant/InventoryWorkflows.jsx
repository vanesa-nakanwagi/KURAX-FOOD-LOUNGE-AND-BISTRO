import React, { useState } from 'react';

const UNITS = ['kg', 'g', 'litre', 'ml', 'piece', 'packet', 'box', 'bottle', 'slice'];
const STATIONS = ['KITCHEN', 'BARMAN', 'BARISTA'];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function quantityLabel(item) {
  return `${item.item_name} · ${Number(item.current_quantity || 0)} ${item.unit || 'kg'} · ${item.location_name || 'Unassigned'}`;
}

function Panel({ title, description, children }) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <header className="mb-4 border-b border-zinc-100 pb-3">
        <h2 className="text-lg font-black uppercase tracking-tight">{title}</h2>
        {description && <p className="mt-1 text-sm text-zinc-500">{description}</p>}
      </header>
      {children}
    </section>
  );
}

function Input({ label, value, onChange, type = 'text', min, max, required = false }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-zinc-500">{label}</span>
      <input
        required={required}
        type={type}
        value={value}
        min={min}
        max={max}
        step={type === 'number' ? 'any' : undefined}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
      />
    </label>
  );
}

function Select({ label, value, onChange, options, required = false }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-zinc-500">{label}</span>
      <select
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
      >
        <option value="">Select {label.toLowerCase()}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function SubmitButton({ children = 'Save', disabled = false }) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="rounded-lg bg-zinc-900 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-300"
    >
      {children}
    </button>
  );
}

function Table({ columns, rows, empty = 'No records found.' }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-xs">
        <thead className="bg-zinc-100 text-zinc-600">
          <tr>{columns.map((column) => <th key={column.label} className="px-3 py-2 font-black uppercase tracking-wide">{column.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={columns.length} className="px-3 py-6 text-center text-zinc-500">{empty}</td></tr>
          ) : rows.map((row, index) => (
            <tr key={row.id || row.reference_number || index} className="border-b border-zinc-100">
              {columns.map((column) => (
                <td key={column.label} className="px-3 py-3 align-top text-zinc-700">
                  {column.render ? column.render(row) : (row[column.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function History({ title, columns, rows, empty }) {
  return (
    <Panel title={title}>
      <Table columns={columns} rows={Array.isArray(rows) ? rows : []} empty={empty} />
    </Panel>
  );
}

export function PurchaseWorkflow({ locations, records = {}, onAction, showHistory = true }) {
  const [form, setForm] = useState({ item_name: '', quantity: '', unit: 'kg', unit_cost: '', supplier_name: '', location_id: '', station: 'KITCHEN', category: 'General', minimum_stock_level: '0', payment_method: 'Cash', receipt_number: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    const result = await onAction('purchases', {
      supplier_name: form.supplier_name,
      payment_method: form.payment_method,
      receipt_number: form.receipt_number || undefined,
      notes: form.notes,
      items: [{
        item_name: form.item_name,
        quantity: Number(form.quantity),
        unit: form.unit,
        unit_cost: Number(form.unit_cost),
        category: form.category,
        minimum_stock_level: Number(form.minimum_stock_level || 0),
        location_id: Number(form.location_id),
        station: form.station,
      }],
    }, 'POST', 'Purchase recorded and inventory updated.');
    if (result) setForm((current) => ({ ...current, item_name: '', quantity: '', unit_cost: '', receipt_number: '', notes: '' }));
    setSaving(false);
  };

  const rows = records.purchases || [];
  return (
    <div className="space-y-6">
      <Panel title="Receive Purchase" description="Recording a purchase updates stock and posts the inventory journal entry.">
        <form onSubmit={submit} className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <Input label="Item name" value={form.item_name} onChange={(value) => set('item_name', value)} required />
          <Input label="Quantity" type="number" min="0.001" value={form.quantity} onChange={(value) => set('quantity', value)} required />
          <Select label="Unit" value={form.unit} onChange={(value) => set('unit', value)} options={UNITS.map((value) => ({ value, label: value }))} />
          <Input label="Unit cost (UGX)" type="number" min="0" value={form.unit_cost} onChange={(value) => set('unit_cost', value)} required />
          <Input label="Supplier" value={form.supplier_name} onChange={(value) => set('supplier_name', value)} required />
          <Select label="Location" value={form.location_id} onChange={(value) => set('location_id', value)} options={locations.map((location) => ({ value: String(location.id), label: location.name }))} required />
          <Select label="Station" value={form.station} onChange={(value) => set('station', value)} options={STATIONS.map((value) => ({ value, label: value }))} />
          <Select label="Payment method" value={form.payment_method} onChange={(value) => set('payment_method', value)} options={['Cash', 'Bank', 'Mobile Money', 'Supplier Credit'].map((value) => ({ value, label: value }))} />
          <Input label="Minimum stock" type="number" min="0" value={form.minimum_stock_level} onChange={(value) => set('minimum_stock_level', value)} />
          <Input label="Receipt number" value={form.receipt_number} onChange={(value) => set('receipt_number', value)} />
          <Input label="Category" value={form.category} onChange={(value) => set('category', value)} />
          <Input label="Notes" value={form.notes} onChange={(value) => set('notes', value)} />
          <div className="md:col-span-2 xl:col-span-3"><SubmitButton disabled={saving}>{saving ? 'Recording…' : 'Record purchase'}</SubmitButton></div>
        </form>
      </Panel>
      {showHistory && <History title="Purchase history" rows={rows} empty="No purchases have been recorded." columns={[
        { label: 'Date', key: 'business_date' },
        { label: 'Receipt', key: 'receipt_number' },
        { label: 'Supplier', key: 'supplier_name' },
        { label: 'Payment', key: 'payment_method' },
        { label: 'Amount', render: (row) => `UGX ${Number(row.total_amount || 0).toLocaleString()}` },
        { label: 'Items', render: (row) => (row.items || []).map((item) => `${item.item_name} (${item.quantity} ${item.unit})`).join(', ') || '—' },
      ]} />}
    </div>
  );
}

function TransferWorkflow({ items, locations, records, onAction }) {
  const [form, setForm] = useState({ source_location_id: '', destination_location_id: '', item_id: '', quantity: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const sourceItems = items.filter((item) => String(item.location_id) === form.source_location_id);
  const selectedItem = sourceItems.find((item) => String(item.id) === form.item_id);

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    const result = await onAction('transfers', {
      source_location_id: Number(form.source_location_id),
      destination_location_id: Number(form.destination_location_id),
      notes: form.notes,
      items: [{ item_id: Number(form.item_id), quantity: Number(form.quantity), unit: selectedItem?.unit || 'kg' }],
    }, 'POST', 'Transfer completed and both stock locations updated.');
    if (result) setForm((current) => ({ ...current, item_id: '', quantity: '', notes: '' }));
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <Panel title="New stock transfer" description="Moves stock from one location to another and records both ledger movements.">
        <form onSubmit={submit} className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <Select label="Source location" value={form.source_location_id} onChange={(value) => setForm((current) => ({ ...current, source_location_id: value, item_id: '' }))} options={locations.map((location) => ({ value: String(location.id), label: location.name }))} required />
          <Select label="Destination location" value={form.destination_location_id} onChange={(value) => set('destination_location_id', value)} options={locations.filter((location) => String(location.id) !== form.source_location_id).map((location) => ({ value: String(location.id), label: location.name }))} required />
          <Select label="Stock item" value={form.item_id} onChange={(value) => set('item_id', value)} options={sourceItems.map((item) => ({ value: String(item.id), label: quantityLabel(item) }))} required />
          <Input label="Quantity" type="number" min="0.001" max={selectedItem?.current_quantity} value={form.quantity} onChange={(value) => set('quantity', value)} required />
          <Input label="Notes" value={form.notes} onChange={(value) => set('notes', value)} />
          <div className="flex items-end"><SubmitButton disabled={saving || !selectedItem || Number(form.quantity) > Number(selectedItem.current_quantity)}>{saving ? 'Transferring…' : 'Complete transfer'}</SubmitButton></div>
        </form>
      </Panel>
      <History title="Transfer history" rows={records.transfers || []} empty="No transfers have been recorded." columns={[
        { label: 'Reference', key: 'reference_number' },
        { label: 'Date', key: 'business_date' },
        { label: 'From', key: 'source_name' },
        { label: 'To', key: 'destination_name' },
        { label: 'Status', key: 'status' },
        { label: 'Items', render: (row) => (row.transfer_items || []).map((item) => `${item.item_name} (${item.quantity} ${item.unit})`).join(', ') || '—' },
      ]} />
    </div>
  );
}

function RecipeWorkflow({ items, records, onAction, station: fixedStation, readOnly = false, canApprove = false }) {
  const [menuName, setMenuName] = useState('');
  const [station, setStation] = useState(fixedStation || 'KITCHEN');
  const [ingredients, setIngredients] = useState([{ ingredient_item_id: '', quantity: '', unit: 'g' }]);
  const [saving, setSaving] = useState(false);
  const changeIngredient = (index, key, value) => setIngredients((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, [key]: value } : row));

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    const payloadIngredients = ingredients.map((row) => {
      const item = items.find((candidate) => String(candidate.id) === row.ingredient_item_id);
      return { ingredient_item_id: item?.id || null, ingredient_name: item?.item_name || '', quantity: Number(row.quantity), unit: row.unit };
    });
    const result = await onAction('recipes', { menu_name: menuName, station: fixedStation || station, ingredients: payloadIngredients }, 'POST', 'Recipe saved as a draft.');
    if (result) {
      setMenuName('');
      setIngredients([{ ingredient_item_id: '', quantity: '', unit: 'g' }]);
    }
    setSaving(false);
  };

  const updateStatus = async (recipe, action, message) => onAction(`recipes/${recipe.id}/${action}`, {}, 'POST', message);
  return (
    <div className="space-y-6">
      {!readOnly && <Panel title="Create recipe" description="Add measured inventory ingredients, then submit and approve the draft before activating it for consumption.">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Input label="Menu item name" value={menuName} onChange={setMenuName} required />
            {fixedStation ? <Input label="Preparation station" value={fixedStation} onChange={() => {}} /> : <Select label="Preparation station" value={station} onChange={setStation} options={STATIONS.map((value) => ({ value, label: value }))} />}
          </div>
          {ingredients.map((ingredient, index) => (
            <div key={index} className="grid items-end gap-3 rounded-lg bg-zinc-50 p-3 md:grid-cols-[2fr_1fr_1fr_auto]">
              <Select label={`Ingredient ${index + 1}`} value={ingredient.ingredient_item_id} onChange={(value) => changeIngredient(index, 'ingredient_item_id', value)} options={items.map((item) => ({ value: String(item.id), label: `${item.item_name} (${item.unit})` }))} required />
              <Input label="Quantity per menu item" type="number" min="0.001" value={ingredient.quantity} onChange={(value) => changeIngredient(index, 'quantity', value)} required />
              <Select label="Unit" value={ingredient.unit} onChange={(value) => changeIngredient(index, 'unit', value)} options={UNITS.map((value) => ({ value, label: value }))} />
              <button type="button" title="Remove ingredient" onClick={() => setIngredients((current) => current.filter((_, rowIndex) => rowIndex !== index))} disabled={ingredients.length === 1} className="h-10 rounded-lg border border-zinc-300 px-3 text-sm font-bold text-zinc-600 disabled:opacity-40">Remove</button>
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setIngredients((current) => [...current, { ingredient_item_id: '', quantity: '', unit: 'g' }])} className="rounded-lg border border-zinc-300 px-3 py-2 text-xs font-bold text-zinc-700">Add ingredient</button>
            <SubmitButton disabled={saving || !items.length}>{saving ? 'Saving…' : 'Save recipe draft'}</SubmitButton>
          </div>
        </form>
      </Panel>}
      <Panel title="Recipe approval queue">
        <div className="space-y-3">
          {(records.recipes || []).filter((recipe) => !fixedStation || String(recipe.station).toUpperCase() === fixedStation).length === 0 ? <p className="py-5 text-center text-sm text-zinc-500">No recipes have been created.</p> : (records.recipes || []).filter((recipe) => !fixedStation || String(recipe.station).toUpperCase() === fixedStation).map((recipe) => (
            <article key={recipe.id} className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="font-bold text-zinc-900">{recipe.menu_name} <span className="ml-2 text-xs font-semibold text-zinc-500">{recipe.station}</span></h3>
                <p className="mt-1 text-xs text-zinc-500">Version {recipe.version_number} · {recipe.status} · {(recipe.ingredients || []).map((ingredient) => `${ingredient.ingredient_name}: ${ingredient.quantity} ${ingredient.unit}`).join(', ')}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {!readOnly && recipe.status === 'DRAFT' && <button type="button" onClick={() => updateStatus(recipe, 'submit', 'Recipe submitted for approval.')} className="rounded-lg bg-amber-100 px-3 py-2 text-xs font-bold text-amber-900">Submit</button>}
                {!readOnly && canApprove && recipe.status === 'SUBMITTED' && <button type="button" onClick={() => updateStatus(recipe, 'approve', 'Recipe approved.')} className="rounded-lg bg-emerald-100 px-3 py-2 text-xs font-bold text-emerald-900">Approve</button>}
                {!readOnly && canApprove && recipe.status === 'APPROVED' && <button type="button" onClick={() => updateStatus(recipe, 'activate', 'Recipe activated for consumption.')} className="rounded-lg bg-zinc-900 px-3 py-2 text-xs font-bold text-white">Activate</button>}
              </div>
            </article>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function ConsumptionWorkflow({ records, onAction, station: fixedStation, readOnly = false }) {
  const [form, setForm] = useState({ menu_name: '', quantity: '1', station: fixedStation || 'KITCHEN' });
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    const response = await onAction('consumption', { items: [{ menu_name: form.menu_name, quantity: Number(form.quantity), station: fixedStation || form.station }] }, 'POST', 'Consumption request processed. Review its result for missing recipes or stock warnings.');
    setResult(response);
    setSaving(false);
  };
  return (
    <div className="space-y-6">
      {!readOnly && <Panel title="Record recipe consumption" description="Consumption uses the active recipe for this menu item and station, reduces its ingredients, and posts COGS.">
        <form onSubmit={submit} className="grid gap-3 md:grid-cols-3">
          <Input label="Menu item name" value={form.menu_name} onChange={(value) => set('menu_name', value)} required />
          <Input label="Quantity sold" type="number" min="1" value={form.quantity} onChange={(value) => set('quantity', value)} required />
          {!fixedStation && <Select label="Station" value={form.station} onChange={(value) => set('station', value)} options={STATIONS.map((value) => ({ value, label: value }))} />}
          <div className="md:col-span-3"><SubmitButton disabled={saving}>{saving ? 'Posting consumption…' : 'Post consumption'}</SubmitButton></div>
        </form>
        {result?.entries && <div className="mt-4 space-y-2">{result.entries.map((entry, index) => (
          <p key={index} className={`rounded-lg px-3 py-2 text-sm ${entry.status && entry.status !== 'CONSUMED' ? 'bg-amber-50 text-amber-900' : 'bg-emerald-50 text-emerald-900'}`}>
            {entry.order_item}: {entry.message || entry.status || `${entry.quantity} ${entry.unit} of ${entry.ingredient}`}
          </p>
        ))}</div>}
      </Panel>}
      <History title="Consumption history" rows={(records.consumption || []).filter((row) => !fixedStation || String(row.station).toUpperCase() === fixedStation)} empty="No consumption has been recorded." columns={[
        { label: 'Date', key: 'business_date' },
        { label: 'Menu item', key: 'menu_name' },
        { label: 'Ingredient', key: 'item_name' },
        { label: 'Quantity', render: (row) => `${row.quantity} ${row.unit}` },
        { label: 'Station', key: 'station' },
        { label: 'Order', key: 'order_id' },
      ]} />
    </div>
  );
}

function WasteWorkflow({ items, records, onAction, station: fixedStation, readOnly = false }) {
  const stationItems = items.filter((item) => !fixedStation || String(item.station).toUpperCase() === fixedStation || (fixedStation === 'KITCHEN' && !['BARMAN', 'BAR', 'BARISTA', 'SHISHA'].includes(String(item.station).toUpperCase())));
  const [form, setForm] = useState({ item_id: '', quantity: '', reason: '', station: fixedStation || 'KITCHEN', notes: '', business_date: today() });
  const [saving, setSaving] = useState(false);
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const selectedItem = items.find((item) => String(item.id) === form.item_id);
  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    const response = await onAction('waste', { ...form, station: fixedStation || form.station, item_id: Number(form.item_id), quantity: Number(form.quantity), unit: selectedItem?.unit || 'kg' }, 'POST', 'Waste recorded and inventory value updated.');
    if (response) setForm((current) => ({ ...current, item_id: '', quantity: '', reason: '', notes: '' }));
    setSaving(false);
  };
  return (
    <div className="space-y-6">
      {!readOnly && <Panel title="Record waste" description="The server rejects a waste quantity greater than available stock and posts the loss to accounting.">
        <form onSubmit={submit} className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <Select label="Stock item" value={form.item_id} onChange={(value) => setForm((current) => ({ ...current, item_id: value, quantity: '' }))} options={stationItems.map((item) => ({ value: String(item.id), label: quantityLabel(item) }))} required />
          <Input label="Quantity wasted" type="number" min="0.001" max={selectedItem?.current_quantity} value={form.quantity} onChange={(value) => set('quantity', value)} required />
          <Input label="Reason" value={form.reason} onChange={(value) => set('reason', value)} required />
          {!fixedStation && <Select label="Station" value={form.station} onChange={(value) => set('station', value)} options={STATIONS.map((value) => ({ value, label: value }))} />}
          <Input label="Business date" type="date" value={form.business_date} onChange={(value) => set('business_date', value)} required />
          <Input label="Notes" value={form.notes} onChange={(value) => set('notes', value)} />
          <div className="md:col-span-2 xl:col-span-3"><SubmitButton disabled={saving || !selectedItem || Number(form.quantity) > Number(selectedItem.current_quantity)}>{saving ? 'Recording…' : 'Record waste'}</SubmitButton></div>
        </form>
      </Panel>}
      <History title="Waste history" rows={(records.waste || []).filter((row) => !fixedStation || String(row.station).toUpperCase() === fixedStation)} empty="No waste has been recorded." columns={[
        { label: 'Date', key: 'business_date' },
        { label: 'Item', key: 'item_name' },
        { label: 'Quantity', render: (row) => `${row.quantity} ${row.unit}` },
        { label: 'Station', key: 'station' },
        { label: 'Reason', key: 'reason' },
        { label: 'Notes', key: 'notes' },
      ]} />
    </div>
  );
}

function CountWorkflow({ items, locations, records, onAction, adjustment = false }) {
  const [form, setForm] = useState({ item_id: '', physical_quantity: '', reason: adjustment ? 'Manual inventory adjustment' : 'Physical stock count', business_date: today() });
  const [saving, setSaving] = useState(false);
  const selectedItem = items.find((item) => String(item.id) === form.item_id);
  const history = adjustment ? records.adjustments || [] : records['stock-counts'] || [];
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    let user = {};
    try {
      user = JSON.parse(localStorage.getItem('kurax_user') || '{}');
    } catch {
      user = {};
    }
    const result = await onAction('stock-counts', {
      item_id: Number(form.item_id),
      location_id: selectedItem?.location_id,
      physical_quantity: Number(form.physical_quantity),
      reason: form.reason,
      business_date: form.business_date,
      counted_by: user.name || 'Accountant',
    }, 'POST', adjustment ? 'Count variance applied as an inventory adjustment.' : 'Physical count saved; any variance was applied to stock.');
    if (result) setForm((current) => ({ ...current, item_id: '', physical_quantity: '' }));
    setSaving(false);
  };
  const locationName = (locationId) => locations.find((location) => String(location.id) === String(locationId))?.name || '—';
  return (
    <div className="space-y-6">
      <Panel title={adjustment ? 'Apply inventory adjustment' : 'Record physical count'} description={adjustment ? 'Enter the verified physical quantity. The difference from system stock is posted as an adjustment.' : 'The physical count updates stock to the counted quantity and records its variance.'}>
        <form onSubmit={submit} className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <Select label="Stock item" value={form.item_id} onChange={(value) => setForm((current) => ({ ...current, item_id: value, physical_quantity: '' }))} options={items.map((item) => ({ value: String(item.id), label: quantityLabel(item) }))} required />
          <Input label="Physical quantity" type="number" min="0" value={form.physical_quantity} onChange={(value) => set('physical_quantity', value)} required />
          <Input label="Reason" value={form.reason} onChange={(value) => set('reason', value)} required />
          <Input label="Business date" type="date" value={form.business_date} onChange={(value) => set('business_date', value)} required />
          <div className="md:col-span-2 xl:col-span-3"><SubmitButton disabled={saving || !selectedItem}>{saving ? 'Saving…' : adjustment ? 'Apply adjustment' : 'Save count'}</SubmitButton></div>
        </form>
      </Panel>
      <History title={adjustment ? 'Adjustment history' : 'Stock count history'} rows={history} empty={adjustment ? 'No stock-count adjustments have been recorded.' : 'No physical counts have been recorded.'} columns={adjustment ? [
        { label: 'Date', key: 'business_date' },
        { label: 'Item', key: 'item_name' },
        { label: 'Location', key: 'location_name' },
        { label: 'Adjustment', render: (row) => `${row.adjustment_type === 'ADJUSTMENT_IN' ? '+' : '-'}${row.quantity}` },
        { label: 'Reason', key: 'reason' },
      ] : [
        { label: 'Date', key: 'business_date' },
        { label: 'Item', key: 'item_name' },
        { label: 'Location', render: (row) => row.location_name || locationName(row.location_id) },
        { label: 'System', render: (row) => row.system_quantity },
        { label: 'Physical', render: (row) => row.physical_quantity },
        { label: 'Variance', render: (row) => Number(row.variance) > 0 ? `+${row.variance}` : row.variance },
        { label: 'Reason', key: 'reason' },
      ]} />
    </div>
  );
}

function ReportsWorkflow({ records }) {
  return (
    <div className="space-y-6">
      <History title="Low-stock items" rows={records['reports/low-stock'] || []} empty="No items are currently below minimum stock." columns={[
        { label: 'Item', key: 'item_name' },
        { label: 'Location', key: 'location_name' },
        { label: 'Current', render: (row) => `${row.current_quantity} ${row.unit}` },
        { label: 'Minimum', render: (row) => `${row.minimum_stock_level} ${row.unit}` },
      ]} />
      <History title="Menu items without active recipes" rows={records['reports/menu-items-without-recipes'] || []} empty="All published menu items have active recipes." columns={[
        { label: 'Menu item', key: 'name' },
        { label: 'Station', key: 'station' },
        { label: 'Category', key: 'category' },
        { label: 'Price', render: (row) => `UGX ${Number(row.price || 0).toLocaleString()}` },
      ]} />
      <History title="Recent inventory transactions" rows={records.transactions || []} empty="No inventory transactions found." columns={[
        { label: 'Date', key: 'business_date' },
        { label: 'Reference', key: 'reference_number' },
        { label: 'Item', key: 'item_name' },
        { label: 'Type', key: 'transaction_type' },
        { label: 'Quantity', render: (row) => `${row.quantity} ${row.unit}` },
        { label: 'Value', render: (row) => `UGX ${Number(row.total_value || 0).toLocaleString()}` },
      ]} />
    </div>
  );
}

export default function InventoryWorkflows({ section, items, locations, records, onAction, station, readOnly = false, canApproveRecipes = false }) {
  if (section === 'purchases') return <PurchaseWorkflow locations={locations} records={records} onAction={onAction} />;
  if (section === 'transfers') return <TransferWorkflow items={items} locations={locations} records={records} onAction={onAction} />;
  if (section === 'recipes') return <RecipeWorkflow items={items} records={records} onAction={onAction} station={station} readOnly={readOnly} canApprove={canApproveRecipes} />;
  if (section === 'consumption') return <ConsumptionWorkflow records={records} onAction={onAction} station={station} readOnly={readOnly} />;
  if (section === 'waste') return <WasteWorkflow items={items} records={records} onAction={onAction} station={station} readOnly={readOnly} />;
  if (section === 'stock-counts') return <CountWorkflow items={items} locations={locations} records={records} onAction={onAction} />;
  if (section === 'adjustments') return <CountWorkflow items={items} locations={locations} records={records} onAction={onAction} adjustment />;
  if (section === 'reports') return <ReportsWorkflow records={records} />;
  return null;
}