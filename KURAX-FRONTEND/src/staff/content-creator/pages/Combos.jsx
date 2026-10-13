import { useEffect, useMemo, useState } from 'react';
import Sidebar from '../components/Sidebar';
import API_URL from '../../../config/api';
import Footer from '../../../customer/components/common/Foooter';
import { getImageSrc } from '../../../utils/imageHelper';
import { Loader2, Plus, Trash2, Box, CheckCircle2, AlertCircle, ImagePlus, Edit2, ImageIcon, X } from 'lucide-react';

const formatUGX = (amount) => `UGX ${Number(amount || 0).toLocaleString('en-UG')}`;
const createEmptyComboForm = () => ({
  name: '',
  description: '',
  category: 'Combos',
  station: 'Kitchen',
  price: '',
  image_file: null,
  image_url: '',
  published: false,
  is_available: true,
  customer_visible: true,
  components: [],
});

export default function Combos() {
  const [menus, setMenus] = useState([]);
  const [combos, setCombos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formVisible, setFormVisible] = useState(false);
  const [editingCombo, setEditingCombo] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [imagePreview, setImagePreview] = useState('');
  const [form, setForm] = useState(createEmptyComboForm);

  const refreshData = async () => {
    setLoading(true);
    try {
      const [menuRes, comboRes] = await Promise.all([
        fetch(`${API_URL}/api/menus`),
        fetch(`${API_URL}/api/combos`),
      ]);
      const menuData = menuRes.ok ? await menuRes.json() : [];
      const comboData = comboRes.ok ? await comboRes.json() : [];
      setMenus(menuData);
      setCombos(comboData);
    } catch (error) {
      console.error(error);
      setMessage({ type: 'error', text: 'Unable to load menu and combo catalogue.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  useEffect(() => {
    if (!form.image_file) {
      setImagePreview(form.image_url ? getImageSrc(form.image_url) : '');
      return undefined;
    }

    const previewUrl = URL.createObjectURL(form.image_file);
    setImagePreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [form.image_file, form.image_url]);

  const regularTotal = useMemo(() => {
    return (form.components || []).reduce((sum, component) => {
      const item = menus.find((menu) => Number(menu.id) === Number(component.menu_item_id));
      const unitPrice = Number(item?.price || component.unit_price || 0);
      return sum + unitPrice * Number(component.quantity || 1);
    }, 0);
  }, [form.components, menus]);

  const discountAmount = Math.max(0, regularTotal - Number(form.price || 0));
  const discountPercentage = regularTotal > 0 ? (discountAmount / regularTotal) * 100 : 0;

  const addComponent = () => {
    setForm((prev) => ({
      ...prev,
      components: [...(prev.components || []), { menu_item_id: menus[0]?.id ?? '', quantity: 1, unit_price: Number(menus[0]?.price || 0) }],
    }));
  };

  const updateComponent = (index, field, value) => {
    setForm((prev) => ({
      ...prev,
      components: (prev.components || []).map((component, currentIndex) => {
        if (currentIndex !== index) return component;
        const nextValue = field === 'menu_item_id' ? value : value;
        const selectedItem = menus.find((menu) => Number(menu.id) === Number(nextValue));
        return {
          ...component,
          [field]: field === 'menu_item_id' ? Number(nextValue) : Number(value),
          unit_price: selectedItem ? Number(selectedItem.price || 0) : Number(component.unit_price || 0),
        };
      }),
    }));
  };

  const removeComponent = (index) => {
    setForm((prev) => ({
      ...prev,
      components: (prev.components || []).filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage({ type: '', text: '' });

    try {
      const payload = {
        ...form,
        price: Number(form.price || 0),
        published: Boolean(form.published),
        is_available: Boolean(form.is_available),
        customer_visible: Boolean(form.customer_visible),
      };

      if (!payload.name || !payload.price || (payload.components || []).length < 2) {
        throw new Error('A combo needs a name, a package price, and at least two menu items.');
      }

      const formData = new FormData();
      Object.entries(payload).forEach(([key, value]) => {
        if (key === 'image_file') {
          if (value) formData.append('image', value);
        } else if (key === 'components') {
          formData.append(key, JSON.stringify(value));
        } else {
          formData.append(key, String(value ?? ''));
        }
      });

      const response = await fetch(editingCombo ? `${API_URL}/api/combos/${editingCombo.id}` : `${API_URL}/api/combos`, {
        method: editingCombo ? 'PUT' : 'POST',
        body: formData,
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Unable to save combo.');

      resetForm();
      await refreshData();
      setMessage({ type: 'success', text: editingCombo ? 'Combo updated successfully.' : 'Combo saved successfully.' });
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Unable to save combo.' });
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setForm(createEmptyComboForm());
    setEditingCombo(null);
    setFormVisible(false);
  };

  const handleEdit = (combo) => {
    setEditingCombo(combo);
    setForm({
      ...createEmptyComboForm(),
      name: combo.name || '',
      description: combo.description || '',
      category: combo.category || 'Combos',
      station: combo.station || 'Kitchen',
      price: String(combo.price || ''),
      image_url: combo.image_url || '',
      published: combo.published === true,
      is_available: combo.is_available !== false,
      customer_visible: combo.customer_visible !== false,
      components: (combo.components || []).map((component) => ({
        menu_item_id: component.menu_item_id,
        quantity: component.quantity || 1,
        unit_price: Number(component.unit_price || 0),
      })),
    });
    setFormVisible(true);
    document.getElementById('content-area')?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (combo) => {
    if (!window.confirm(`Delete ${combo.name}? This cannot be undone.`)) return;
    try {
      const response = await fetch(`${API_URL}/api/combos/${combo.id}`, { method: 'DELETE' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Unable to delete combo.');
      setCombos((current) => current.filter((item) => item.id !== combo.id));
      setMessage({ type: 'success', text: 'Combo deleted successfully.' });
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Unable to delete combo.' });
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 font-[Outfit] text-gray-900">
      <Sidebar />
      <div id="content-area" className="flex flex-1 flex-col overflow-y-auto">
        <main className="p-4 pt-20 md:p-8 lg:pt-8">
          <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900 md:text-3xl">Combos</h1>
              <p className="mt-1 text-xs text-gray-500 md:text-sm">Bundle menu items, set package pricing, and manage customer visibility.</p>
            </div>
            {!formVisible && (
              <button
                onClick={() => setFormVisible(true)}
                className="flex items-center justify-center gap-2 rounded-xl bg-yellow-500 px-6 py-3 font-bold text-black shadow-md transition hover:bg-yellow-600 active:scale-95"
              >
                <Plus className="h-5 w-5" /> Add Combo
              </button>
            )}
          </div>

          {message.text && (
            <div className={`fixed right-4 top-20 z-50 flex items-center gap-2 rounded-xl border p-3 text-sm shadow-lg ${message.type === 'success' ? 'border-green-300 bg-green-100 text-green-800' : 'border-red-300 bg-red-100 text-red-800'}`}>
              {message.type === 'success' ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
              <span className="font-medium">{message.text}</span>
            </div>
          )}

          {formVisible && (
            <section className="mb-10 animate-in fade-in zoom-in duration-300 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm md:p-8">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900 md:text-xl">{editingCombo ? 'Edit Combo' : 'Create New Combo'}</h2>
                <button type="button" onClick={resetForm} aria-label="Close combo form" className="p-2 text-gray-400 transition-colors hover:text-gray-700">
                  <X className="h-6 w-6" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2 text-sm font-medium">
                    <span>Combo name</span>
                    <input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} className="w-full rounded-xl border px-3 py-2" required />
                  </label>
                  <label className="space-y-2 text-sm font-medium">
                    <span>Category</span>
                    <select value={form.category} onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))} className="w-full rounded-xl border px-3 py-2">
                      <option>Combos</option>
                      <option>Starters</option>
                      <option>Local Foods</option>
                      <option>Drinks & Cocktails</option>
                    </select>
                  </label>
                </div>

                <label className="space-y-2 text-sm font-medium">
                  <span>Description</span>
                  <textarea value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} rows={3} className="w-full rounded-xl border px-3 py-2" />
                </label>

                <div className="grid gap-4 md:grid-cols-3">
                  <label className="space-y-2 text-sm font-medium">
                    <span>Package price</span>
                    <input type="number" value={form.price} onChange={(e) => setForm((prev) => ({ ...prev, price: e.target.value }))} className="w-full rounded-xl border px-3 py-2" min={1} required />
                  </label>
                  <label className="space-y-2 text-sm font-medium">
                    <span>Station</span>
                    <select value={form.station} onChange={(e) => setForm((prev) => ({ ...prev, station: e.target.value }))} className="w-full rounded-xl border px-3 py-2">
                      <option>Kitchen</option>
                      <option>Barista</option>
                      <option>Barman</option>
                    </select>
                  </label>
                </div>

                <label className="block space-y-2 text-sm font-medium">
                  <span>Combo image</span>
                  <span className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-300 px-3 py-3 text-slate-600 hover:border-yellow-500">
                    <ImagePlus className="h-5 w-5" />
                    <span>{form.image_file?.name || 'Choose an image from this computer'}</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(event) => setForm((prev) => ({ ...prev, image_file: event.target.files?.[0] || null }))}
                      className="sr-only"
                    />
                  </span>
                  <span className="block text-xs font-normal text-slate-500">JPEG, PNG, or WebP, up to 5 MB.</span>
                  {imagePreview && <img src={imagePreview} alt="Combo preview" className="h-36 w-full rounded-lg object-cover" />}
                </label>

                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">Components</h3>
                    <button type="button" onClick={addComponent} className="inline-flex items-center gap-2 rounded-lg bg-yellow-500 px-3 py-2 text-sm font-bold text-black">
                      <Plus className="h-4 w-4" /> Add item
                    </button>
                  </div>

                  <div className="space-y-3">
                    {(form.components || []).length === 0 ? (
                      <p className="text-sm text-slate-500">No components yet.</p>
                    ) : (
                      (form.components || []).map((component, index) => {
                        const selectedItem = menus.find((menu) => Number(menu.id) === Number(component.menu_item_id));
                        return (
                          <div key={`${component.menu_item_id || 'new'}-${index}`} className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 md:grid-cols-[1.4fr_0.7fr_auto]">
                            <select
                              value={component.menu_item_id}
                              onChange={(e) => updateComponent(index, 'menu_item_id', e.target.value)}
                              className="rounded-lg border px-3 py-2 text-sm"
                            >
                              <option value="">Select menu item</option>
                              {menus.map((menu) => (
                                <option key={menu.id} value={menu.id}>{menu.name}</option>
                              ))}
                            </select>
                            <input
                              type="number"
                              min={1}
                              step={1}
                              value={component.quantity || 1}
                              onChange={(e) => updateComponent(index, 'quantity', e.target.value)}
                              className="rounded-lg border px-3 py-2 text-sm"
                            />
                            <button type="button" onClick={() => removeComponent(index)} className="inline-flex items-center justify-center rounded-lg border border-red-200 bg-red-50 p-2 text-red-600">
                              <Trash2 className="h-4 w-4" />
                            </button>
                            <div className="md:col-span-3 text-xs text-slate-500">
                              {selectedItem ? `${selectedItem.name} · ${formatUGX(selectedItem.price)}` : 'Choose a menu item'}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Regular total</p>
                    <p className="mt-2 text-lg font-black">{formatUGX(regularTotal)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Discount</p>
                    <p className="mt-2 text-lg font-black">{formatUGX(discountAmount)} ({discountPercentage.toFixed(1)}%)</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Package price</p>
                    <p className="mt-2 text-lg font-black">{formatUGX(Number(form.price || 0))}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-4">
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={form.published} onChange={(e) => setForm((prev) => ({ ...prev, published: e.target.checked }))} />
                    Publish combo
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={form.is_available} onChange={(e) => setForm((prev) => ({ ...prev, is_available: e.target.checked }))} />
                    Available now
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={form.customer_visible} onChange={(e) => setForm((prev) => ({ ...prev, customer_visible: e.target.checked }))} />
                    Publicly visible
                  </label>
                </div>

                <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-yellow-500 px-5 py-3 font-bold text-black disabled:opacity-60">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Box className="h-4 w-4" />}
                  {saving ? 'Saving...' : 'Save combo'}
                </button>
              </form>
            </section>
          )}

          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-gray-900">Saved Combos</h2>
            <span className="text-sm text-gray-500">{combos.length} {combos.length === 1 ? 'combo' : 'combos'}</span>
          </div>
          {loading ? (
            <div className="flex items-center gap-3 py-12 text-gray-600">
              <Loader2 className="h-5 w-5 animate-spin text-yellow-600" /> Loading combos...
            </div>
          ) : combos.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center text-sm text-gray-500">
              No combos yet. Add your first combo to get started.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 pb-10 sm:grid-cols-2 lg:grid-cols-3">
              {combos.map((combo) => (
                <article key={combo.id} className="group flex h-full flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-yellow-300 hover:shadow-md">
                  <div className="relative h-44 overflow-hidden bg-gray-100">
                    {combo.image_url ? (
                      <img src={getImageSrc(combo.image_url)} alt={combo.name} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-gray-400"><ImageIcon className="h-8 w-8 opacity-40" /></div>
                    )}
                    <span className={`absolute right-3 top-3 rounded-full border px-2 py-1 text-[8px] font-black uppercase tracking-widest ${combo.published ? 'border-emerald-200 bg-emerald-100 text-emerald-700' : 'border-gray-300 bg-gray-200 text-gray-600'}`}>
                      {combo.published ? 'Live' : 'Draft'}
                    </span>
                    <span className={`absolute left-3 top-3 rounded-lg px-2.5 py-1 text-[8px] font-black uppercase tracking-widest ${combo.is_available === false ? 'bg-red-100 text-red-700' : 'bg-white/90 text-gray-700'}`}>
                      {combo.is_available === false ? 'Unavailable' : combo.category || 'Combo'}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col p-4 md:p-5">
                    <div className="mb-2 flex min-h-[2.5rem] items-start justify-between gap-2">
                      <h3 className="flex-1 text-sm font-bold uppercase leading-tight tracking-tight text-gray-900 md:text-base">{combo.name}</h3>
                      <div className="shrink-0 text-right">
                        <span className="text-sm font-black tracking-tight text-yellow-700 md:text-base">{Number(combo.price || 0).toLocaleString()}</span>
                        <div className="-mt-1 text-[7px] font-bold uppercase text-gray-500">UGX</div>
                      </div>
                    </div>
                    <p className="mb-3 h-8 overflow-hidden text-[11px] leading-snug text-gray-500 line-clamp-2 md:text-xs">{combo.description || 'Bundled favorites from the Kurax menu.'}</p>
                    <div className="mb-4 min-h-10 text-xs text-gray-600">
                      <span className="font-semibold">{combo.components?.length || 0} items</span>
                      {combo.components?.length > 0 && <span> · {combo.components.slice(0, 2).map((item) => item.name).filter(Boolean).join(', ')}{combo.components.length > 2 ? ', …' : ''}</span>}
                    </div>
                    <div className="mt-auto flex w-full gap-2 border-t border-gray-100 pt-4">
                      <button onClick={() => handleEdit(combo)} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gray-100 py-2.5 text-[11px] font-black uppercase tracking-widest text-gray-700 transition hover:bg-gray-200">
                        <Edit2 className="h-3.5 w-3.5 text-yellow-600" /> Edit
                      </button>
                      <button onClick={() => handleDelete(combo)} aria-label={`Delete ${combo.name}`} className="flex items-center justify-center rounded-xl border border-red-100 bg-red-50 px-4 text-red-600 transition hover:bg-red-100">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
      </main>
        <Footer />
      </div>
    </div>
  );
}
