import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Check, ChefHat, CircleDollarSign, ClipboardList, Eye, EyeOff, Flame, LogOut,
  Download, Package, Plus, RefreshCw, Users, Wallet,
} from 'lucide-react';
import API_URL from '../../config/api';
import { downloadReportPdf } from '../reportExport';
import kuraxLogo from '../../customer/assets/images/logo.jpeg';
import { EyeOpen, EyeClosed, EnvelopeIcon, LockIcon, ImageCarousel, UnderlineInput } from '../StaffLogin.jsx';

const METHODS = [
  ['MTN_MOBILE_MONEY', 'MTN Mobile Money'],
  ['AIRTEL_MONEY', 'Airtel Money'],
  ['CARD', 'Card'],
  ['CASH', 'Cash'],
  ['CREDIT', 'Credit'],
];

function readSession() {
  try {
    const staff = JSON.parse(localStorage.getItem('kurax_user') || 'null');
    if (staff?.token) return { ...staff, scope: 'restaurant' };
    const shisha = JSON.parse(localStorage.getItem('kurax_shisha_session') || 'null');
    if (shisha?.token) return { ...shisha, scope: 'shisha' };
  } catch {
    return null;
  }
  return null;
}

async function request(path, token, options = {}) {
  const headers = { Authorization: `Bearer ${token}`, ...options.headers };
  let body = options.body;
  if (body && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(body);
  }
  const response = await fetch(`${API_URL}/api/shisha${path}`, { ...options, headers, body });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Shisha request failed.');
  return data;
}

function money(value) {
  return `UGX ${Number(value || 0).toLocaleString()}`;
}

function todayInKampala() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kampala' }).format(new Date());
}

function rangeFor(mode) {
  const today = todayInKampala();
  const current = new Date(`${today}T12:00:00Z`);
  if (mode === 'yesterday') {
    current.setUTCDate(current.getUTCDate() - 1);
    const date = current.toISOString().slice(0, 10);
    return [date, date];
  }
  if (mode === 'week') {
    current.setUTCDate(current.getUTCDate() - ((current.getUTCDay() + 6) % 7));
    return [current.toISOString().slice(0, 10), today];
  }
  if (mode === 'month') return [`${today.slice(0, 7)}-01`, today];
  return [today, today];
}

function rangeForMonth(month) {
  const [year, monthNumber] = month.split('-').map(Number);
  const lastDay = String(new Date(year, monthNumber, 0).getDate()).padStart(2, '0');
  return [`${month}-01`, `${month}-${lastDay}`];
}

function Button({ children, onClick, disabled, tone = 'dark', type = 'button' }) {
  const toneClass = tone === 'accent'
    ? 'bg-amber-400 text-zinc-950 hover:bg-amber-300'
    : tone === 'quiet'
      ? 'border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
      : 'bg-zinc-900 text-white hover:bg-zinc-700';
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${toneClass}`}>
      {children}
    </button>
  );
}

function Field({ label, ...props }) {
  return (
    <label className="grid gap-1.5 text-xs font-semibold text-zinc-600">
      {label}
      <input {...props} className="min-w-0 rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm font-medium text-zinc-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100" />
    </label>
  );
}

export default function ShishaDepartment({ requiredRole = null }) {
  const navigate = useNavigate();
  const [session, setSession] = useState(readSession);
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [touchedEmail, setTouchedEmail] = useState(false);
  const [touchedPin, setTouchedPin] = useState(false);
  const [tab, setTab] = useState('');
  const [packages, setPackages] = useState([]);
  const [orders, setOrders] = useState([]);
  const [staff, setStaff] = useState([]);
  const [paymentRequests, setPaymentRequests] = useState([]);
  const [report, setReport] = useState(null);
  const [reportMode, setReportMode] = useState('today');
  const [reportMonth, setReportMonth] = useState(() => todayInKampala().slice(0, 7));
  const [reportFrom, setReportFrom] = useState(todayInKampala);
  const [reportTo, setReportTo] = useState(todayInKampala);
  const [cart, setCart] = useState([]);
  const [table, setTable] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [paymentMethods, setPaymentMethods] = useState({});
  const [assignment, setAssignment] = useState({});
  const [paymentInputs, setPaymentInputs] = useState({});
  const [packageForm, setPackageForm] = useState(null);
  const [staffForm, setStaffForm] = useState({ name: '', email: '', pin: '', role: 'SHISHA_WAITER' });
  const [showStaffPin, setShowStaffPin] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const role = String(session?.role || '').toUpperCase();
  const routeRoleMismatch = Boolean(session?.token && requiredRole && role !== requiredRole);
  const loginAudience = requiredRole === 'SHISHA_CHEF'
    ? 'Shisha Mixer'
    : requiredRole === 'SHISHA_WAITER'
      ? 'Shisha Waiter'
      : 'Shisha Department';
  const isHod = role === 'SHISHA_HOD';
  const isWaiter = role === 'SHISHA_WAITER';
  const isChef = role === 'SHISHA_CHEF';
  const isDirector = role === 'DIRECTOR';
  const canReport = isHod || ['DIRECTOR', 'MANAGER', 'ACCOUNTANT'].includes(role);
  const emailError = touchedEmail && !email.trim()
    ? 'Email is required'
    : touchedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      ? 'Enter a valid email address'
      : '';
  const pinError = touchedPin && !pin.trim()
    ? 'PIN is required'
    : touchedPin && !/^\d{4,8}$/.test(pin)
      ? 'PIN must be 4-8 digits'
      : '';
  const navItems = isHod
    ? [['station', 'Station', ClipboardList], ['packages', 'Packages', Package], ['payments', 'Payments', Wallet], ['team', 'Team', Users], ['reports', 'Reports', CircleDollarSign]]
    : isWaiter
      ? [['take-order', 'Take order', Plus], ['my-orders', 'My orders', ClipboardList]]
      : isChef
        ? [['my-orders', 'My orders', ChefHat]]
        : canReport
          ? [['reports', 'Reports', CircleDollarSign], ...(isDirector ? [['setup', 'HOD access', Users]] : [])]
          : [];

  useEffect(() => {
    if (navItems.length && !navItems.some(([key]) => key === tab)) setTab(navItems[0][0]);
  }, [role, tab]);

  async function loadData() {
    if (!session?.token) return;
    const requests = [];
    if (isHod || isWaiter) requests.push(request('/packages', session.token).then(setPackages));
    if (isHod || isWaiter || isChef) requests.push(request('/orders', session.token).then(setOrders));
    if (isHod) {
      requests.push(request('/staff', session.token).then(setStaff));
      requests.push(request('/payments', session.token).then(setPaymentRequests));
    }
    if (canReport) {
      const query = new URLSearchParams({ from: reportFrom, to: reportTo });
      requests.push(request(`/reports?${query}`, session.token).then(setReport));
    }
    const results = await Promise.allSettled(requests);
    const failed = results.find(result => result.status === 'rejected');
    if (failed) setError(failed.reason.message);
    else setError('');
  }

  useEffect(() => {
    if (!session?.token) return undefined;
    loadData();
    const timer = window.setInterval(loadData, 12000);
    return () => window.clearInterval(timer);
  }, [session?.token, role, reportFrom, reportTo]);

  async function runAction(action, success) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await action();
      setMessage(typeof success === 'function' ? success(result) : success);
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function signIn(event) {
    event.preventDefault();
    setTouchedEmail(true);
    setTouchedPin(true);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^\d{4,8}$/.test(pin) || busy) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`${API_URL}/api/shisha/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, pin }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Sign in failed.');
      if (requiredRole && String(data.user?.role || '').toUpperCase() !== requiredRole) {
        throw new Error(`This route is for ${loginAudience} accounts.`);
      }
      const next = { ...data.user, token: data.token, scope: 'shisha' };
      localStorage.removeItem('kurax_user');
      localStorage.setItem('kurax_shisha_session', JSON.stringify(next));
      setSession(next);
      setPin('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function signOut() {
    if (session?.scope === 'shisha') localStorage.removeItem('kurax_shisha_session');
    else localStorage.removeItem('kurax_user');
    setSession(null);
    navigate('/');
  }

  function updateCart(product, quantity) {
    setCart(current => {
      const existing = current.find(item => item.id === product.id);
      if (quantity < 1) return current.filter(item => item.id !== product.id);
      if (existing) return current.map(item => item.id === product.id ? { ...item, quantity } : item);
      return [...current, { ...product, quantity }];
    });
  }

  function submitOrder(event) {
    event.preventDefault();
    if (!cart.length) return setError('Add a package before submitting the order.');
    runAction(async () => {
      await request('/orders', session.token, {
        method: 'POST', body: {
          table_id: table,
          notes: orderNotes,
          items: cart.map(item => ({ package_id: item.id, quantity: item.quantity })),
        },
      });
      setCart([]);
      setTable('');
      setOrderNotes('');
      setTab('my-orders');
    }, 'Shisha order sent to the station.');
  }

  function savePackage(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    data.set('published', String(form.elements.published.checked));
    data.set('is_available', String(form.elements.is_available.checked));
    runAction(async () => {
      const editing = packageForm?.id;
      await request(editing ? `/packages/${editing}` : '/packages', session.token, {
        method: editing ? 'PUT' : 'POST', body: data,
      });
      setPackageForm(null);
    }, 'Package saved.');
  }

  function saveStaff(event) {
    event.preventDefault();
    runAction(async () => {
      const result = await request('/staff', session.token, { method: 'POST', body: staffForm });
      setStaffForm({ name: '', email: '', pin: '', role: 'SHISHA_WAITER' });
      setShowStaffPin(false);
      return result;
    }, result => result.emailSent
      ? 'Shisha account created and PIN emailed.'
      : 'Account created, but the PIN email could not be sent. Check backend EMAIL_USER and EMAIL_PASS, then securely give the staff member the PIN you entered.');
  }

  function chooseReportMode(mode) {
    setReportMode(mode);
    if (mode !== 'custom') {
      const [from, to] = mode === 'specific-month' ? rangeForMonth(reportMonth) : rangeFor(mode);
      setReportFrom(from);
      setReportTo(to);
    }
  }

  function downloadShishaReport() {
    if (!report || report.from !== reportFrom || report.to !== reportTo) return;
    const summary = report.summary || {};
    downloadReportPdf({
      filename: `shisha-report-${reportFrom}-to-${reportTo}.pdf`,
      title: 'Shisha Sales & Finance Report',
      from: report.from,
      to: report.to,
      sections: [
        {
          title: 'Summary',
          columns: ['Metric', 'Value'],
          rows: [
            ['Orders', summary.total_orders ?? 0],
            ['Total sales', money(summary.total_sales)],
            ['Collected', money(summary.amount_collected)],
            ['Outstanding', money(summary.total_outstanding)],
            ['Partially paid amount', money(summary.partially_paid_amount)],
            ['Partially paid orders', summary.partially_paid_orders ?? 0],
            ['Fully settled orders', summary.fully_settled_orders ?? 0],
          ],
        },
        {
          title: 'Sales by Shisha waiter',
          columns: ['Waiter', 'Orders', 'Sales', 'Collected', 'Outstanding'],
          rows: (report.by_waiter || []).map(row => [row.waiter_name, row.total_orders, money(row.total_sales), money(row.amount_collected), money(row.outstanding)]),
        },
        {
          title: 'Sales by Shisha mixer',
          columns: ['Mixer', 'Orders', 'Sales'],
          rows: (report.by_mixer || []).map(row => [row.mixer_name, row.total_orders, money(row.total_sales)]),
        },
        {
          title: 'Collected by payment method',
          columns: ['Payment method', 'Confirmed payments', 'Amount'],
          rows: (report.by_payment_method || []).map(row => [row.payment_method, row.payment_count, money(row.amount)]),
        },
      ],
    });
  }

  const activePackages = packages.filter(item => item.published && item.is_available);
  const activeMixers = staff.filter(person => person.role === 'SHISHA_CHEF' && person.is_active);
  const totalInCart = cart.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);

  if (!session?.token) {
    return (
      <div className="h-screen flex overflow-hidden font-[Outfit]">
        <div className="relative flex h-full w-full flex-col overflow-y-auto bg-white px-6 py-6 sm:px-10 xl:w-[42%] xl:px-14">
          <div className="pointer-events-none absolute bottom-0 right-0 h-64 w-64 rounded-full bg-amber-400/8 blur-[100px]" />
          <div className="relative z-10 mb-4 flex flex-col items-center text-center">
            <img src={kuraxLogo} alt="Kurax" className="mb-2 h-16 w-auto object-contain" />
            <h1 className="text-lg font-black uppercase tracking-widest text-black">Kurax Food</h1>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-black">Lounge &amp; Bistro</p>
            <p className="mt-1 text-[11px] font-medium tracking-wide text-zinc-700">Luxury Dining &amp; Rooftop Vibes</p>
          </div>

          <div className="relative z-10 mx-auto flex w-full max-w-sm flex-1 flex-col justify-center">
            <div className="mb-6">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-700">{loginAudience} · Staff Login</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-black">Welcome back</h2>
              <p className="mt-1 text-sm font-medium text-zinc-700">Sign in to access the {loginAudience} workspace.</p>
            </div>

            {error && <div className="mb-4 flex items-center gap-2 border-l-2 border-red-500 bg-red-50 px-3 py-2"><p role="alert" className="text-[11px] font-bold uppercase tracking-widest text-red-600">{error}</p></div>}

            <form onSubmit={signIn} className="space-y-2">
              <UnderlineInput
                id="shisha-email"
                type="email"
                value={email}
                onChange={event => setEmail(event.target.value)}
                onBlur={() => setTouchedEmail(true)}
                icon={EnvelopeIcon}
                label="Email"
                error={emailError}
                touched={touchedEmail}
                disabled={busy}
              />
              <UnderlineInput
                id="shisha-pin"
                type={showPin ? 'text' : 'password'}
                value={pin}
                onChange={event => setPin(event.target.value.replace(/\D/g, '').slice(0, 8))}
                onBlur={() => setTouchedPin(true)}
                icon={LockIcon}
                label="PIN"
                error={pinError}
                touched={touchedPin}
                disabled={busy}
                maxLength={8}
                rightElement={<button type="button" onClick={() => setShowPin(value => !value)} className="text-gray-400 transition-colors hover:text-amber-600" tabIndex={-1}>{showPin ? <EyeClosed /> : <EyeOpen />}</button>}
              />
              <div className="flex items-center justify-between pb-2 pt-2">
                <span className="cursor-default text-xs text-gray-400">Forgot PIN?</span>
                <a href="mailto:admin@kurax.com" className="text-xs font-semibold text-amber-600 transition-colors hover:text-amber-700">Contact Admin</a>
              </div>
              <button type="submit" disabled={busy} className="group relative mt-2 w-full overflow-hidden py-3 text-xs font-black uppercase tracking-[0.35em] transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-60" style={{ background: busy ? 'rgba(180,130,0,0.15)' : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}>
                {!busy && <div className="absolute inset-0 -translate-x-full skew-x-12 bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />}
                <span className={`relative flex items-center justify-center gap-2 ${busy ? 'text-amber-700' : 'text-black'}`}>
                  {busy ? <><svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Authenticating</> : <>Sign in to {loginAudience}<ArrowRight size={14} /></>}
                </span>
              </button>
            </form>
          </div>

          <div className="relative z-10 mt-2 flex flex-col items-center gap-2 text-center"><p className="text-[10px] font-medium uppercase tracking-widest text-zinc-700">© 2026 Kurax Lounge &amp; Bistro</p><button type="button" onClick={() => navigate('/')} className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 transition hover:text-amber-800"><ArrowLeft size={14} /> Back to home</button></div>
        </div>
        <div className="relative hidden h-full flex-1 lg:block"><ImageCarousel /></div>
      </div>
    );
  }

  if (routeRoleMismatch) {
    return <main className="grid min-h-screen place-items-center bg-[#f4f3ef] p-6 text-zinc-900"><section className="max-w-md rounded-xl border border-zinc-200 bg-white p-6 text-center"><h1 className="text-xl font-black">Different Shisha role</h1><p className="mt-2 text-sm text-zinc-600">This route is for {loginAudience} accounts.</p><button onClick={() => { localStorage.removeItem('kurax_shisha_session'); setSession(null); }} className="mt-4 rounded-lg bg-amber-400 px-4 py-2 text-sm font-bold text-zinc-950">Sign in with another account</button></section></main>;
  }

  return (
    <main className="min-h-screen bg-[#f4f3ef] text-zinc-900">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4 px-5 py-4 md:px-8">
          <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-zinc-900 text-amber-300"><Flame size={21} /></span><div><p className="text-xs font-black uppercase tracking-[0.18em]">Kurax · Internal</p><p className="text-xs text-zinc-500">Shisha Department</p></div></div>
          <div className="flex items-center gap-3"><span className="hidden text-right sm:block"><span className="block text-sm font-bold">{session.name}</span><span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{role.replaceAll('_', ' ')}</span></span><Button tone="quiet" onClick={loadData}><RefreshCw size={15} /> Refresh</Button><Button tone="quiet" onClick={signOut}><LogOut size={15} /> Sign out</Button></div>
        </div>
      </header>
      <div className="mx-auto max-w-[1440px] px-5 py-6 md:px-8 md:py-8">
        <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-700">{isHod ? 'Department control' : isWaiter ? 'Floor service' : isChef ? 'Preparation station' : 'Management visibility'}</p><h1 className="mt-1 text-3xl font-black tracking-tight">{isHod ? 'Shisha station' : isWaiter ? 'Shisha service' : isChef ? 'Mixer orders' : 'Shisha sales'}</h1></div>
          <div className="text-xs font-medium text-zinc-500">Separate from restaurant orders and cashiering</div>
        </div>

        <nav className="mb-6 flex gap-1 overflow-x-auto border-b border-zinc-200" aria-label="Shisha workspace">
          {navItems.map(([key, label, Icon]) => <button key={key} onClick={() => setTab(key)} className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition ${tab === key ? 'border-amber-600 text-zinc-950' : 'border-transparent text-zinc-500 hover:text-zinc-900'}`}><Icon size={16} />{label}</button>)}
        </nav>

        {(error || message) && <div className={`mb-5 flex items-center justify-between rounded-lg border px-4 py-3 text-sm ${error ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`} role="status">{error || message}<button onClick={() => { setError(''); setMessage(''); }} aria-label="Dismiss" className="ml-4 font-bold">×</button></div>}

        {tab === 'take-order' && isWaiter && (
          <form onSubmit={submitOrder} className="grid gap-6 xl:grid-cols-[1fr_340px]">
            <section><div className="mb-3 flex items-end justify-between"><div><h2 className="text-lg font-black">Available packages</h2><p className="text-sm text-zinc-500">Only published Shisha products appear here.</p></div><span className="text-xs font-semibold text-zinc-500">{activePackages.length} available</span></div>
              {activePackages.length ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{activePackages.map(product => { const item = cart.find(entry => entry.id === product.id); return <article key={product.id} className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
                {product.image_url ? <img src={`${API_URL}${product.image_url}`} alt="" className="h-36 w-full object-cover" /> : <div className="grid h-36 place-items-center bg-[#e6e0d4] text-amber-800"><Flame size={32} /></div>}
                <div className="p-4"><div className="flex items-start justify-between gap-3"><h3 className="font-bold">{product.name}</h3><span className="whitespace-nowrap text-sm font-black text-amber-800">{money(product.price)}</span></div><p className="mt-1 min-h-10 text-xs leading-5 text-zinc-500">{product.description || 'Shisha package'}</p><div className="mt-3 flex items-center justify-between"><span className="text-xs font-semibold text-zinc-500">Quantity</span><div className="flex items-center gap-3"><button type="button" onClick={() => updateCart(product, (item?.quantity || 0) - 1)} className="h-8 w-8 rounded-md border border-zinc-200 font-bold">−</button><span className="w-4 text-center text-sm font-bold">{item?.quantity || 0}</span><button type="button" onClick={() => updateCart(product, (item?.quantity || 0) + 1)} className="h-8 w-8 rounded-md bg-zinc-900 text-white font-bold">+</button></div></div></div>
              </article>; })}</div> : <Empty text="No published packages are currently available." />}
            </section>
            <aside className="h-fit rounded-xl border border-zinc-200 bg-white p-5 xl:sticky xl:top-5"><h2 className="text-lg font-black">Order details</h2><div className="mt-4 grid gap-4"><Field label="Table number" value={table} onChange={event => setTable(event.target.value)} placeholder="e.g. 5" required /><label className="grid gap-1.5 text-xs font-semibold text-zinc-600">Order notes<textarea value={orderNotes} onChange={event => setOrderNotes(event.target.value)} rows="3" className="rounded-lg border border-zinc-200 px-3 py-2.5 text-sm font-medium outline-none focus:border-amber-500" placeholder="Optional preparation notes" /></label></div><div className="my-5 border-t border-zinc-100 pt-3">{cart.map(item => <div key={item.id} className="flex justify-between gap-3 py-1.5 text-sm"><span>{item.quantity} × {item.name}</span><span className="font-semibold">{money(Number(item.price) * item.quantity)}</span></div>)}{!cart.length && <p className="py-3 text-sm text-zinc-400">Your order is empty.</p>}</div><div className="mb-4 flex justify-between border-t border-zinc-100 pt-4 font-black"><span>Total</span><span>{money(totalInCart)}</span></div><Button type="submit" tone="accent" disabled={busy || !cart.length}>Send to station <ArrowRight size={16} /></Button></aside>
          </form>
        )}

        {(tab === 'station' || tab === 'my-orders') && (isHod || isWaiter || isChef) && (
          <section><div className="mb-4 flex items-end justify-between"><div><h2 className="text-lg font-black">{isHod ? 'Incoming and active orders' : isWaiter ? 'Your Shisha orders' : 'Assigned preparation'}</h2><p className="text-sm text-zinc-500">Updates automatically every 12 seconds.</p></div><span className="rounded-full bg-zinc-200 px-3 py-1 text-xs font-bold">{orders.length} orders</span></div>
            {orders.length ? <div className="grid gap-4 lg:grid-cols-2">{orders.map(order => <OrderCard key={order.id} order={order} role={role} mixers={activeMixers} assignment={assignment} setAssignment={setAssignment} paymentMethods={paymentMethods} setPaymentMethods={setPaymentMethods} token={session.token} runAction={runAction} busy={busy} />)}</div> : <Empty text="No Shisha orders yet." />}
          </section>
        )}

        {tab === 'packages' && isHod && (
          <section><div className="mb-4 flex items-end justify-between"><div><h2 className="text-lg font-black">Package catalogue</h2><p className="text-sm text-zinc-500">Internal products. Publishing never makes a package public.</p></div><Button tone="accent" onClick={() => setPackageForm({ name: '', description: '', price: '', published: false, is_available: true })}><Plus size={16} /> New package</Button></div>
            {packageForm && <form onSubmit={savePackage} className="mb-5 grid gap-4 rounded-xl border border-amber-200 bg-amber-50/70 p-5 md:grid-cols-2"><Field name="name" label="Package name" defaultValue={packageForm.name} required /><Field name="price" label="Price (UGX)" type="number" min="0" step="1" defaultValue={packageForm.price} required /><label className="grid gap-1.5 text-xs font-semibold text-zinc-600">Description<textarea name="description" rows="2" defaultValue={packageForm.description} className="rounded-lg border border-zinc-200 px-3 py-2 text-sm" /></label><label className="grid gap-1.5 text-xs font-semibold text-zinc-600">Package image<input name="image" type="file" accept="image/png,image/jpeg,image/webp" className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm" /></label><div className="flex flex-wrap gap-5 text-sm"><label className="flex items-center gap-2"><input name="published" type="checkbox" defaultChecked={packageForm.published} /> Published for Shisha staff</label><label className="flex items-center gap-2"><input name="is_available" type="checkbox" defaultChecked={packageForm.is_available} /> Available</label></div><div className="flex gap-2 md:col-span-2"><Button type="submit" tone="accent" disabled={busy}>Save package</Button><Button tone="quiet" onClick={() => setPackageForm(null)}>Cancel</Button></div></form>}
            <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white"><div className="grid grid-cols-[1fr_auto_auto] gap-4 border-b border-zinc-100 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-400"><span>Package</span><span>Price</span><span>Visibility</span></div>{packages.map(product => <div key={product.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-4 border-b border-zinc-100 px-4 py-4 last:border-0"><div><p className="font-bold">{product.name}</p><p className="text-xs text-zinc-500">{product.description || 'No description'} · internal only</p></div><span className="text-sm font-semibold">{money(product.price)}</span><div className="flex items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${product.published && product.is_available ? 'bg-emerald-100 text-emerald-800' : 'bg-zinc-100 text-zinc-600'}`}>{product.published && product.is_available ? 'Live internally' : 'Hidden'}</span><button onClick={() => setPackageForm(product)} className="text-xs font-bold text-amber-800 underline">Edit</button></div></div>)}{!packages.length && <Empty text="Create your first package." />}</div>
          </section>
        )}

        {tab === 'payments' && isHod && <PaymentPanel requests={paymentRequests} token={session.token} inputs={paymentInputs} setInputs={setPaymentInputs} runAction={runAction} busy={busy} />}

        {tab === 'team' && isHod && (
          <section className="grid gap-5 xl:grid-cols-[340px_1fr]"><form onSubmit={saveStaff} className="h-fit rounded-xl border border-zinc-200 bg-white p-5"><h2 className="text-lg font-black">Add Shisha staff</h2><p className="mb-4 mt-1 text-sm text-zinc-500">Separate department login and PIN.</p><div className="grid gap-3"><Field label="Full name" value={staffForm.name} onChange={event => setStaffForm({ ...staffForm, name: event.target.value })} required /><Field label="Email" type="email" value={staffForm.email} onChange={event => setStaffForm({ ...staffForm, email: event.target.value })} required /><label className="grid gap-1.5 text-xs font-semibold text-zinc-600">4-8 digit PIN<div className="flex gap-2"><input type={showStaffPin ? 'text' : 'password'} inputMode="numeric" pattern="[0-9]{4,8}" maxLength={8} value={staffForm.pin} onChange={event => setStaffForm({ ...staffForm, pin: event.target.value.replace(/\\D/g, '') })} required className="min-w-0 flex-1 rounded-lg border border-zinc-200 px-3 py-2.5 text-sm outline-none focus:border-amber-500" /><button type="button" title="Generate 4-digit PIN" aria-label="Generate 4-digit PIN" onClick={() => { const values = new Uint32Array(1); window.crypto.getRandomValues(values); setStaffForm({ ...staffForm, pin: String(1000 + (values[0] % 9000)) }); setShowStaffPin(true); }} className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50"><RefreshCw size={15} /></button><button type="button" title={showStaffPin ? 'Hide PIN' : 'Show PIN'} aria-label={showStaffPin ? 'Hide PIN' : 'Show PIN'} onClick={() => setShowStaffPin(!showStaffPin)} className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50">{showStaffPin ? <EyeOff size={15} /> : <Eye size={15} />}</button></div></label><label className="grid gap-1.5 text-xs font-semibold text-zinc-600">Role<select value={staffForm.role} onChange={event => setStaffForm({ ...staffForm, role: event.target.value })} className="rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm"><option value="SHISHA_WAITER">Shisha Waiter</option><option value="SHISHA_CHEF">Shisha Chef / Mixer</option></select></label><Button type="submit" tone="accent" disabled={busy}><Plus size={16} /> Create account</Button></div></form>
            <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white"><div className="border-b border-zinc-100 px-5 py-4"><h2 className="font-black">Department accounts</h2></div>{staff.map(person => <div key={person.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 px-5 py-4 last:border-0"><div><p className="font-bold">{person.name}</p><p className="text-xs text-zinc-500">{person.email} · {person.role.replaceAll('_', ' ')}</p></div><div className="flex items-center gap-3"><span className={`text-xs font-bold ${person.is_active ? 'text-emerald-700' : 'text-zinc-400'}`}>{person.is_active ? 'Active' : 'Inactive'}</span>{person.role !== 'SHISHA_HOD' && <button disabled={busy} onClick={() => runAction(() => request(`/staff/${person.id}`, session.token, { method: 'PATCH', body: { is_active: !person.is_active } }), 'Account updated.')} className="text-xs font-bold text-amber-800 underline">{person.is_active ? 'Deactivate' : 'Activate'}</button>}</div></div>)}</div>
          </section>
        )}

        {tab === 'setup' && isDirector && <section className="max-w-2xl rounded-xl border border-zinc-200 bg-white p-6"><h2 className="text-xl font-black">Establish Shisha HOD access</h2><p className="my-2 text-sm text-zinc-500">Create the initial department administrator. The HOD will manage waiter and mixer accounts.</p><form onSubmit={saveStaff} className="mt-5 grid gap-4 sm:grid-cols-2"><Field label="Full name" value={staffForm.name} onChange={event => setStaffForm({ ...staffForm, name: event.target.value, role: 'SHISHA_HOD' })} required /><Field label="Email" type="email" value={staffForm.email} onChange={event => setStaffForm({ ...staffForm, email: event.target.value, role: 'SHISHA_HOD' })} required /><Field label="4-8 digit PIN" inputMode="numeric" pattern="[0-9]{4,8}" value={staffForm.pin} onChange={event => setStaffForm({ ...staffForm, pin: event.target.value, role: 'SHISHA_HOD' })} required /><div className="flex items-end"><Button type="submit" tone="accent" disabled={busy}>Create HOD account <ArrowRight size={16} /></Button></div></form></section>}

        {tab === 'reports' && canReport && <ReportsPanel report={report} mode={reportMode} setMode={chooseReportMode} from={reportFrom} to={reportTo} setFrom={setReportFrom} setTo={setReportTo} reportMonth={reportMonth} setReportMonth={value => { if (!value) return; setReportMonth(value); const [from, to] = rangeForMonth(value); setReportFrom(from); setReportTo(to); }} onDownload={downloadShishaReport} />}
      </div>
    </main>
  );
}

function Empty({ text }) {
  return <div className="rounded-xl border border-dashed border-zinc-300 bg-white/60 px-5 py-14 text-center text-sm font-medium text-zinc-500">{text}</div>;
}

function OrderCard({ order, role, mixers, assignment, setAssignment, paymentMethods, setPaymentMethods, token, runAction, busy }) {
  const [history, setHistory] = useState(null);
  const doPost = (endpoint, body, message) => runAction(() => request(endpoint, token, { method: 'POST', body }), message);
  const total = money(order.total_amount);
  return (
    <article className="rounded-xl border border-zinc-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-widest text-amber-800">{order.reference || `SH-${String(order.id).padStart(4, '0')}`} · Table {order.table_id}</p><h3 className="mt-1 text-xl font-black">{total}</h3></div><span className="rounded-full bg-zinc-100 px-3 py-1 text-[10px] font-black uppercase tracking-wider">{String(order.order_status).replaceAll('_', ' ')}</span></div>
      <div className="my-4 space-y-2 border-y border-zinc-100 py-3">{(order.items || []).map((item, index) => <div key={item.id || index} className="flex justify-between gap-3 text-sm"><span>{item.quantity} × {item.name}</span><span className="font-semibold">{money(item.line_total)}</span></div>)}</div>
      <div className="grid gap-1 text-xs text-zinc-500"><span>Waiter: {order.waiter_name}</span>{order.chef_name && <span>Mixer: {order.chef_name}</span>}{order.notes && <span>Note: {order.notes}</span>}<span>Payment: {String(order.payment_status).replaceAll('_', ' ')} · paid {money(order.amount_paid)} · due {money(order.outstanding_amount)}</span></div>
      <div className="mt-4 flex flex-wrap gap-2">
        {role === 'SHISHA_HOD' && ['PENDING', 'ASSIGNED'].includes(order.order_status) && <><select aria-label="Assign mixer" value={assignment[order.id] || order.assigned_chef_id || ''} onChange={event => setAssignment({ ...assignment, [order.id]: event.target.value })} className="min-w-40 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"><option value="">Choose mixer</option>{mixers.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</select><Button tone="accent" disabled={busy || !assignment[order.id]} onClick={() => doPost(`/orders/${order.id}/assign`, { chef_id: assignment[order.id] }, 'Order assigned.')}>Assign</Button></>}
        {role === 'SHISHA_CHEF' && order.order_status === 'ASSIGNED' && <Button tone="accent" disabled={busy} onClick={() => doPost(`/orders/${order.id}/prepare`, {}, 'Preparation started.')}>Start preparing</Button>}
        {role === 'SHISHA_CHEF' && order.order_status === 'PREPARING' && <Button tone="accent" disabled={busy} onClick={() => doPost(`/orders/${order.id}/ready`, {}, 'Waiter notified: order ready.')}>Mark ready <Check size={15} /></Button>}
        {role === 'SHISHA_WAITER' && order.order_status === 'READY' && <Button tone="accent" disabled={busy} onClick={() => doPost(`/orders/${order.id}/serve`, {}, 'Order marked served.')}>Serve <Check size={15} /></Button>}
        {role === 'SHISHA_WAITER' && ['SERVED', 'PARTIALLY_PAID', 'OUTSTANDING'].includes(order.order_status) && Number(order.outstanding_amount) > 0 && <><select aria-label="Payment method" value={paymentMethods[order.id] || ''} onChange={event => setPaymentMethods({ ...paymentMethods, [order.id]: event.target.value })} className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"><option value="">Payment method</option>{METHODS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><Button disabled={busy || !paymentMethods[order.id]} onClick={() => doPost(`/orders/${order.id}/payment-request`, { payment_method: paymentMethods[order.id] }, 'Payment request sent to the Shisha HOD.')}>Request payment</Button></>}
        <button onClick={async () => { try { setHistory(await request(`/orders/${order.id}/history`, token)); } catch { setHistory([]); } }} className="px-2 text-xs font-bold text-zinc-500 underline">History</button>
      </div>
      {history && <div className="mt-4 border-t border-zinc-100 pt-3">{history.map(item => <p key={item.id} className="py-1 text-xs text-zinc-500"><strong className="text-zinc-800">{item.to_status.replaceAll('_', ' ')}</strong> · {item.actor_name} · {new Date(item.created_at).toLocaleString()}</p>)}</div>}
    </article>
  );
}

function PaymentPanel({ requests, token, inputs, setInputs, runAction, busy }) {
  return (
    <section><div className="mb-4"><h2 className="text-lg font-black">Payment requests</h2><p className="text-sm text-zinc-500">Confirm receipts here. Credit balances remain open until recorded payments settle them.</p></div>
      {requests.length ? <div className="grid gap-3">{requests.map(item => {
        const input = inputs[item.id] || { amount: item.amount, transaction_id: '', notes: '', method: 'CASH' };
        const update = patch => setInputs(current => ({ ...current, [item.id]: { ...input, ...patch } }));
        const isCredit = item.payment_method === 'CREDIT' || item.status === 'OUTSTANDING';
        const pending = item.status === 'PENDING';
        const settle = async () => {
          await request(isCredit ? `/orders/${item.order_id}/payments` : `/payments/${item.id}/confirm`, token, {
            method: 'POST', body: isCredit
              ? { amount: input.amount, payment_method: input.method, transaction_id: input.transaction_id, notes: input.notes }
              : { amount: input.amount, transaction_id: input.transaction_id, notes: input.notes },
          });
        };
        return <article key={item.id} className="grid gap-4 rounded-xl border border-zinc-200 bg-white p-4 lg:grid-cols-[1fr_1.2fr] lg:items-center"><div><div className="flex flex-wrap items-center gap-2"><p className="font-black">{item.reference} · Table {item.table_id}</p><span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${pending ? 'bg-amber-100 text-amber-900' : isCredit ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}`}>{item.status}</span></div><p className="mt-1 text-sm text-zinc-500">{item.waiter_name} · {item.payment_method.replaceAll('_', ' ')} · Requested {money(item.amount)}</p><p className="mt-1 text-xs text-zinc-500">Paid {money(item.amount_paid)} · Outstanding {money(item.outstanding_amount)}</p></div>
          {(pending || (isCredit && Number(item.outstanding_amount) > 0)) && <div className="grid gap-2 sm:grid-cols-2"><Field label={isCredit ? 'Payment amount' : 'Amount received'} type="number" min="0.01" max={item.outstanding_amount} step="0.01" value={input.amount} onChange={event => update({ amount: event.target.value })} /><label className="grid gap-1.5 text-xs font-semibold text-zinc-600">{isCredit ? 'Method received' : 'Transaction / reference ID'}{isCredit ? <select value={input.method} onChange={event => update({ method: event.target.value })} className="rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm">{METHODS.filter(([method]) => method !== 'CREDIT').map(([method, label]) => <option key={method} value={method}>{label}</option>)}</select> : <input value={input.transaction_id} onChange={event => update({ transaction_id: event.target.value })} placeholder={item.payment_method.includes('MONEY') || item.payment_method === 'CARD' ? 'Required' : 'Optional'} className="rounded-lg border border-zinc-200 px-3 py-2.5 text-sm" />}</label>{isCredit && ['MTN_MOBILE_MONEY', 'AIRTEL_MONEY', 'CARD'].includes(input.method) && <Field label="Transaction / reference ID" value={input.transaction_id} onChange={event => update({ transaction_id: event.target.value })} required />}<Field label="Confirmation note" value={input.notes} onChange={event => update({ notes: event.target.value })} /><div className="flex items-end"><Button tone="accent" disabled={busy} onClick={() => runAction(settle, isCredit ? 'Credit settlement recorded.' : 'Payment confirmed.')}>{isCredit ? 'Record payment' : 'Confirm payment'}</Button></div></div>}
        </article>;
      })}</div> : <Empty text="No payment requests to review." />}
    </section>
  );
}

function ReportsPanel({ report, mode, setMode, from, to, setFrom, setTo, reportMonth, setReportMonth, onDownload }) {
  const summary = report?.summary || {};
  const stats = [
    ['Orders', summary.total_orders, ClipboardList],
    ['Total sales', money(summary.total_sales), CircleDollarSign],
    ['Collected', money(summary.amount_collected), Wallet],
    ['Outstanding', money(summary.total_outstanding), CircleDollarSign],
    ['Partially paid', `${money(summary.partially_paid_amount)} · ${summary.partially_paid_orders || 0} orders`, ClipboardList],
    ['Fully settled', summary.fully_settled_orders, Check],
  ];
  return (
    <section><div className="mb-5 flex flex-col justify-between gap-4 lg:flex-row lg:items-end"><div><h2 className="text-lg font-black">Shisha sales & finance</h2><p className="text-sm text-zinc-500">Shisha department totals only; restaurant cashier data is not included.</p></div><div className="flex flex-wrap gap-2">{[['today', 'Today'], ['yesterday', 'Yesterday'], ['week', 'This week'], ['month', 'This month'], ['specific-month', 'Select month'], ['custom', 'Custom']].map(([value, label]) => <button key={value} onClick={() => setMode(value)} className={`rounded-lg px-3 py-2 text-xs font-bold ${mode === value ? 'bg-zinc-900 text-white' : 'border border-zinc-200 bg-white text-zinc-600'}`}>{label}</button>)}<button type="button" onClick={onDownload} disabled={!report || report.from !== from || report.to !== to} className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-3 py-2 text-xs font-bold text-zinc-950 hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"><Download size={15} /> Download PDF</button></div></div>
      {mode === 'specific-month' && <div className="mb-4 max-w-xs"><Field label="Report month" type="month" value={reportMonth} onChange={event => setReportMonth(event.target.value)} /></div>}
      {mode === 'custom' && <div className="mb-4 flex flex-wrap gap-3"><Field label="From" type="date" value={from} onChange={event => setFrom(event.target.value)} /><Field label="To" type="date" value={to} onChange={event => setTo(event.target.value)} /></div>}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{stats.map(([label, value, Icon]) => <article key={label} className="rounded-xl border border-zinc-200 bg-white p-4"><div className="flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-wider text-zinc-500">{label}</span><Icon size={16} className="text-amber-700" /></div><p className="mt-3 text-2xl font-black">{value ?? 0}</p></article>)}</div>
      <div className="grid gap-5 xl:grid-cols-2"><div className="overflow-hidden rounded-xl border border-zinc-200 bg-white"><div className="border-b border-zinc-100 px-4 py-4"><h3 className="font-black">Sales by Shisha waiter</h3></div>{(report?.by_waiter || []).map(row => <div key={row.waiter_id} className="grid grid-cols-[1fr_auto] gap-3 border-b border-zinc-100 px-4 py-3 last:border-0"><div><p className="text-sm font-bold">{row.waiter_name}</p><p className="text-xs text-zinc-500">{row.total_orders} orders · {money(row.amount_collected)} collected</p></div><p className="text-sm font-black">{money(row.total_sales)}</p></div>)}{!report?.by_waiter?.length && <p className="px-4 py-8 text-center text-sm text-zinc-400">No orders in this date range.</p>}</div>
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white"><div className="border-b border-zinc-100 px-4 py-4"><h3 className="font-black">Collected by payment method</h3></div>{(report?.by_payment_method || []).map(row => <div key={row.payment_method} className="grid grid-cols-[1fr_auto] gap-3 border-b border-zinc-100 px-4 py-3 last:border-0"><div><p className="text-sm font-bold">{row.payment_method.replaceAll('_', ' ')}</p><p className="text-xs text-zinc-500">{row.payment_count} confirmed payments</p></div><p className="text-sm font-black">{money(row.amount)}</p></div>)}{!report?.by_payment_method?.length && <p className="px-4 py-8 text-center text-sm text-zinc-400">No confirmed payments in this date range.</p>}</div></div>
    </section>
  );
}