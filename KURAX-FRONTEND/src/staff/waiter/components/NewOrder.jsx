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

/* ---------------- SUB-COMPONENTS ---------------- */

function CartModal({ 
  isOpen, onClose, cart, updateQuantity, updateNote, removeFromCart, 
  clearCart, tableName, handleSelectTable, cartTotal, 
  handleProcessOrder, activeTables, theme 
}) {
  const [tableSearch, setTableSearch] = useState("");
  if (!isOpen) return null;

  const searchedTables = activeTables.filter(t => t.toLowerCase().includes(tableSearch.toLowerCase()));

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
      <div className={`w-full max-w-2xl h-[90vh] overflow-hidden flex flex-col rounded-[3rem] shadow-2xl transition-all ${
        theme === 'dark' ? 'bg-zinc-900 border border-white/10 text-white' : 'bg-white text-zinc-900'
      }`}>
        
        <div className="p-8 border-b border-zinc-500/10 shrink-0">
          <div className="flex justify-between items-center mb-6">
             <div className="flex items-center gap-4">
                <h2 className="text-2xl font-black uppercase italic text-yellow-500 tracking-tighter">Current Order</h2>
                <button onClick={clearCart} className="text-[10px] font-black px-4 py-2 rounded-full border border-rose-500/30 text-rose-500 hover:bg-rose-500/10 transition-all">
                  <RefreshCcw size={12} className="inline mr-1" /> RESET
                </button>
             </div>
             <button onClick={onClose} className="p-3 rounded-2xl bg-zinc-500/10 hover:bg-zinc-500/20"><X size={24} /></button>
          </div>

          <div className="relative">
            <div className={`flex items-center gap-3 px-5 py-4 rounded-2xl border transition-all ${theme === 'dark' ? 'bg-black/40 border-white/10' : 'bg-zinc-50 border-black/5'}`}>
              <Search size={18} className="text-zinc-500" />
              <input 
                type="text" placeholder="Quick find active tables..." 
                value={tableSearch} onChange={(e) => setTableSearch(e.target.value)}
                className="bg-transparent outline-none flex-1 text-sm font-bold uppercase italic"
              />
            </div>
            {tableSearch && (
              <div className={`absolute top-full left-0 right-0 z-[310] mt-2 p-3 rounded-2xl shadow-2xl border animate-in slide-in-from-top-2 ${theme === 'dark' ? 'bg-zinc-800 border-white/10' : 'bg-white border-black/10'}`}>
                {searchedTables.length > 0 ? searchedTables.map(t => (
                  <button key={t} onClick={() => { handleSelectTable(t); setTableSearch(""); }} className="w-full text-left p-4 hover:bg-yellow-500 hover:text-black rounded-xl text-xs font-black uppercase italic transition-colors">
                    {t}
                  </button>
                )) : <div className="p-4 text-xs font-black text-zinc-500 uppercase italic">No active table matching "{tableSearch}"</div>}
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-4 custom-scrollbar">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center space-y-4 opacity-20">
               <LayoutGrid className="text-zinc-500" size={64} />
               <p className="italic font-black uppercase text-xs tracking-widest">Your cart is empty</p>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.id} className={`p-5 rounded-[2.5rem] border ${theme === 'dark' ? 'bg-black/40 border-white/5' : 'bg-zinc-50 border-black/5'}`}>
                <div className="flex gap-5">
                  <img 
                    src={getImageSrc(item.image_url)} 
                    className="w-20 h-20 rounded-3xl object-cover shadow-lg" alt={item.name} 
                    onError={(e) => e.target.src = "https://via.placeholder.com/150"}
                  />
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <h4 className="font-black uppercase text-base tracking-tight">{item.name}</h4>
                      <button onClick={() => removeFromCart(item.id)} className="text-zinc-400 hover:text-rose-500 transition-colors"><Trash2 size={20} /></button>
                    </div>
                    <div className="flex items-center gap-4 mt-4">
                      <div className="flex items-center gap-4 px-3 py-2 rounded-xl bg-zinc-500/10">
                        <button onClick={() => updateQuantity(item.id, -1)} className="p-1 hover:text-yellow-500"><Minus size={16}/></button>
                        <span className="text-base font-black w-6 text-center">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.id, 1)} className="p-1 hover:text-yellow-500"><Plus size={16}/></button>
                      </div>
                      <input 
                        type="text" placeholder="Add kitchen note..." value={item.note || ""}
                        onChange={(e) => updateNote(item.id, e.target.value)}
                        className="flex-1 text-xs py-2 px-4 rounded-xl border bg-transparent outline-none italic border-zinc-500/20 focus:border-yellow-500/50"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className={`p-8 border-t ${theme === 'dark' ? 'bg-black/60 border-white/10' : 'bg-zinc-50 border-black/10'}`}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center mb-8">
            <div className="w-full">
              <label className="text-[10px] font-black uppercase text-zinc-500 ml-2 mb-2 block">Table Allocation</label>
              <div className={`flex items-center gap-4 px-6 py-5 rounded-2xl border-2 transition-all ${tableName ? 'border-yellow-500 bg-yellow-500/5' : 'border-zinc-500/20'}`}>
                <UtensilsCrossed size={20} className={tableName ? 'text-yellow-500' : 'text-zinc-500'} />
                <input 
                  type="text" placeholder="NAME OR NUMBER" 
                  value={tableName} onChange={(e) => handleSelectTable(e.target.value)}
                  className="bg-transparent outline-none flex-1 font-black uppercase text-base italic placeholder:text-zinc-600"
                />
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs font-black text-zinc-500 uppercase tracking-[0.2em]">Total Amount</span>
              <div className="text-3xl font-black text-yellow-500 mt-1">UGX {cartTotal.toLocaleString()}</div>
            </div>
          </div>
          <button 
            onClick={handleProcessOrder}
            disabled={cart.length === 0 || !tableName}
            className="w-full py-7 font-black rounded-3xl flex items-center justify-center gap-4 uppercase italic tracking-tighter text-lg bg-yellow-500 text-black shadow-xl shadow-yellow-500/20 active:scale-[0.98] transition-all disabled:opacity-20 disabled:grayscale"
          >
            <Send size={24} /> Sync Order to Stations
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