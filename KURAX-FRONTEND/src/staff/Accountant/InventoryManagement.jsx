import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowRightLeft, Boxes, Package, Plus, TrendingUp } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import API_URL from '../../config/api';
import InventoryWorkflows from './InventoryWorkflows';

const defaultForm = {
  item_name: '',
  quantity: '0',
  unit: 'kg',
  unit_cost: '0',
  supplier_name: 'KURAX PRIMARY SUPPLIER',
  location_name: 'MAIN STORE',
  station: 'KITCHEN',
  category: 'General',
  minimum_stock_level: '0',
};

const INVENTORY_SECTIONS = [
  { slug: '', label: 'Inventory Dashboard' },
  { slug: 'items', label: 'Inventory Items' },
  { slug: 'main-store', label: 'Main Store' },
  { slug: 'kitchen', label: 'Kitchen' },
  { slug: 'bar', label: 'Bar' },
  { slug: 'barista', label: 'Barista' },
  { slug: 'purchases', label: 'Purchases' },
  { slug: 'transfers', label: 'Transfers' },
  { slug: 'recipes', label: 'Recipes' },
  { slug: 'consumption', label: 'Consumption' },
  { slug: 'waste', label: 'Waste' },
  { slug: 'stock-counts', label: 'Stock Counts' },
  { slug: 'adjustments', label: 'Adjustments' },
  { slug: 'valuation', label: 'Valuation' },
  { slug: 'reports', label: 'Inventory Reports' },
];

function currency(value) {
  const number = Number(value || 0);
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency: 'UGX',
    maximumFractionDigits: 0,
  }).format(number);
}

function staffAuthHeaders() {
  try {
    const token = JSON.parse(localStorage.getItem('kurax_user') || '{}').token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

export default function InventoryManagement() {
  const location = useLocation();
  const navigate = useNavigate();
  const selectedSlug = location.pathname.replace('/accountant/inventory', '').split('/').filter(Boolean)[0] || '';
  const currentSection = INVENTORY_SECTIONS.find((section) => section.slug === selectedSlug) || INVENTORY_SECTIONS[0];
  const [stats, setStats] = useState({
    total_inventory_value: 0,
    total_items: 0,
    low_stock_items: 0,
    out_of_stock_items: 0,
    total_purchases: 0,
    total_consumption: 0,
    total_waste: 0,
  });
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [locations, setLocations] = useState([]);
  const [relatedData, setRelatedData] = useState({});
  const [actionMessage, setActionMessage] = useState('');
  const [actionError, setActionError] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [dashboardRes, itemsRes, locationsRes] = await Promise.all([
        fetch(`${API_URL}/api/inventory/dashboard`),
        fetch(`${API_URL}/api/inventory/items`),
        fetch(`${API_URL}/api/inventory/locations`),
      ]);

      const dashboard = dashboardRes.ok ? await dashboardRes.json() : {};
      const collectedItems = itemsRes.ok ? await itemsRes.json() : [];
      const collectedLocations = locationsRes.ok ? await locationsRes.json() : [];

      setStats({
        total_inventory_value: Number(dashboard.total_inventory_value || 0),
        total_items: Number(dashboard.total_items || 0),
        low_stock_items: Number(dashboard.low_stock_items || 0),
        out_of_stock_items: Number(dashboard.out_of_stock_items || 0),
        total_purchases: Number(dashboard.total_purchases || 0),
        total_consumption: Number(dashboard.total_consumption || 0),
        total_waste: Number(dashboard.total_waste || 0),
      });
      setItems(collectedItems);
      setLocations(collectedLocations);
    } catch (error) {
      console.error('Inventory dashboard load failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRelatedData = async () => {
    const endpointsBySection = {
      purchases: ['purchases'],
      transfers: ['transfers'],
      recipes: ['recipes?station=ALL', 'recipes/menu-items?station=ALL'],
      consumption: ['consumption'],
      waste: ['waste'],
      'stock-counts': ['stock-counts'],
      adjustments: ['adjustments'],
      reports: ['reports/low-stock', 'reports/menu-items-without-recipes', 'reports/cogs', 'transactions'],
    };
    const endpoints = endpointsBySection[currentSection.slug] || [];
    const entries = await Promise.all(endpoints.map(async (endpoint) => {
      try {
        const response = await fetch(`${API_URL}/api/inventory/${endpoint}`, { headers: staffAuthHeaders() });
        if (!response.ok) throw new Error(`Unable to load ${endpoint}.`);
        const key = endpoint.startsWith('recipes?') ? 'recipes' : endpoint;
        return [key, await response.json()];
      } catch (error) {
        console.error(`Inventory ${endpoint} history load failed:`, error);
        return [endpoint, []];
      }
    }));
    setRelatedData(Object.fromEntries(entries));
  };

  const runInventoryAction = async (path, payload, method, successMessage) => {
    setActionMessage('');
    setActionError('');
    try {
      const response = await fetch(`${API_URL}/api/inventory/${path}`, {
        method: method || 'POST',
        headers: { ...staffAuthHeaders(), 'Content-Type': 'application/json' },
        ...(method === 'GET' ? {} : { body: JSON.stringify(payload || {}) }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Inventory request failed.');
      setActionMessage(successMessage || 'Inventory updated.');
      await Promise.all([loadData(), loadRelatedData()]);
      return result;
    } catch (error) {
      setActionError(error.message || 'Inventory request failed.');
      return null;
    }
  };

  useEffect(() => {
    loadData();
    loadRelatedData();
  }, [currentSection.slug]);

  const lowStockItems = useMemo(
    () => items.filter((item) => String(item.stock_status || '').includes('LOW') || Number(item.current_quantity || 0) <= Number(item.minimum_stock_level || 0)),
    [items]
  );
  const visibleItems = useMemo(() => {
    if (currentSection.slug === 'main-store') return items.filter((item) => String(item.location_name || '').toLowerCase() === 'main store');
    if (['kitchen', 'bar', 'barista'].includes(currentSection.slug)) return items.filter((item) => String(item.station || '').toLowerCase() === currentSection.slug);
    if (currentSection.slug === 'reports') return lowStockItems;
    return items;
  }, [currentSection.slug, items, lowStockItems]);
  const isStockSection = ['', 'items', 'main-store', 'kitchen', 'bar', 'barista', 'valuation'].includes(currentSection.slug);
  const showPurchaseForm = currentSection.slug === '';
  const workflowSections = ['purchases', 'transfers', 'recipes', 'consumption', 'waste', 'stock-counts', 'adjustments', 'reports'];

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);

    try {
      const payload = {
        supplier_name: form.supplier_name || 'KURAX PRIMARY SUPPLIER',
        payment_method: 'Cash',
        items: [{
          item_name: form.item_name,
          quantity: Number(form.quantity || 0),
          unit: form.unit,
          unit_cost: Number(form.unit_cost || 0),
          category: form.category,
          minimum_stock_level: Number(form.minimum_stock_level || 0),
          location_name: form.location_name,
          station: form.station,
        }],
      };
      const response = await fetch(`${API_URL}/api/inventory/purchases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Purchase failed.');
      }

      setForm(defaultForm);
      await Promise.all([loadData(), loadRelatedData()]);
      alert('Purchase recorded successfully.');
    } catch (error) {
      alert(error.message || 'Unable to record purchase.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-[#f5f3ee] p-5 text-zinc-900">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-yellow-600">Accountant</p>
            <h1 className="mt-2 text-3xl font-black uppercase italic tracking-tight">{currentSection.label}</h1>
          </div>
          <button
            type="button"
            onClick={loadData}
            className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-xs font-black uppercase tracking-widest text-zinc-800 shadow-sm"
          >
            Refresh Data
          </button>
        </div>

        <nav aria-label="Inventory sections" className="mb-6 flex gap-2 overflow-x-auto border-b border-zinc-200 pb-3">
          {INVENTORY_SECTIONS.map((section) => {
            const isActive = section.slug === currentSection.slug;
            return (
              <button
                key={section.slug || 'dashboard'}
                type="button"
                aria-current={isActive ? 'page' : undefined}
                onClick={() => navigate(section.slug ? `/accountant/inventory/${section.slug}` : '/accountant/inventory')}
                className={`shrink-0 rounded-lg px-3 py-2 text-xs font-bold transition-colors ${isActive ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-600 hover:bg-zinc-100'}`}
              >
                {section.label}
              </button>
            );
          })}
        </nav>

        {['', 'valuation'].includes(currentSection.slug) && <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={<Boxes size={18} />} label="Inventory Value" value={currency(stats.total_inventory_value)} accent="amber" />
          <StatCard icon={<Package size={18} />} label="Items" value={String(stats.total_items)} accent="slate" />
          <StatCard icon={<AlertTriangle size={18} />} label="Low Stock" value={String(stats.low_stock_items)} accent="rose" />
          <StatCard icon={<TrendingUp size={18} />} label="Purchases" value={currency(stats.total_purchases)} accent="emerald" />
        </div>}

        {actionError && <p role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{actionError}</p>}
        {actionMessage && <p role="status" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{actionMessage}</p>}

        {workflowSections.includes(currentSection.slug) ? (
          <InventoryWorkflows
            section={currentSection.slug}
            items={items}
            menuItems={relatedData['recipes/menu-items?station=ALL'] || []}
            locations={locations}
            records={relatedData}
            onAction={runInventoryAction}
            station="ALL"
          />
        ) : (
        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          {isStockSection && <>
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-black uppercase tracking-tight">Inventory Stock</h2>
              <span className="rounded-full bg-zinc-100 px-2 py-1 text-[9px] font-black uppercase tracking-[0.2em] text-zinc-600">
                {visibleItems.length} items
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead className="bg-zinc-100 text-zinc-700">
                  <tr>
                    <th className="px-3 py-2 font-black uppercase tracking-wide">Item</th>
                    <th className="px-3 py-2 font-black uppercase tracking-wide">Qty</th>
                    <th className="px-3 py-2 font-black uppercase tracking-wide">Unit</th>
                    <th className="px-3 py-2 font-black uppercase tracking-wide">Value</th>
                    <th className="px-3 py-2 font-black uppercase tracking-wide">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-zinc-500">Loading inventory…</td>
                    </tr>
                  ) : visibleItems.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-zinc-500">No inventory items found.</td>
                    </tr>
                  ) : (
                    visibleItems.map((item) => (
                      <tr key={item.id} className="border-b border-zinc-100 align-top">
                        <td className="px-3 py-3">
                          <div className="font-bold text-zinc-800">{item.item_name}</div>
                          <div className="text-[10px] text-zinc-500">{item.location_name || 'Main Store'} · {item.station || 'KITCHEN'}</div>
                        </td>
                        <td className="px-3 py-3 font-semibold text-zinc-700">{Number(item.current_quantity || 0)} {item.unit || 'kg'}</td>
                        <td className="px-3 py-3 text-zinc-600">{item.unit || 'kg'}</td>
                        <td className="px-3 py-3 font-bold text-zinc-800">{currency(item.inventory_value || 0)}</td>
                        <td className="px-3 py-3">
                          <span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-widest ${
                            item.stock_status === 'OUT OF STOCK' ? 'bg-rose-100 text-rose-700' : item.stock_status === 'LOW STOCK' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                          }`}>
                            {item.stock_status || 'IN STOCK'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
          </>}

          {showPurchaseForm && <>
          <div className="space-y-6 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-amber-100 p-2 text-amber-700"><Plus size={18} /></div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-zinc-500">Goods received</p>
                <h2 className="text-lg font-black uppercase tracking-tight">New Purchase</h2>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <Input label="Item name" value={form.item_name} onChange={(value) => setForm((current) => ({ ...current, item_name: value }))} />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Quantity" type="number" value={form.quantity} onChange={(value) => setForm((current) => ({ ...current, quantity: value }))} />
                <Select label="Unit" value={form.unit} onChange={(value) => setForm((current) => ({ ...current, unit: value }))} options={['kg', 'g', 'litre', 'ml', 'piece', 'packet', 'box', 'bottle', 'slice']} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Unit cost" type="number" value={form.unit_cost} onChange={(value) => setForm((current) => ({ ...current, unit_cost: value }))} />
                <Input label="Min stock" type="number" value={form.minimum_stock_level} onChange={(value) => setForm((current) => ({ ...current, minimum_stock_level: value }))} />
              </div>
              <Input label="Supplier" value={form.supplier_name} onChange={(value) => setForm((current) => ({ ...current, supplier_name: value }))} />
              <div className="grid grid-cols-2 gap-3">
                <Select label="Location" value={form.location_name} onChange={(value) => setForm((current) => ({ ...current, location_name: value }))} options={['MAIN STORE', 'KITCHEN', 'BAR', 'BARISTA']} />
                <Select label="Station" value={form.station} onChange={(value) => setForm((current) => ({ ...current, station: value }))} options={['KITCHEN', 'BAR', 'BARISTA']} />
              </div>
              <button
                type="submit"
                disabled={saving || !form.item_name || !Number(form.quantity)}
                className="w-full rounded-xl bg-zinc-900 px-4 py-3 text-xs font-black uppercase tracking-[0.25em] text-white disabled:cursor-not-allowed disabled:bg-zinc-300"
              >
                {saving ? 'Recording Purchase...' : 'Record Purchase'}
              </button>
            </form>

            <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-4">
              <div className="mb-3 flex items-center gap-2 text-zinc-700">
                <ArrowRightLeft size={16} />
                <p className="text-[10px] font-black uppercase tracking-[0.2em]">Operational summary</p>
              </div>
              <div className="space-y-2 text-xs">
                <SummaryRow label="Low stock items" value={String(lowStockItems.length)} />
                <SummaryRow label="Out of stock" value={String(stats.out_of_stock_items)} />
                <SummaryRow label="Consumption" value={currency(stats.total_consumption)} />
                <SummaryRow label="Waste" value={currency(stats.total_waste)} />
              </div>
            </div>
          </div>
          </>}

        </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, accent }) {
  const colors = {
    amber: 'bg-amber-100 text-amber-700',
    slate: 'bg-slate-100 text-slate-700',
    rose: 'bg-rose-100 text-rose-700',
    emerald: 'bg-emerald-100 text-emerald-700',
  };

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">{label}</p>
          <p className="mt-2 text-2xl font-black tracking-tight text-zinc-900">{value}</p>
        </div>
        <div className={`rounded-xl p-2 ${colors[accent] || colors.amber}`}>{icon}</div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-white px-2 py-2 text-zinc-700">
      <span>{label}</span>
      <span className="font-bold text-zinc-900">{value}</span>
    </div>
  );
}

function Input({ label, value, onChange, type = 'text' }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.18em] text-zinc-500">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-800 outline-none ring-0 transition focus:border-zinc-500"
      />
    </label>
  );
}

function Select({ label, value, onChange, options = [] }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.18em] text-zinc-500">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-800 outline-none transition focus:border-zinc-500"
      >
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}
