import React, { useState, useEffect, useMemo } from "react";
import StaffOrderMenu from "./StaffOrderMenu";
import { useData } from "../../../customer/components/context/DataContext";
import { useTheme } from "../../../customer/components/context/ThemeContext";
import { 
  Plus, Minus, Trash2, Send, X, RefreshCcw, ChevronLeft, 
  ShoppingCart, UtensilsCrossed, Check, Printer, Search, LayoutGrid
} from "lucide-react";
import ThemeToggle from "../../../customer/components/context/ThemeToggle";
import { getImageSrc } from "../../../utils/imageHelper";
import API_URL from "../../../config/api";

export default function NewOrder() {
  const { orders = [], setOrders, menus = [], currentUser } = useData() || { setOrders: () => {}, orders: [], menus: [] };
  const { theme } = useTheme();
  
  // --- 1. PERSISTENT STATE INITIALIZATION ---
  const [tableName, setTableName] = useState(() => {
    return localStorage.getItem("kurax_table_name") || "";
  });
  
  const [cart, setCart] = useState(() => {
    const savedCart = localStorage.getItem("kurax_staff_cart");
    return savedCart ? JSON.parse(savedCart) : [];
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [activeCategory, setActiveCategory] = useState("Starters");

  // --- 2. LOCAL STORAGE SYNC ---
  useEffect(() => {
    localStorage.setItem("kurax_staff_cart", JSON.stringify(cart));
    localStorage.setItem("kurax_table_name", tableName);
  }, [cart, tableName]);

  const currentWaiter = currentUser?.name || "Waiter";

  // --- 3. CALCULATIONS ---
  const cartTotal = useMemo(() => 
    cart.reduce((sum, item) => sum + (Number(item.price || 0) * item.quantity), 0)
  , [cart]);

  const activeTables = useMemo(() => [
    ...new Set(orders
      .filter(o => o.status !== "Served" && o.status !== "Paid")
      .map(o => o.tableName?.toUpperCase()))
  ].filter(Boolean), [orders]);

  // --- 4. HANDLERS ---
  const handleSelectTable = (name) => {
    const upperName = name.toUpperCase();
    setTableName(upperName);
    
    // Auto-merge logic if table already has an active order
    const existingOrder = orders.find(
      o => o.tableName?.toUpperCase() === upperName && !["Served", "Paid"].includes(o.status)
    );
    
    if (existingOrder && cart.length === 0) {
      setCart(existingOrder.items.map(item => ({ ...item, fromPrevious: true })));
    }
  };

  const addToCart = (item) => {
    setCart(prev => {
      const existingItem = prev.find(i => i.id === item.id);
      if (existingItem) {
        return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { 
        ...item, 
        quantity: 1, 
        note: "", 
        station: item.station || "Kitchen",
        status: "Pending" 
      }]; 
    });
  };

  const updateQuantity = (id, delta) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) return { ...item, quantity: Math.max(1, item.quantity + delta) };
      return item;
    }));
  };

  const clearCart = () => {
    if (window.confirm("Clear the entire cart and table selection?")) {
      setCart([]);
      setTableName("");
      localStorage.removeItem("kurax_staff_cart");
      localStorage.removeItem("kurax_table_name");
    }
  };

  const handleProcessOrder = async () => {
    if (!tableName) return alert("Please assign a table name/number.");
    if (cart.length === 0) return alert("Cart is empty.");

const orderData = {
      staffId: currentUser?.id || 1,
      staffRole: currentUser?.role || "WAITER", 
      tableName: tableName.toUpperCase(),
      items: cart,
      total: cartTotal,
      paymentMethod: "Cash"
    };

    try {
     const response = await fetch(`${API_URL}/api/orders`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(orderData),
});

      const data = await response.json();

      if (response.ok) {
        setOrders(prev => [data, ...prev]);
        setShowSuccess(true);
        // Clear everything on success
        setCart([]); 
        setTableName("");
        localStorage.removeItem("kurax_staff_cart");
        localStorage.removeItem("kurax_table_name");
      } else {
        alert(data.error || "Order failed to sync.");
      }
    } catch (err) {
      console.error("Transmission Error:", err);
      alert("Network error. Check if backend is running.");
    }
  };
const activeMenus = useMemo(() => (menus || []).filter(item => {
  // Check for 'live' status OR various boolean formats
  const isLive = item.status === 'live' || item.published === true || item.published === 't';
  
  // Normalize strings (trim and lowercase) to avoid "Local Foods" vs "local foods"
  const itemCat = item.category?.toLowerCase().trim() || "";
  const activeCat = activeCategory?.toLowerCase().trim() || "";
  
  return isLive && itemCat === activeCat && item.name.toLowerCase().includes(searchQuery.toLowerCase());
}), [menus, activeCategory, searchQuery]);

  return (
    <div className={`flex flex-col lg:flex-row h-screen font-[Outfit] overflow-hidden transition-colors duration-500 ${theme === 'dark' ? 'bg-black text-white' : 'bg-gray-50 text-black'}`}>

      <CartModal 
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cart={cart}
        updateQuantity={updateQuantity}
        updateNote={(id, note) => setCart(prev => prev.map(i => i.id === id ? { ...i, note } : i))}
        removeFromCart={(id) => setCart(prev => prev.filter(i => i.id !== id))}
        clearCart={clearCart}
        tableName={tableName}
        handleSelectTable={handleSelectTable}
        cartTotal={cartTotal}
        handleProcessOrder={handleProcessOrder}
        activeTables={activeTables}
        theme={theme}
      />

      <SuccessOrderModal isOpen={showSuccess} onClose={() => setShowSuccess(false)} theme={theme} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className={`p-6 border-b ${theme === 'dark' ? 'bg-black/80 border-white/5' : 'bg-white border-black/5'}`}>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-1.5 h-8 bg-yellow-500 rounded-full" />
            <h2 className="text-3xl font-medium uppercase tracking-widest">Explore Menu</h2>
          </div>

          <div className="flex items-center gap-3 w-full">
            <div className="relative flex-grow">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
              <input 
                type="text" placeholder="Search items..." value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full border-none rounded-2xl py-4 pl-12 pr-4 text-sm font-bold outline-none transition-all ${
                  theme === 'dark' ? 'bg-zinc-900 text-white focus:ring-1 ring-yellow-500/50' : 'bg-zinc-100 text-zinc-900 focus:ring-1 ring-yellow-500'
                }`}
              />
            </div>
            <ThemeToggle />
            <button 
              onClick={() => setIsCartOpen(true)} 
              className="relative w-12 h-12 rounded-full bg-yellow-500 flex items-center justify-center shrink-0 shadow-lg active:scale-95 transition-transform"
            >
              <ShoppingCart size={24} className="text-black" />
              {cart.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-black text-white text-[10px] font-black w-6 h-6 rounded-full flex items-center justify-center border-2 border-yellow-500">
                  {cart.length}
                </span>
              )}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 md:px-6 py-6 custom-scrollbar">
          <StaffOrderMenu 
            onAddItem={addToCart} 
            searchQuery={searchQuery}
            activeCategory={activeCategory}
            setActiveCategory={setActiveCategory}
            items={activeMenus} 
          />
        </div>
      </div>
    </div>
  );
}

function CartModal({ 
  isOpen, onClose, cart, updateQuantity, updateNote, removeFromCart, 
  clearCart, tableName, handleSelectTable, cartTotal, 
  handleProcessOrder, activeTables, theme 
}) {
  const [tableInput, setTableInput] = useState(tableName || "");
  const [showDropdown, setShowDropdown] = useState(false);

  // Sync external tableName into local input on open
  React.useEffect(() => {
    setTableInput(tableName || "");
  }, [tableName, isOpen]);

  if (!isOpen) return null;

  const isDark = theme === "dark";

  // Show suggestions only when input has text AND matches existing tables
  const suggestions = activeTables.filter(t =>
    t.toLowerCase().includes(tableInput.toLowerCase()) && tableInput.length > 0
  );

  const handleInputChange = (val) => {
    setTableInput(val);
    setShowDropdown(true);
    // Immediately confirm as table name — waiter can type anything
    handleSelectTable(val.toUpperCase().trim());
  };

  const handlePickSuggestion = (t) => {
    setTableInput(t);
    setShowDropdown(false);
    handleSelectTable(t);
  };

  const handleClear = () => {
    setTableInput("");
    setShowDropdown(false);
    handleSelectTable("");
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center bg-black/90 backdrop-blur-md">
      <div className={`w-full sm:max-w-lg h-[95dvh] sm:h-[90vh] flex flex-col 
        rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl overflow-hidden
        ${isDark ? "bg-zinc-900 border border-white/10 text-white" : "bg-white text-zinc-900"}`}>

        {/* ── HEADER ── */}
        <div className={`shrink-0 px-5 pt-5 pb-4 border-b ${isDark ? "border-white/5" : "border-black/5"}`}>

          {/* Drag handle */}
          <div className="w-10 h-1 rounded-full bg-zinc-600 mx-auto mb-4 sm:hidden" />

          {/* Title row */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-black uppercase italic text-yellow-500 tracking-tighter leading-none">
                Current Order
              </h2>
              {cart.length > 0 && (
                <span className="w-6 h-6 rounded-full bg-yellow-500 text-black text-[10px] font-black flex items-center justify-center">
                  {cart.reduce((s, i) => s + i.quantity, 0)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {cart.length > 0 && (
                <button
                  onClick={clearCart}
                  className="flex items-center gap-1.5 text-[10px] font-black px-3 py-2 rounded-xl border border-rose-500/30 text-rose-500 hover:bg-rose-500/10 transition-all"
                >
                  <RefreshCcw size={11} /> Reset
                </button>
              )}
              <button
                onClick={onClose}
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all
                  ${isDark ? "bg-white/5 hover:bg-white/10" : "bg-zinc-100 hover:bg-zinc-200"}`}
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* ── TABLE INPUT ── */}
          <div className="relative">
            <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 ml-1 mb-1.5 block">
              Table Name or Number
            </label>

            <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl border-2 transition-all
              ${tableInput
                ? "border-yellow-500 bg-yellow-500/5"
                : isDark ? "bg-black/40 border-white/10" : "bg-zinc-50 border-black/8"}`}>

              <UtensilsCrossed size={15} className={tableInput ? "text-yellow-500" : "text-zinc-500"} />

              <input
                type="text"
                placeholder="Type e.g. TABLE 5, VIP, ROOFTOP, WALK-IN..."
                value={tableInput}
                onChange={(e) => handleInputChange(e.target.value)}
                onFocus={() => setShowDropdown(true)}
                onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                className="bg-transparent outline-none flex-1 text-sm font-black uppercase tracking-wide placeholder:text-zinc-500 placeholder:font-medium placeholder:normal-case"
              />

              {tableInput ? (
                <button
                  onClick={handleClear}
                  className="text-zinc-500 hover:text-rose-400 transition-colors shrink-0"
                >
                  <X size={14} />
                </button>
              ) : (
                <Search size={14} className="text-zinc-600 shrink-0" />
              )}
            </div>

            {/* Suggestions dropdown — only when existing tables match */}
            {showDropdown && suggestions.length > 0 && (
              <div className={`absolute top-full left-0 right-0 z-[310] mt-2 rounded-2xl shadow-2xl border overflow-hidden
                ${isDark ? "bg-zinc-800 border-white/10" : "bg-white border-black/10 shadow-xl"}`}>
                <p className={`px-4 pt-3 pb-1 text-[9px] font-black uppercase tracking-widest
                  ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
                  Existing Tables — tap to select
                </p>
                <div className="max-h-44 overflow-y-auto pb-2">
                  {suggestions.map(t => (
                    <button
                      key={t}
                      onMouseDown={() => handlePickSuggestion(t)}
                      className="w-full text-left px-4 py-3 text-xs font-black uppercase tracking-widest transition-colors flex items-center gap-3 hover:bg-yellow-500 hover:text-black group"
                    >
                      <span className="w-2 h-2 rounded-full bg-emerald-500 group-hover:bg-black transition-colors" />
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Helper text */}
            <p className={`text-[10px] mt-1.5 ml-1 font-bold transition-colors
              ${tableInput ? "text-yellow-500" : isDark ? "text-zinc-600" : "text-zinc-400"}`}>
              {tableInput
                ? `✓ Sending to: ${tableInput.toUpperCase()}`
                : "Type any name — existing table or new"}
            </p>
          </div>
        </div>

        {/* ── CART ITEMS ── */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 opacity-20 py-16">
              <LayoutGrid size={52} className="text-zinc-500" />
              <p className="italic font-black uppercase text-xs tracking-widest">Cart is empty</p>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.id} className={`rounded-2xl border overflow-hidden
                ${isDark ? "bg-black/40 border-white/5" : "bg-zinc-50 border-black/5"}`}>

                <div className="flex gap-3 p-3">
                  <img
                    src={getImageSrc(item.image_url)}
                    className="w-16 h-16 rounded-xl object-cover shrink-0 shadow"
                    alt={item.name}
                    onError={(e) => e.target.src = "https://via.placeholder.com/150"}
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-black uppercase text-sm tracking-tight leading-tight truncate">
                        {item.name}
                      </h4>
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="shrink-0 w-7 h-7 rounded-lg bg-rose-500/10 flex items-center justify-center hover:bg-rose-500/20 transition-all"
                      >
                        <Trash2 size={13} className="text-rose-500" />
                      </button>
                    </div>

                    <p className="text-[11px] font-black text-yellow-500 mt-0.5">
                      UGX {(Number(item.price || 0) * item.quantity).toLocaleString()}
                    </p>

                    <div className="flex items-center gap-2 mt-2">
                      <div className={`flex items-center rounded-xl overflow-hidden border
                        ${isDark ? "border-white/10 bg-black/30" : "border-black/8 bg-white"}`}>
                        <button
                          onClick={() => updateQuantity(item.id, -1)}
                          className="w-9 h-9 flex items-center justify-center hover:bg-yellow-500 hover:text-black transition-all font-black text-xl leading-none"
                        >
                          −
                        </button>
                        <span className="w-8 text-center text-sm font-black">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.id, 1)}
                          className="w-9 h-9 flex items-center justify-center hover:bg-yellow-500 hover:text-black transition-all font-black text-xl leading-none"
                        >
                          +
                        </button>
                      </div>
                      <span className="text-[10px] text-zinc-500 font-bold">
                        × UGX {Number(item.price || 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Kitchen note */}
                <div className="px-3 pb-3">
                  <input
                    type="text"
                    placeholder="Kitchen note (e.g. no onions, extra spicy)..."
                    value={item.note || ""}
                    onChange={(e) => updateNote(item.id, e.target.value)}
                    className={`w-full text-xs py-2.5 px-3.5 rounded-xl border bg-transparent outline-none italic transition-all
                      ${isDark
                        ? "border-white/5 focus:border-yellow-500/40 placeholder:text-zinc-600"
                        : "border-black/8 focus:border-yellow-500 placeholder:text-zinc-400"}`}
                  />
                </div>
              </div>
            ))
          )}
        </div>

        {/* ── FOOTER ── */}
        <div className={`shrink-0 border-t px-4 py-4 space-y-3
          ${isDark ? "bg-black/60 border-white/5" : "bg-zinc-50 border-black/5"}`}>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Order Total</p>
              <p className="text-2xl font-black text-yellow-500 leading-tight">
                UGX {cartTotal.toLocaleString()}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Items</p>
              <p className="text-2xl font-black leading-tight">
                {cart.reduce((s, i) => s + i.quantity, 0)}
              </p>
            </div>
          </div>

          <button
            onClick={handleProcessOrder}
            disabled={cart.length === 0 || !tableInput.trim()}
            className={`w-full py-4 font-black rounded-2xl flex items-center justify-center gap-3
              uppercase tracking-widest text-sm transition-all active:scale-[0.98]
              ${cart.length > 0 && tableInput.trim()
                ? "bg-yellow-500 text-black shadow-lg shadow-yellow-500/20 hover:bg-yellow-400"
                : "bg-zinc-800 text-zinc-600 cursor-not-allowed"}`}
          >
            <Send size={18} />
            {!tableInput.trim()
              ? "Enter a Table Name First"
              : cart.length === 0
                ? "Add Items to Order"
                : `Send to Stations · ${tableInput.trim().toUpperCase()}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function SuccessOrderModal({ isOpen, onClose, theme }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl animate-in fade-in duration-500">
      <div className={`w-full max-w-md rounded-[3.5rem] p-12 text-center shadow-2xl ${theme === 'dark' ? 'bg-zinc-900 border border-white/10' : 'bg-white'}`}>
        <div className="w-24 h-24 bg-emerald-500 rounded-full flex items-center justify-center text-white mx-auto mb-8 shadow-xl shadow-emerald-500/30">
          <Check size={48} strokeWidth={4} />
        </div>
        <h2 className="text-3xl font-black uppercase italic tracking-tighter mb-4">Transmission Successful</h2>
        <p className="text-zinc-500 text-sm mb-10 font-bold uppercase tracking-widest">Kitchen & Bar tickets generated</p>
        
        <div className="space-y-4">
          <button onClick={() => window.print()} className="w-full py-5 bg-zinc-900 text-white dark:bg-white dark:text-black rounded-2xl font-black uppercase text-xs flex items-center justify-center gap-3 hover:opacity-90 transition-opacity">
            <Printer size={20} /> Print Duplicate Voucher
          </button>
          <button onClick={onClose} className="w-full py-5 text-yellow-500 font-black uppercase text-xs tracking-widest hover:bg-yellow-500/5 rounded-2xl transition-colors">Return to Menu</button>
        </div>
      </div>
    </div>
  );
}