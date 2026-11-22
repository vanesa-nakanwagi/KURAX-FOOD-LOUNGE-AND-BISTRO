import React, { useMemo, useState } from 'react';
import { FileSpreadsheet, FileText, Printer, RotateCcw, Trash2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { downloadReportPdf } from '../reportExport';
import Pagination from '../components/Pagination';
import {
  defaultPurchaseConversionFactor,
  inventoryUnitsForStation,
  normalizeInventoryUnit,
  recipeUnitConversionFactor,
  recipeUnitsForItem,
} from './inventoryUnits';
const STATIONS = ['KITCHEN', 'BAR', 'BARISTA'];

function today() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kampala' }).format(new Date());
}

function getInventoryPeriodRange(period, currentDate = today()) {
  const endDate = new Date(`${currentDate}T00:00:00.000Z`);
  if (period === 'yesterday') endDate.setUTCDate(endDate.getUTCDate() - 1);
  const end = endDate.toISOString().slice(0, 10);
  if (period === 'today' || period === 'yesterday') return { start: end, end };
  if (period === 'weekly') {
    const weekday = endDate.getUTCDay() || 7;
    const startDate = new Date(endDate);
    startDate.setUTCDate(startDate.getUTCDate() - weekday + 1);
    return { start: startDate.toISOString().slice(0, 10), end };
  }
  if (period === 'monthly') return { start: `${end.slice(0, 7)}-01`, end };
  return null;
}

function getAccountantName() {
  try {
    return JSON.parse(localStorage.getItem('kurax_user') || '{}').name?.trim() || 'Accountant';
  } catch {
    return 'Accountant';
  }
}

function quantityLabel(item) {
  return `${item.item_name} · ${Number(item.current_quantity || 0)} ${item.unit || 'kg'} · ${item.location_name || 'Unassigned'}`;
}

function normalizeStation(value) {
  const station = String(value || '').trim().toUpperCase();
  if (station === 'CHEF') return 'KITCHEN';
  if (station === 'BARMAN') return 'BAR';
  if (['KITCHEN', 'BAR', 'BARISTA'].includes(station)) return station;
  return '';
}

function itemAssignedToStation(value, targetStation) {
  return String(value || '').split(/[,;|/]+/).some((assignment) => normalizeStation(assignment) === targetStation);
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

function Input({ label, value, onChange, type = 'text', min, max, required = false, placeholder }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-zinc-500">{label}</span>
      <input
        required={required}
        type={type}
        value={value}
        min={min}
        max={max}
        placeholder={placeholder}
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

function RecipeCostingWorkflow({ items, records }) {
  const [search, setSearch] = useState('');
  const [stationFilter, setStationFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const itemById = useMemo(() => new Map(items.map((item) => [String(item.id), item])), [items]);
  const recipeRows = useMemo(() => (records.recipes || []).map((recipe) => {
    let totalCost = 0;
    let missingCostItems = 0;
    const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];

    for (const ingredient of ingredients) {
      const item = itemById.get(String(ingredient.ingredient_item_id));
      const quantity = Number(ingredient.quantity);
      if (!item || !Number.isFinite(quantity) || quantity <= 0 || Number(item.unit_cost || 0) <= 0) {
        missingCostItems += 1;
        continue;
      }

      try {
        const factor = recipeUnitConversionFactor(ingredient.unit || item.unit, item.unit, item);
        const ingredientCost = Number((quantity * factor * Number(item.unit_cost)).toFixed(2));
        if (!Number.isFinite(ingredientCost)) {
          missingCostItems += 1;
          continue;
        }
        totalCost = Number((totalCost + ingredientCost).toFixed(2));
      } catch {
        missingCostItems += 1;
      }
    }

    return {
      ...recipe,
      station_label: normalizeStation(recipe.station) || recipe.station || '—',
      prepared_by: recipe.created_by || recipe.updated_by || 'Not recorded',
      ingredient_count: ingredients.length,
      total_cost: totalCost,
      missing_cost_items: missingCostItems,
      cost_status: !ingredients.length || missingCostItems ? 'REVIEW_REQUIRED' : 'ESTIMATED',
    };
  }), [records.recipes, itemById]);
  const filteredRecipes = recipeRows.filter((recipe) => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query ||
      String(recipe.menu_name || '').toLowerCase().includes(query) ||
      String(recipe.prepared_by || '').toLowerCase().includes(query);
    return matchesSearch && (stationFilter === 'ALL' || recipe.station_label === stationFilter);
  });
  const currentPage = Math.min(page, Math.max(1, Math.ceil(filteredRecipes.length / pageSize)));
  const paginatedRecipes = filteredRecipes.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const currency = (value) => `UGX ${Number(value || 0).toLocaleString('en-UG', { maximumFractionDigits: 2 })}`;

  return (
    <Panel title="Recipe Costing" description="Estimated cost per serving, calculated from each recipe and current inventory item unit costs. Recipes needing missing or incompatible ingredient costs are flagged for review.">
      <div className="mb-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
        <Input label="Search recipe or HOD" value={search} onChange={(value) => { setSearch(value); setPage(1); }} placeholder="Type a recipe or HOD name" />
        <Select label="Department" value={stationFilter} onChange={(value) => { setStationFilter(value); setPage(1); }} options={[
          { value: 'ALL', label: 'All departments' },
          ...STATIONS.map((station) => ({ value: station, label: station })),
        ]} />
      </div>
      <Table columns={[
        { label: 'Recipe', render: (row) => <span className="font-bold text-zinc-900">{row.menu_name}</span> },
        { label: 'Department', key: 'station_label' },
        { label: 'Created by', key: 'prepared_by' },
        { label: 'Ingredients', render: (row) => row.ingredient_count },
        { label: 'Estimated cost / serving', render: (row) => <span className="font-bold">{currency(row.total_cost)}</span> },
        { label: 'Cost status', render: (row) => row.cost_status === 'REVIEW_REQUIRED'
          ? <span className="font-semibold text-amber-700">Review required{row.missing_cost_items ? ` (${row.missing_cost_items} item${row.missing_cost_items === 1 ? '' : 's'})` : ''}</span>
          : <span className="font-semibold text-emerald-700">Estimated</span> },
        { label: 'Recipe status', key: 'status' },
      ]} rows={paginatedRecipes} empty="No recipes found across Kitchen, Bar, and Barista." />
      {filteredRecipes.length > 0 && <Pagination
        page={currentPage}
        pageSize={pageSize}
        totalRecords={filteredRecipes.length}
        onPageChange={setPage}
        onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
      />}
    </Panel>
  );
}

function PurchaseWorkflow({ items, locations, records, onAction }) {
  const [form, setForm] = useState({ item_id: '', item_name: '', quantity: '', stock_unit: 'kg', purchase_unit: 'kg', purchase_conversion_factor: '1', unit_cost: '', supplier_name: '', location_id: '', station: 'KITCHEN', category: 'General', minimum_stock_level: '0', payment_method: 'Cash', receipt_number: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [reversingAll, setReversingAll] = useState(false);
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const stationUnits = inventoryUnitsForStation(form.station);

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    const result = await onAction('purchases', {
      posted_by: getAccountantName(),
      supplier_name: form.supplier_name,
      payment_method: form.payment_method,
      receipt_number: form.receipt_number || undefined,
      notes: form.notes,
      items: [{
        item_id: form.item_id ? Number(form.item_id) : undefined,
        item_name: form.item_name,
        quantity: Number(form.quantity),
        unit: form.purchase_unit,
        stock_unit: form.stock_unit,
        purchase_unit: form.purchase_unit,
        purchase_conversion_factor: form.purchase_conversion_factor,
        unit_cost: Number(form.unit_cost),
        category: form.category,
        minimum_stock_level: Number(form.minimum_stock_level || 0),
        location_id: Number(form.location_id),
        station: form.station,
      }],
    }, 'POST', 'Purchase recorded and inventory updated.');
    if (result) setForm((current) => ({ ...current, item_id: '', item_name: '', quantity: '', unit_cost: '', receipt_number: '', notes: '' }));
    setSaving(false);
  };

  const rows = records.purchases || [];
  const grossPurchaseTotal = rows.reduce((total, row) => total + Number(row.total_amount || 0), 0);
  const reversedPurchaseTotal = rows.reduce((total, row) => total + (row.is_reversed ? Number(row.total_amount || 0) : 0), 0);
  const netPurchaseTotal = grossPurchaseTotal - reversedPurchaseTotal;
  const reversePurchase = async (row) => {
    const receiptNumber = row.receipt_number || row.id;
    if (!window.confirm(`Delete purchase receipt ${receiptNumber}? Its amount will be removed from net purchases and stock/accounting will be reversed. The audit history will be retained.`)) return;
    const reason = window.prompt(`Why are you deleting receipt ${receiptNumber}?`);
    if (!reason?.trim()) return;
    await onAction(
      `purchases/${row.id}/reverse`,
      { reason: reason.trim() },
      'POST',
      'Purchase receipt reversed; stock and accounting have been updated.'
    );
  };
  const reconcileReversedPurchaseStock = async (row) => {
    const receiptNumber = row.receipt_number || row.id;
    if (!window.confirm(`Clear stale stock for already-reversed receipt ${receiptNumber}? This is only allowed when the remaining stock matches that receipt and has no other inventory activity.`)) return;
    const reason = window.prompt(`Why are you reconciling stock for reversed receipt ${receiptNumber}?`);
    if (!reason?.trim()) return;
    await onAction(
      `purchases/${row.id}/reconcile-reversed-stock`,
      { reason: reason.trim() },
      'POST',
      'Stale stock cleared and item deactivated. You can now record the corrected purchase.'
    );
  };
  const receiptsToReverse = rows.filter((row) => !row.is_reversed);
  const reverseAllPurchases = async () => {
    if (!receiptsToReverse.length) return;
    if (!window.confirm(`Reverse all ${receiptsToReverse.length} recorded purchase receipt(s)? This will remove their quantities from stock and reverse their accounting entries.`)) return;
    const reason = window.prompt('Enter the reason for reversing all purchase receipts:');
    if (!reason?.trim()) return;

    setReversingAll(true);
    let reversed = 0;
    const failed = [];
    for (const receipt of receiptsToReverse) {
      const result = await onAction(
        `purchases/${receipt.id}/reverse`,
        { reason: reason.trim() },
        'POST',
        `Receipt ${receipt.receipt_number || receipt.id} reversed.`
      );
      if (result) reversed += 1;
      else failed.push(receipt.receipt_number || String(receipt.id));
    }
    setReversingAll(false);
    window.alert(
      failed.length
        ? `Reversed ${reversed} receipt(s). Could not reverse: ${failed.join(', ')}. Check the error message and resolve stock or accounting-period issues before retrying.`
        : `Successfully reversed all ${reversed} purchase receipt(s).`
    );
  };
  return (
    <div className="space-y-6">
      <Panel title="Receive Purchase" description="Set the packaging factor per item (for example, 24 bottles per crate); purchases normalize stock before updating inventory and accounting.">
        <form onSubmit={submit} className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <Select label="Existing item (optional)" value={form.item_id} onChange={(value) => {
            const item = items.find((entry) => String(entry.id) === value);
            if (!item) {
              setForm((current) => ({ ...current, item_id: '', item_name: '', purchase_unit: current.stock_unit, purchase_conversion_factor: '1' }));
              return;
            }
            setForm((current) => ({
              ...current,
              item_id: value,
              item_name: item.item_name,
              station: normalizeStation(item.station) || current.station,
              stock_unit: normalizeInventoryUnit(item.unit || 'kg'),
              purchase_unit: normalizeInventoryUnit(item.purchase_unit || item.unit || 'kg'),
              purchase_conversion_factor: String(item.purchase_conversion_factor || '1'),
              unit_cost: String(item.unit_cost || ''),
              category: item.category || current.category,
            }));
          }} options={items.map((item) => ({ value: String(item.id), label: quantityLabel(item) }))} />
          <Input label="Item name" value={form.item_name} onChange={(value) => setForm((current) => ({ ...current, item_name: value, item_id: '' }))} required />
          <Input label="Quantity" type="number" min="0.001" value={form.quantity} onChange={(value) => set('quantity', value)} required />
          <Select label="Station" value={form.station} onChange={(value) => {
            const units = inventoryUnitsForStation(value);
            const stockUnit = units.includes(form.stock_unit) ? form.stock_unit : units[0];
            const purchaseUnit = units.includes(form.purchase_unit) ? form.purchase_unit : stockUnit;
            const factor = defaultPurchaseConversionFactor(stockUnit, purchaseUnit);
            setForm((current) => ({
              ...current,
              station: value,
              stock_unit: stockUnit,
              purchase_unit: purchaseUnit,
              purchase_conversion_factor: factor === '' ? '' : String(factor),
            }));
          }} options={STATIONS.map((value) => ({ value, label: value }))} />
          <Select label="Stock unit" value={form.stock_unit} onChange={(value) => {
            const factor = defaultPurchaseConversionFactor(value, form.purchase_unit);
            setForm((current) => ({
              ...current,
              stock_unit: value,
              purchase_unit: factor === '' ? value : current.purchase_unit,
              purchase_conversion_factor: factor === '' ? '1' : String(factor),
            }));
          }} options={stationUnits.map((value) => ({ value, label: value }))} />
          <Select label="Purchase unit" value={form.purchase_unit} onChange={(value) => {
            setForm((current) => ({
              ...current,
              purchase_unit: value,
              purchase_conversion_factor: String(defaultPurchaseConversionFactor(current.stock_unit, value)),
            }));
          }} options={stationUnits.map((value) => ({ value, label: value }))} />
          <Input label={`Stock units per ${form.purchase_unit}`} type="number" min="0.000001" value={form.purchase_conversion_factor} onChange={(value) => set('purchase_conversion_factor', value)} required />
          <Input label="Unit cost (UGX)" type="number" min="0" value={form.unit_cost} onChange={(value) => set('unit_cost', value)} required />
          <Input label="Supplier" value={form.supplier_name} onChange={(value) => set('supplier_name', value)} required />
          <Select label="Location" value={form.location_id} onChange={(value) => set('location_id', value)} options={locations.map((location) => ({ value: String(location.id), label: location.name }))} required />
          <Select label="Payment method" value={form.payment_method} onChange={(value) => set('payment_method', value)} options={['Cash', 'Bank', 'Mobile Money', 'Supplier Credit'].map((value) => ({ value, label: value }))} />
          <Input label="Minimum stock" type="number" min="0" value={form.minimum_stock_level} onChange={(value) => set('minimum_stock_level', value)} />
          <Input label="Receipt number" value={form.receipt_number} onChange={(value) => set('receipt_number', value)} />
          <Input label="Category" value={form.category} onChange={(value) => set('category', value)} />
          <Input label="Notes" value={form.notes} onChange={(value) => set('notes', value)} />
          <div className="md:col-span-2 xl:col-span-3"><SubmitButton disabled={saving}>{saving ? 'Recording…' : 'Record purchase'}</SubmitButton></div>
        </form>
      </Panel>
      <Panel title="Purchase history" description="Reversals are retained in the receipt history and excluded from the net purchase total.">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
            <p className="text-[10px] font-black uppercase tracking-wide text-emerald-800">Net recorded purchases</p>
            <p className="mt-1 text-xl font-black text-emerald-950">UGX {netPurchaseTotal.toLocaleString()}</p>
            <p className="mt-1 text-xs text-emerald-800">Gross: UGX {grossPurchaseTotal.toLocaleString()} · Reversed: UGX {reversedPurchaseTotal.toLocaleString()}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={reverseAllPurchases} disabled={reversingAll || !receiptsToReverse.length} className="inline-flex items-center gap-2 rounded-lg border border-rose-200 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50">
              <RotateCcw size={16} /> {reversingAll ? 'Reversing…' : 'Reverse all receipts'}
            </button>
            <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-white hover:bg-zinc-700">
              <Printer size={16} /> Print purchase report
            </button>
          </div>
        </div>
        <Table rows={rows} empty="No purchases have been recorded." columns={[
        { label: 'Date', key: 'business_date' },
        { label: 'Receipt', key: 'receipt_number' },
        { label: 'Supplier', key: 'supplier_name' },
        { label: 'Payment', key: 'payment_method' },
        { label: 'Amount', render: (row) => <span className={row.is_reversed ? 'line-through text-zinc-400' : ''}>UGX {Number(row.total_amount || 0).toLocaleString()}</span> },
        { label: 'Items', render: (row) => (row.items || []).map((item) => `${item.item_name} (${item.quantity} ${item.unit} → ${item.normalized_stock_quantity ?? item.quantity} ${item.normalized_stock_unit || item.unit})`).join(', ') || '—' },
        { label: 'Status', render: (row) => row.is_reversed ? `Reversed${row.reversal_reason ? `: ${row.reversal_reason}` : ''}` : 'Recorded' },
        { label: 'Action', render: (row) => row.is_reversed
          ? <button type="button" onClick={() => reconcileReversedPurchaseStock(row)} className="inline-flex items-center gap-1 rounded-md border border-amber-200 px-2 py-1 font-bold text-amber-800 hover:bg-amber-50">Reconcile stock</button>
          : <button type="button" onClick={() => reversePurchase(row)} className="inline-flex items-center gap-1 rounded-md border border-rose-200 px-2 py-1 font-bold text-rose-700 hover:bg-rose-50"><Trash2 size={13} /> Delete</button> },
      ]} />
      <div className="purchase-print-area" hidden>
        <h1>Kurax Food Lounge &amp; Bistro</h1>
        <h2>Purchase receipts report</h2>
        <p>Generated: {new Date().toLocaleString()}</p>
        <p>Gross receipts: UGX {grossPurchaseTotal.toLocaleString()}</p>
        <p>Reversed receipts: UGX {reversedPurchaseTotal.toLocaleString()}</p>
        <p><strong>Net recorded purchases: UGX {netPurchaseTotal.toLocaleString()}</strong></p>
        <table>
          <thead><tr><th>Date</th><th>Receipt</th><th>Supplier</th><th>Payment</th><th>Amount (UGX)</th><th>Status</th><th>Items</th></tr></thead>
          <tbody>{rows.map((row) => (
            <tr key={row.id}>
              <td>{row.business_date}</td>
              <td>{row.receipt_number || row.id}</td>
              <td>{row.supplier_name || '—'}</td>
              <td>{row.payment_method || '—'}</td>
              <td>{Number(row.total_amount || 0).toLocaleString()}</td>
              <td>{row.is_reversed ? `Reversed${row.reversal_reason ? `: ${row.reversal_reason}` : ''}` : 'Recorded'}</td>
              <td>{(row.items || []).map((item) => `${item.item_name} (${item.quantity} ${item.unit})`).join(', ')}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .purchase-print-area, .purchase-print-area * { visibility: visible !important; }
          .purchase-print-area { display: block !important; position: absolute; inset: 0; width: 100%; padding: 24px; color: #111; font: 12px Arial, sans-serif; }
          .purchase-print-area h1 { font-size: 20px; font-weight: bold; }
          .purchase-print-area h2 { margin: 8px 0; font-size: 16px; }
          .purchase-print-area table { width: 100%; margin-top: 16px; border-collapse: collapse; }
          .purchase-print-area th, .purchase-print-area td { border: 1px solid #999; padding: 6px; text-align: left; }
          .purchase-print-area th { background: #eee !important; }
        }
      `}</style>
      </Panel>
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

function RecipeWorkflow({ items, menuItems = [], records, onAction, station = 'ALL', canConfigureRecipes = false }) {
  const [search, setSearch] = useState('');
  const [stationFilter, setStationFilter] = useState(station);
  const [menuPage, setMenuPage] = useState(1);
  const [menuPageSize, setMenuPageSize] = useState(10);
  const [selectedMenuId, setSelectedMenuId] = useState('');
  const [ingredients, setIngredients] = useState([]);
  const [saving, setSaving] = useState(false);
  const [editingRecipeId, setEditingRecipeId] = useState('');
  const selectedMenu = menuItems.find((menu) => String(menu.id) === selectedMenuId);
  const menuRecipes = (records.recipes || []).filter((recipe) =>
    String(recipe.menu_item_id || '') === selectedMenuId ||
    (!recipe.menu_item_id && recipe.menu_name?.toLowerCase() === selectedMenu?.name?.toLowerCase())
  );
  const normalizeDepartment = (value) => {
    const department = String(value || '').toUpperCase();
    if (department === 'BARMAN') return 'BAR';
    if (department === 'CHEF') return 'KITCHEN';
    return department;
  };
  const menuStation = normalizeDepartment(selectedMenu?.station);
  const filteredMenus = menuItems.filter((menu) =>
    (stationFilter === 'ALL' || !String(menu.station || '').trim() || normalizeDepartment(menu.station) === normalizeDepartment(stationFilter)) &&
    menu.name.toLowerCase().includes(search.trim().toLowerCase())
  );
  const currentMenuPage = Math.min(menuPage, Math.max(1, Math.ceil(filteredMenus.length / menuPageSize)));
  const paginatedMenus = filteredMenus.slice(
    (currentMenuPage - 1) * menuPageSize,
    currentMenuPage * menuPageSize
  );
  const recipeInventoryItems = items.filter((item) => menuStation && itemAssignedToStation(item.station, menuStation));
  const changeIngredient = (index, key, value) => setIngredients((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, [key]: value } : row));
  const selectMenu = (menu) => {
    setSelectedMenuId(String(menu.id));
    const existing = (records.recipes || []).find((recipe) =>
      String(recipe.menu_item_id || '') === String(menu.id) ||
      (!recipe.menu_item_id && recipe.menu_name?.toLowerCase() === menu.name.toLowerCase())
    );
    setEditingRecipeId(existing ? String(existing.id) : '');
    setIngredients(existing?.ingredients?.length
      ? existing.ingredients.map((ingredient) => ({
        ingredient_item_id: String(ingredient.ingredient_item_id || ''),
        quantity: String(ingredient.quantity || ''),
        unit: normalizeInventoryUnit(ingredient.unit || 'g'),
        ingredient_search: '',
      }))
      : [{ ingredient_item_id: '', quantity: '', unit: 'g', ingredient_search: '' }]);
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!selectedMenu || !menuStation || ingredients.some((ingredient) => !recipeInventoryItems.some((item) => String(item.id) === ingredient.ingredient_item_id))) return;
    setSaving(true);
    const payloadIngredients = ingredients.map((row) => ({ ingredient_item_id: Number(row.ingredient_item_id), quantity: String(row.quantity), unit: row.unit }));
    const recipeToEdit = (records.recipes || []).find((recipe) => String(recipe.id) === editingRecipeId);
    const path = recipeToEdit ? `recipes/${recipeToEdit.id}` : 'recipes';
    const method = recipeToEdit ? 'PUT' : 'POST';
    const result = await onAction(path, { menu_item_id: Number(selectedMenu.id), ingredients: payloadIngredients }, method, 'Recipe saved and is now active.');
    if (result) setEditingRecipeId('');
    setSaving(false);
  };

  const editRecipe = (recipe) => {
    const menu = menuItems.find((item) =>
      String(item.id) === String(recipe.menu_item_id) ||
      (!recipe.menu_item_id && item.name?.toLowerCase() === recipe.menu_name?.toLowerCase())
    );
    if (!menu) return;
    setSelectedMenuId(String(menu.id));
    setEditingRecipeId(String(recipe.id));
    setIngredients(recipe.ingredients?.length
      ? recipe.ingredients.map((ingredient) => ({
        ingredient_item_id: String(ingredient.ingredient_item_id || ''),
        quantity: String(ingredient.quantity || ''),
        unit: normalizeInventoryUnit(ingredient.unit || 'g'),
        ingredient_search: '',
      }))
      : [{ ingredient_item_id: '', quantity: '', unit: 'g', ingredient_search: '' }]);
  };

  const deleteRecipe = async (recipe) => {
    if (!window.confirm(`Remove ${recipe.menu_name} recipe from use?`)) return;
    setSaving(true);
    await onAction(`recipes/${recipe.id}`, {}, 'DELETE', 'Recipe removed from use. Recipe history was preserved.');
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <Panel title="Department menu items" description="Select an existing menu item to view or edit its recipe.">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
          <Input label="Search menu items" value={search} onChange={(value) => { setSearch(value); setMenuPage(1); }} />
          {station === 'ALL' && <Select label="Department" value={stationFilter} onChange={(value) => { setStationFilter(value); setMenuPage(1); }} options={[{ value: 'ALL', label: 'All departments' }, ...STATIONS.map((value) => ({ value, label: value }))]} />}
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {paginatedMenus.map((menu) => (
            <button key={menu.id} type="button" onClick={() => selectMenu(menu)} className={`rounded-lg border p-3 text-left transition ${selectedMenuId === String(menu.id) ? 'border-amber-500 bg-amber-50' : 'border-zinc-200 hover:border-zinc-400'}`}>
              <span className="block font-bold text-zinc-900">{menu.name}</span>
              <span className="mt-1 block text-xs text-zinc-500">{menu.station} · {menu.recipe_status === 'ACTIVE' ? 'Active Recipe' : menu.recipe_status === 'NOT_CONFIGURED' ? 'Recipe Not Configured' : `${menu.recipe_status[0]}${menu.recipe_status.slice(1).toLowerCase()} Recipe`}</span>
            </button>
          ))}
          {!filteredMenus.length && <p className="py-5 text-sm text-zinc-500">No published menu items match this department and search.</p>}
        </div>
        {filteredMenus.length > 0 && <Pagination
          page={currentMenuPage}
          pageSize={menuPageSize}
          totalRecords={filteredMenus.length}
          onPageChange={setMenuPage}
          onPageSizeChange={(size) => { setMenuPageSize(size); setMenuPage(1); }}
        />}
      </Panel>
      {selectedMenu && canConfigureRecipes && <Panel title={`${menuRecipes.length ? 'Update' : 'Configure'} ${selectedMenu.name}`} description="Recipe units follow each inventory item's stock unit. Set liquids to L, packets to pack, or sachets to sachet in Inventory Management; compatible recipe units will appear here.">
        <form onSubmit={submit} className="space-y-4">
          {!menuStation && <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm font-semibold text-amber-900">This menu item has no station assignment. Assign it to Kitchen, Bar, or Barista before configuring a recipe.</p>}
          {menuStation && !recipeInventoryItems.length && <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm font-semibold text-amber-900">No inventory ingredients are assigned to {menuStation}. Assign ingredients to this station before configuring a recipe.</p>}
          {ingredients.map((ingredient, index) => {
            const stockItem = recipeInventoryItems.find((item) => String(item.id) === ingredient.ingredient_item_id);
            const ingredientSearch = String(ingredient.ingredient_search || '').trim().toLowerCase();
            const matchingIngredientItems = recipeInventoryItems.filter((item) =>
              String(item.item_name || '').toLowerCase().includes(ingredientSearch) ||
              String(item.id) === ingredient.ingredient_item_id
            );
            return <div key={index} className="grid items-end gap-3 rounded-lg bg-zinc-50 p-3 md:grid-cols-[2fr_1fr_1fr_auto]">
              <div className="md:col-span-4">
                <Input
                  label={`Find ingredient ${index + 1}`}
                  value={ingredient.ingredient_search || ''}
                  onChange={(value) => changeIngredient(index, 'ingredient_search', value)}
                  placeholder="Type an ingredient name"
                />
              </div>
              <Select label={`Ingredient ${index + 1}`} value={ingredient.ingredient_item_id} onChange={(value) => {
                const chosen = recipeInventoryItems.find((item) => String(item.id) === value);
                setIngredients((current) => current.map((row, rowIndex) => rowIndex === index
                  ? { ...row, ingredient_item_id: value, unit: chosen?.unit || row.unit, ingredient_search: '' }
                  : row));
              }} options={matchingIngredientItems.map((item) => ({ value: String(item.id), label: `${item.item_name} · ${Number(item.current_quantity || 0)} ${item.unit}` }))} required />
              <Input label="Quantity per serving" type="number" min="0.001" value={ingredient.quantity} onChange={(value) => changeIngredient(index, 'quantity', value)} required />
              <Select label="Unit" value={ingredient.unit} onChange={(value) => changeIngredient(index, 'unit', value)} options={(stockItem ? recipeUnitsForItem(stockItem) : []).map((value) => ({ value, label: value }))} />
              <button type="button" title="Remove ingredient" onClick={() => setIngredients((current) => current.filter((_, rowIndex) => rowIndex !== index))} disabled={ingredients.length === 1} className="h-10 rounded-lg border border-zinc-300 px-3 text-sm font-bold text-zinc-600 disabled:opacity-40">Remove</button>
              {ingredientSearch && !matchingIngredientItems.some((item) => item.item_name?.toLowerCase().includes(ingredientSearch)) && <p className="text-xs text-zinc-500 md:col-span-4">No ingredients match “{ingredient.ingredient_search}”.</p>}
              <p className="text-xs text-zinc-500 md:col-span-4">Available: {stockItem ? `${Number(stockItem.current_quantity || 0)} ${stockItem.unit}` : 'Select an inventory item'}</p>
            </div>;
          })}
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => setIngredients((current) => [...current, { ingredient_item_id: '', quantity: '', unit: 'g', ingredient_search: '' }])} disabled={!menuStation || !recipeInventoryItems.length} className="rounded-lg border border-zinc-300 px-3 py-2 text-xs font-bold text-zinc-700 disabled:opacity-40">Add ingredient</button>
            <SubmitButton disabled={saving || !menuStation || !recipeInventoryItems.length || !ingredients.length || ingredients.some((ingredient) => !recipeInventoryItems.some((item) => String(item.id) === ingredient.ingredient_item_id))}>{saving ? 'Saving…' : 'Save recipe'}</SubmitButton>
            {editingRecipeId && <span className="text-sm text-zinc-600">Changes update this recipe.</span>}
          </div>
        </form>
      </Panel>}
      <Panel title="Saved recipes" description="When this menu item is ordered, the active recipe tells us how much stock to use.">
        <div className="space-y-3">
          {(records.recipes || []).length === 0 ? <p className="py-5 text-center text-sm text-zinc-500">No recipes have been created.</p> : (records.recipes || []).map((recipe) => (
            <article key={recipe.id} className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="font-bold text-zinc-900">{recipe.menu_name} <span className="ml-2 text-xs font-semibold text-zinc-500">{recipe.station}</span></h3>
                <p className="mt-1 text-xs text-zinc-500">{recipe.status === 'ACTIVE' ? 'Active · In use' : recipe.status === 'INACTIVE' ? 'Inactive' : 'Draft'} · {(recipe.ingredients || []).map((ingredient) => `${ingredient.ingredient_name}: ${ingredient.quantity} ${ingredient.unit}`).join(', ')}</p>
              </div>
              {canConfigureRecipes && <div className="flex gap-2">
                <button type="button" onClick={() => editRecipe(recipe)} disabled={saving} className="rounded-lg border border-zinc-300 px-3 py-2 text-xs font-bold text-zinc-700 disabled:opacity-40">Edit</button>
                <button type="button" onClick={() => deleteRecipe(recipe)} disabled={saving || recipe.status === 'INACTIVE'} className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700 disabled:opacity-40">Delete</button>
              </div>}
            </article>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function ConsumptionWorkflow({ records, menuItems = [] }) {
  const [search, setSearch] = useState('');
  const [selectedMenuId, setSelectedMenuId] = useState('');
  const searchTerm = search.trim().toLowerCase();
  const matchingMenus = menuItems.filter((menu) => String(menu.name || '').toLowerCase().includes(searchTerm));
  const selectedMenu = menuItems.find((menu) => String(menu.id) === selectedMenuId);
  const menuRecipes = selectedMenu ? (records.recipes || []).filter((recipe) =>
    String(recipe.menu_item_id || '') === selectedMenuId ||
    (!recipe.menu_item_id && recipe.menu_name?.toLowerCase() === selectedMenu.name.toLowerCase())
  ) : [];
  const activeRecipe = menuRecipes.find((recipe) => recipe.status === 'ACTIVE');
  const displayedRecipe = activeRecipe || menuRecipes[0];
  const consumptionRows = (records.consumption || []).filter((row) =>
    !selectedMenu || row.menu_name?.toLowerCase() === selectedMenu.name.toLowerCase()
  );
  return (
    <div className="space-y-6">
      <Panel title="Search recipe" description="Search by menu item name to view its recipe. Paid orders and approved credit items consume ingredients automatically.">
        <Input label="Menu item name" value={search} onChange={(value) => {
          setSearch(value);
          setSelectedMenuId('');
        }} />
        {searchTerm && <div className="mt-3 max-h-56 overflow-y-auto rounded-lg border border-zinc-200">
          {matchingMenus.length ? matchingMenus.map((menu) => (
            <button key={menu.id} type="button" onClick={() => setSelectedMenuId(String(menu.id))} className={`block w-full border-b border-zinc-100 px-3 py-2 text-left last:border-b-0 hover:bg-amber-50 ${selectedMenuId === String(menu.id) ? 'bg-amber-50' : ''}`}>
              <span className="block text-sm font-bold text-zinc-900">{menu.name}</span>
              <span className="block text-xs text-zinc-500">{menu.station || 'No department'} · {menu.recipe_status === 'ACTIVE' ? 'Active recipe' : menu.recipe_status === 'NOT_CONFIGURED' ? 'Recipe not configured' : `${menu.recipe_status[0]}${menu.recipe_status.slice(1).toLowerCase()} recipe`}</span>
            </button>
          )) : <p className="px-3 py-4 text-sm text-zinc-500">No menu items match that name.</p>}
        </div>}
        {selectedMenu && <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
          <h3 className="font-bold text-zinc-900">{selectedMenu.name}</h3>
          {activeRecipe ? (
            <ul className="mt-2 space-y-1 text-sm text-zinc-700">
              {(activeRecipe.ingredients || []).map((ingredient, index) => (
                <li key={ingredient.id || `${ingredient.ingredient_item_id}-${index}`}>
                  {ingredient.ingredient_name || 'Ingredient'}: {ingredient.quantity} {ingredient.unit}
                </li>
              ))}
            </ul>
          ) : <p className="mt-2 text-sm text-amber-800">{displayedRecipe ? `No active recipe. The latest version is ${displayedRecipe.status.toLowerCase()}.` : 'No recipe has been configured for this menu item.'}</p>}
        </div>}
      </Panel>
      <History title="Consumption history" rows={consumptionRows} empty={selectedMenu ? 'No consumption has been recorded for this menu item.' : 'No consumption has been recorded.'} columns={[
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

function WasteWorkflow({ items, records, onAction, station = 'ALL' }) {
  const [form, setForm] = useState({ item_id: '', quantity: '', unit: 'kg', reason: '', station: station === 'ALL' ? 'KITCHEN' : station, notes: '', business_date: today() });
  const [saving, setSaving] = useState(false);
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const normalizedStation = (value) => String(value || '').toUpperCase() === 'BARMAN' ? 'BAR' : String(value || '').toUpperCase();
  const availableItems = items.filter((item) => station === 'ALL' || !item.station || normalizedStation(item.station) === normalizedStation(station) || String(item.location_name || '').trim().toUpperCase() === 'MAIN STORE');
  const selectedItem = availableItems.find((item) => String(item.id) === form.item_id);
  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    const response = await onAction('waste', { ...form, item_id: Number(form.item_id), quantity: Number(form.quantity), posted_by: getAccountantName() }, 'POST', 'Waste recorded and inventory value updated.');
    if (response) setForm((current) => ({ ...current, item_id: '', quantity: '', reason: '', notes: '' }));
    setSaving(false);
  };
  let maxWaste = Number(selectedItem?.current_quantity || 0);
  if (selectedItem) {
    try {
      maxWaste *= recipeUnitConversionFactor(selectedItem.unit, form.unit, selectedItem);
    } catch {
      maxWaste = 0;
    }
  }
  return (
    <div className="space-y-6">
      <Panel title="Record waste" description="The server rejects a waste quantity greater than available stock and posts the loss to accounting.">
        <form onSubmit={submit} className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <Select label="Stock item" value={form.item_id} onChange={(value) => {
            const item = availableItems.find((entry) => String(entry.id) === value);
            setForm((current) => ({ ...current, item_id: value, quantity: '', unit: item?.unit || 'kg' }));
          }} options={availableItems.map((item) => ({ value: String(item.id), label: quantityLabel(item) }))} required />
          <Input label="Quantity wasted" type="number" min="0.001" max={maxWaste} value={form.quantity} onChange={(value) => set('quantity', value)} required />
          <Select label="Unit" value={form.unit} onChange={(value) => set('unit', value)} options={selectedItem
            ? [...new Set([normalizeInventoryUnit(selectedItem.unit), normalizeInventoryUnit(selectedItem.purchase_unit)])].map((value) => ({ value, label: value }))
            : []} required />
          <Input label="Reason" value={form.reason} onChange={(value) => set('reason', value)} required />
          {station === 'ALL' && <Select label="Station" value={form.station} onChange={(value) => set('station', value)} options={STATIONS.map((value) => ({ value, label: value }))} />}
          <Input label="Business date" type="date" value={form.business_date} onChange={(value) => set('business_date', value)} required />
          <Input label="Notes" value={form.notes} onChange={(value) => set('notes', value)} />
          <div className="md:col-span-2 xl:col-span-3"><SubmitButton disabled={saving || !selectedItem || Number(form.quantity) > maxWaste}>{saving ? 'Recording…' : 'Record waste'}</SubmitButton></div>
        </form>
      </Panel>
      <History title="Waste history" rows={records.waste || []} empty="No waste has been recorded." columns={[
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
    const result = await onAction('stock-counts', {
      item_id: Number(form.item_id),
      location_id: selectedItem?.location_id,
      physical_quantity: Number(form.physical_quantity),
      reason: form.reason,
      business_date: form.business_date,
      counted_by: getAccountantName(),
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

function ReportsWorkflow({ records, onAction }) {
  const businessToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kampala' }).format(new Date());
  const [dateRange, setDateRange] = useState({ start: businessToday, end: businessToday });
  const [selectedPeriod, setSelectedPeriod] = useState('today');
  const [inventoryReport, setInventoryReport] = useState(records['reports/inventory-activity'] || null);
  const [loadingReport, setLoadingReport] = useState(false);
  const runReports = async (range = dateRange) => {
    setLoadingReport(true);
    try {
      const query = new URLSearchParams({ startDate: range.start, endDate: range.end });
      const activityResult = await onAction(`reports/inventory-activity?${query}`, {}, 'GET', 'Inventory report refreshed.');
      if (activityResult) setInventoryReport(activityResult);
    } finally {
      setLoadingReport(false);
    }
  };
  const loadReport = async (event) => {
    event.preventDefault();
    setSelectedPeriod('custom');
    await runReports(dateRange);
  };
  const selectPeriod = async (period) => {
    setSelectedPeriod(period);
    if (period === 'custom') return;
    const range = getInventoryPeriodRange(period, businessToday);
    setDateRange(range);
    await runReports(range);
  };
  const inventoryReportSections = inventoryReport ? [
    {
      title: 'Inventory activity summary',
      columns: ['Metric', 'Count', 'Quantity', 'Value (UGX)'],
      rows: [
        ...Object.entries(inventoryReport.totalsByType || {}).map(([type, totals]) => [type, totals.count, totals.quantity, totals.value]),
        ['Net purchases', '', '', inventoryReport.netPurchases],
        ['Current inventory value', '', '', inventoryReport.inventoryValue],
        ['Transactions', inventoryReport.transactionCount, '', ''],
      ],
    },
    {
      title: 'Inventory transactions',
      columns: ['Date', 'Reference', 'Item', 'Type', 'Quantity', 'Unit', 'Unit cost (UGX)', 'Value (UGX)', 'Department', 'From', 'To', 'Supplier', 'Notes'],
      rows: (inventoryReport.transactions || []).map((row) => [
        row.business_date, row.reference_number, row.item_name, row.transaction_type,
        row.quantity, row.unit, row.unit_cost, row.total_value, row.station,
        row.source_location, row.destination_location, row.supplier_name, row.notes,
      ]),
    },
    {
      title: 'Current stock snapshot',
      columns: ['Item', 'Department', 'Location', 'Quantity', 'Unit', 'Unit cost (UGX)', 'Inventory value (UGX)', 'Supplier'],
      rows: (inventoryReport.currentStock || []).map((row) => [
        row.item_name, row.station, row.location_name, row.current_quantity, row.unit,
        row.unit_cost, row.inventory_value, row.supplier_name,
      ]),
    },
  ] : [];
  const exportInventoryExcel = () => {
    if (!inventoryReport) return;
    const workbook = XLSX.utils.book_new();
    for (const section of inventoryReportSections) {
      const sheet = XLSX.utils.aoa_to_sheet([[section.title], section.columns, ...section.rows]);
      sheet['!cols'] = section.columns.map((column) => ({ wch: Math.min(32, Math.max(14, column.length + 2)) }));
      XLSX.utils.book_append_sheet(workbook, sheet, section.title.slice(0, 31));
    }
    XLSX.writeFile(workbook, `inventory_report_${inventoryReport.startDate}_to_${inventoryReport.endDate}.xlsx`);
  };
  const exportInventoryPdf = () => {
    if (!inventoryReport) return;
    downloadReportPdf({
      filename: `inventory_report_${inventoryReport.startDate}_to_${inventoryReport.endDate}.pdf`,
      title: 'Inventory Activity Report',
      from: inventoryReport.startDate,
      to: inventoryReport.endDate,
      periodText: `Business activity: ${inventoryReport.startDate} to ${inventoryReport.endDate} · Current stock snapshot generated ${new Date(inventoryReport.generatedAt).toLocaleString()}`,
      companyName: 'KURAX FOOD LOUNGE AND BISTRO',
      footerLabel: 'Inventory Report',
      orientation: 'landscape',
      sections: inventoryReportSections,
    });
  };

  return (
    <div className="space-y-6">
      <Panel title="Inventory activity report" description="Review dated stock movements and download Excel or PDF reports. Current stock is shown as a snapshot at report time.">
        <div className="mb-4 flex flex-wrap gap-2">
          {[
            ['today', 'Today'],
            ['yesterday', 'Yesterday'],
            ['weekly', 'Weekly'],
            ['monthly', 'Monthly'],
            ['custom', 'Custom'],
          ].map(([period, label]) => (
            <button
              key={period}
              type="button"
              onClick={() => selectPeriod(period)}
              className={`rounded-lg px-3 py-2 text-xs font-bold ${selectedPeriod === period ? 'bg-zinc-900 text-white' : 'border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <form onSubmit={loadReport} className="mb-5 flex flex-wrap items-end gap-3">
          <Input label="Start date" type="date" value={dateRange.start} onChange={(value) => { setSelectedPeriod('custom'); setDateRange((current) => ({ ...current, start: value })); }} required />
          <Input label="End date" type="date" value={dateRange.end} onChange={(value) => { setSelectedPeriod('custom'); setDateRange((current) => ({ ...current, end: value })); }} required />
          <SubmitButton disabled={loadingReport}>{loadingReport ? 'Loading…' : 'Run report'}</SubmitButton>
          <button type="button" disabled={!inventoryReport || loadingReport} onClick={exportInventoryExcel} className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-emerald-800 disabled:opacity-50">
            <FileSpreadsheet size={16} /> Download Excel
          </button>
          <button type="button" disabled={!inventoryReport || loadingReport} onClick={exportInventoryPdf} className="inline-flex items-center gap-2 rounded-lg border border-rose-300 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-rose-800 disabled:opacity-50">
            <FileText size={16} /> Download PDF
          </button>
        </form>
        {inventoryReport && <>
          <p className="mb-4 text-xs text-zinc-500">Activity: {inventoryReport.startDate} to {inventoryReport.endDate} · Generated {new Date(inventoryReport.generatedAt).toLocaleString()}</p>
          <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="border-l-2 border-emerald-500 bg-zinc-50 px-4 py-3"><p className="text-[10px] font-black uppercase text-zinc-500">Net purchases</p><p className="mt-1 text-lg font-black">UGX {Number(inventoryReport.netPurchases || 0).toLocaleString()}</p></div>
            <div className="border-l-2 border-amber-500 bg-zinc-50 px-4 py-3"><p className="text-[10px] font-black uppercase text-zinc-500">Current inventory value</p><p className="mt-1 text-lg font-black">UGX {Number(inventoryReport.inventoryValue || 0).toLocaleString()}</p></div>
            <div className="border-l-2 border-sky-500 bg-zinc-50 px-4 py-3"><p className="text-[10px] font-black uppercase text-zinc-500">Stock movements</p><p className="mt-1 text-lg font-black">{Number(inventoryReport.transactionCount || 0).toLocaleString()}</p></div>
          </div>
          <div className="grid gap-5">
            <History title="Inventory transactions in period" rows={inventoryReport.transactions || []} empty="No inventory transactions in this period." columns={[
              { label: 'Date', key: 'business_date' },
              { label: 'Reference', key: 'reference_number' },
              { label: 'Item', key: 'item_name' },
              { label: 'Type', key: 'transaction_type' },
              { label: 'Quantity', render: (row) => `${row.quantity} ${row.unit}` },
              { label: 'Value', render: (row) => `UGX ${Number(row.total_value || 0).toLocaleString()}` },
              { label: 'Department', key: 'station' },
            ]} />
            <History title="Current stock snapshot" rows={inventoryReport.currentStock || []} empty="No active inventory items." columns={[
              { label: 'Item', key: 'item_name' },
              { label: 'Department', key: 'station' },
              { label: 'Location', key: 'location_name' },
              { label: 'Current quantity', render: (row) => `${row.current_quantity} ${row.unit}` },
              { label: 'Value', render: (row) => `UGX ${Number(row.inventory_value || 0).toLocaleString()}` },
            ]} />
          </div>
        </>}
      </Panel>
      <History title="Menu items without active recipes" rows={records['reports/menu-items-without-recipes'] || []} empty="All published menu items have active recipes." columns={[
        { label: 'Menu item', key: 'name' },
        { label: 'Station', key: 'station' },
        { label: 'Category', key: 'category' },
        { label: 'Price', render: (row) => `UGX ${Number(row.price || 0).toLocaleString()}` },
      ]} />
    </div>
  );
}

export default function InventoryWorkflows({ section, items, menuItems, locations, records, onAction, station, canConfigureRecipes = false }) {
  if (section === 'purchases') return <PurchaseWorkflow items={items} locations={locations} records={records} onAction={onAction} />;
  if (section === 'transfers') return <TransferWorkflow items={items} locations={locations} records={records} onAction={onAction} />;
  if (section === 'recipes') return <RecipeWorkflow items={items} menuItems={menuItems} records={records} onAction={onAction} station={station} canConfigureRecipes={canConfigureRecipes} />;
  if (section === 'recipe-costing') return <RecipeCostingWorkflow items={items} records={records} />;
  if (section === 'consumption') return <ConsumptionWorkflow records={records} menuItems={menuItems} />;
  if (section === 'waste') return <WasteWorkflow items={items} records={records} onAction={onAction} station={station} />;
  if (section === 'stock-counts') return <CountWorkflow items={items} locations={locations} records={records} onAction={onAction} />;
  if (section === 'adjustments') return <CountWorkflow items={items} locations={locations} records={records} onAction={onAction} adjustment />;
  if (section === 'reports') return <ReportsWorkflow records={records} onAction={onAction} />;
  return null;
}