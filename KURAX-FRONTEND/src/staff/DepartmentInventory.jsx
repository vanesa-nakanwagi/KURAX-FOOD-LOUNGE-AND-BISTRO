import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ClipboardList, CookingPot, Trash2 } from 'lucide-react';
import API_URL from '../config/api';
import InventoryWorkflows from './Accountant/InventoryWorkflows';

const DEPARTMENTS = {
  kitchen: { label: 'Kitchen', station: 'KITCHEN', hodRole: 'KITCHEN_HOD', staffRole: 'CHEF', home: '/kitchen' },
  bar: { label: 'Bar', station: 'BARMAN', hodRole: 'BAR_HOD', staffRole: 'BARMAN', home: '/barman' },
  barista: { label: 'Barista', station: 'BARISTA', hodRole: 'BARISTA_HOD', staffRole: 'BARISTA', home: '/barista' },
};

const WORKFLOWS = [
  ['recipes', 'Recipes', CookingPot],
  ['consumption', 'Consumption', ClipboardList],
  ['waste', 'Waste', Trash2],
];

function readSession() {
  try { return JSON.parse(localStorage.getItem('kurax_user') || 'null'); }
  catch { return null; }
}

export default function DepartmentInventory({ department, embedded = false }) {
  const navigate = useNavigate();
  const [session] = useState(readSession);
  const [section, setSection] = useState('recipes');
  const [items, setItems] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [records, setRecords] = useState({ recipes: [], consumption: [], waste: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const config = DEPARTMENTS[department];
  const role = String(session?.role || '').toUpperCase();
  const allowed = config && [config.hodRole, config.staffRole].includes(role);
  const isHod = role === config?.hodRole;
  const headers = { Authorization: `Bearer ${session?.token || ''}` };

  async function loadData() {
    if (!config || !session?.token || !allowed) return;
    setLoading(true);
    try {
      const query = `?station=${encodeURIComponent(config.station)}`;
      const [itemsResponse, recipesResponse, menusResponse, consumptionResponse, wasteResponse] = await Promise.all([
        fetch(`${API_URL}/api/inventory/items${query}`, { headers }),
        fetch(`${API_URL}/api/inventory/recipes?station=${encodeURIComponent(config.station)}`, { headers }),
        fetch(`${API_URL}/api/inventory/recipes/menu-items?station=${encodeURIComponent(config.station)}`, { headers }),
        fetch(`${API_URL}/api/inventory/consumption`, { headers }),
        fetch(`${API_URL}/api/inventory/waste`, { headers }),
      ]);
      const responses = [itemsResponse, recipesResponse, menusResponse, consumptionResponse, wasteResponse];
      const failed = responses.find((response) => !response.ok);
      if (failed) {
        const result = await failed.json().catch(() => ({}));
        throw new Error(result.error || 'Unable to load department inventory records.');
      }
      const [itemRows, recipeRows, menuRows, consumptionRows, wasteRows] = await Promise.all(responses.map((response) => response.json()));
      setItems(itemRows);
      setMenuItems(menuRows);
      setRecords({ recipes: recipeRows, consumption: consumptionRows, waste: wasteRows });
      setError('');
    } catch (loadError) {
      setError(loadError.message || 'Unable to load department inventory records.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [department, session?.token, allowed]);

  async function runAction(path, payload, method = 'POST', successMessage = 'Inventory updated.') {
    setError('');
    setMessage('');
    try {
      const response = await fetch(`${API_URL}/api/inventory/${path}`, {
        method,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload || {}),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Inventory request failed.');
      setMessage(successMessage);
      await loadData();
      return result;
    } catch (actionError) {
      setError(actionError.message || 'Inventory request failed.');
      return null;
    }
  }

  if (!session?.token) return <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Sign in to access department inventory.</p>;
  if (!allowed) return <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">This account cannot access {config?.label || 'department'} inventory.</p>;

  return (
    <section className={embedded ? 'space-y-5' : 'min-h-screen bg-[#f4f3ef] px-5 py-6 text-zinc-900 md:px-8'}>
      <div className={embedded ? 'space-y-5' : 'mx-auto max-w-7xl space-y-5'}>
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-700">{config.label} department</p>
            <h1 className="mt-1 text-2xl font-black">Inventory operations</h1>
          </div>
          {!embedded && <button type="button" onClick={() => navigate(isHod ? `/${department}/hod` : config.home)} className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-zinc-50"><ArrowLeft size={16} /> Back to station</button>}
        </header>

        <nav className="flex gap-1 overflow-x-auto border-b border-zinc-200" aria-label="Inventory operations">
          {WORKFLOWS.map(([key, label, Icon]) => <button key={key} type="button" onClick={() => setSection(key)} className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold ${section === key ? 'border-amber-600 text-zinc-950' : 'border-transparent text-zinc-500 hover:text-zinc-900'}`}><Icon size={16} /> {label}</button>)}
        </nav>

        {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{error}</p>}
        {message && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{message}</p>}
        {loading ? <p className="rounded-xl border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500">Loading department inventory…</p> : (
          <InventoryWorkflows
            section={section}
            items={items}
            menuItems={menuItems}
            records={records}
            station={config.station}
            canConfigureRecipes
            canApproveRecipes={isHod}
            onAction={runAction}
          />
        )}
      </div>
    </section>
  );
}