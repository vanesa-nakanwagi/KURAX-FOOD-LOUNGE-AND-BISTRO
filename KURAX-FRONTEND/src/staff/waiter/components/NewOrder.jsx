import React, { useState, useEffect } from "react";
import StaffOrderMenu from "./StaffOrderMenu";
import { useData } from "../../../customer/components/context/DataContext";
import { useTheme } from "../../../customer/components/context/ThemeContext";
import { 
  Plus, Minus, Trash2, Send, X, RefreshCcw, ChevronLeft, 
   ShoppingCart, UtensilsCrossed, Check, Printer, QrCode, History, Search, LayoutGrid,
  Clock, Flame, CheckCircle
} from "lucide-react";
import ThemeToggle from "../../../customer/components/context/ThemeToggle";

export default function NewOrder() {
  const { orders = [], setOrders } = useData() || { setOrders: () => {}, orders: [] };
  const { theme } = useTheme();
  const currentWaiter = "John Doe"; 

  const [tableName, setTableName] = useState("");
  const [cart, setCart] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // --- FIXED: Define cartTotal in the main component body so it is accessible everywhere ---
  const cartTotal = cart.reduce((sum, item) => sum + (Number(item.price) * item.quantity), 0);

  const activeTables = [...new Set(orders
    .filter(o => o.status !== "Served")
    .map(o => o.tableName))].filter(Boolean);

 const handleSelectTable = (name) => {
  const upperName = name.toUpperCase();
  setTableName(upperName);
  
  const existingOrder = orders.find(
    o => o.tableName?.toUpperCase() === upperName && o.status !== "Served"
  );
  
  if (existingOrder) {
    // We merge: Existing items + whatever is currently in the waiter's cart
    setCart(prevCart => {
      const merged = [...existingOrder.items];
      
      prevCart.forEach(newItem => {
        const existingItemIndex = merged.findIndex(i => i.id === newItem.id);
        if (existingItemIndex !== -1) {
          // If item exists in both, update quantity
          merged[existingItemIndex].quantity += newItem.quantity;
        } else {
          // If it's a new item (like the Burger), add it to the list
          merged.push(newItem);
        }
      });
      return merged;
    });
  }
};

const playNotification = () => {
  const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
  audio.play().catch(err => console.log("Audio play blocked", err));
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

  const removeFromCart = (id) => setCart(prev => prev.filter(item => item.id !== id));

  const updateQuantity = (id, delta) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) return { ...item, quantity: Math.max(1, item.quantity + delta) };
      return item;
    }));
  };

  const updateNote = (id, note) => {
    setCart(prev => prev.map(item => item.id === id ? { ...item, note } : item));
  };

 const handleProcessOrder = () => {
  if (!tableName) return alert("Please select a table");
  if (cart.length === 0) return alert("Cart is empty");

  setOrders(prev => {
    // 1. Create a copy of the current orders to mutate safely
    let updatedOrders = [...prev];

    // 2. Define the stations we need to process
    const stations = ["Kitchen", "Barman", "Barista"];

    stations.forEach(stationTag => {
      const stationItemsInCart = cart.filter(item => item.station === stationTag);
      
      if (stationItemsInCart.length > 0) {
        // Find if there is an existing, active (unarchived/unserved) docket for this table + station
        const existingOrderIndex = updatedOrders.findIndex(
          o => o.tableName?.toUpperCase() === tableName.toUpperCase() && 
               o.station === stationTag && 
               !o.isArchived && 
               o.status !== "Served"
        );

        if (existingOrderIndex !== -1) {
          // --- APPEND LOGIC ---
          const existingOrder = updatedOrders[existingOrderIndex];
          
          // Merge items: if item exists, update quantity; if not, push new
          const mergedItems = [...existingOrder.items];
          stationItemsInCart.forEach(newItem => {
            const itemIdx = mergedItems.findIndex(i => i.id === newItem.id);
            if (itemIdx !== -1) {
              mergedItems[itemIdx].quantity += newItem.quantity;
            } else {
              mergedItems.push(newItem);
            }
          });

          // Update the existing docket with merged items and new total
          updatedOrders[existingOrderIndex] = {
            ...existingOrder,
            items: mergedItems,
            total: mergedItems.reduce((sum, i) => sum + (Number(i.price) * i.quantity), 0),
            timestamp: new Date().toISOString() // Update time to show latest activity
          };
        } else {
          // --- NEW DOCKET LOGIC ---
          // If no active docket for this station, create a fresh one
          const newOrder = {
            id: `ORD-${stationTag.charAt(0)}-${Date.now().toString().slice(-4)}`,
            tableName: tableName.trim().toUpperCase(),
            items: stationItemsInCart,
            total: stationItemsInCart.reduce((sum, i) => sum + (Number(i.price) * i.quantity), 0),
            status: "Pending",
            station: stationTag,
            isArchived: false,
            isPaid: false,
            timestamp: new Date().toISOString(),
            waiterName: currentWaiter,
          };
          updatedOrders.push(newOrder);
        }
      }
    });

    playNotification();
    return updatedOrders;
  });

  setShowSuccess(true);
  setCart([]); 
  setTableName("");
};


// Add this method here
  const clearCart = () => {
    if (window.confirm("Clear the entire cart? This will empty your current selection.")) {
      setCart([]);
      setTableName("");
    }
  };


  return (
    <div className={`flex flex-col lg:flex-row h-full font-[Outfit] overflow-hidden relative transition-colors duration-300 ${theme === 'dark' ? 'bg-black text-white' : 'bg-white text-black'}`}>

      <CartModal 
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cart={cart}
        updateQuantity={updateQuantity}
        updateNote={updateNote}
        removeFromCart={removeFromCart}
        clearCart={clearCart}
        tableName={tableName}
        handleSelectTable={handleSelectTable}
        cartTotal={cartTotal} // Passed correctly here
        handleProcessOrder={handleProcessOrder}
        activeTables={activeTables}
        theme={theme}
      />

      <SuccessOrderModal isOpen={showSuccess} onClose={() => setShowSuccess(false)} theme={theme} />
      
      {!isCartOpen && (
        <button onClick={() => setIsCartOpen(true)} className="lg:hidden fixed right-0 top-1/2 -translate-y-1/2 z-40 bg-yellow-500 text-black py-6 px-1.5 rounded-l-xl shadow-2xl flex flex-col items-center">
          <ChevronLeft size={16} />
        </button>
      )}

      <div className={`flex-1 px-4 md:px-6 py-6 overflow-y-auto ${theme === 'dark' ? 'bg-black' : 'bg-white'}`}>
        <div className="flex flex-col gap-6 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-8 bg-yellow-500 rounded-full" />
            <h2 className="text-3xl font-black uppercase italic tracking-tighter">Explore Menu</h2>
          </div>

          <div className="flex items-center gap-3 w-full">
            <div className="relative flex-grow">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
              <input 
                type="text" placeholder="Search items..." value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full border-none rounded-full py-4 pl-12 pr-4 text-sm font-bold outline-none ${theme === 'dark' ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-900'}`}
              />
            </div>
            <button onClick={() => setIsCartOpen(true)} className="relative w-14 h-14 rounded-full bg-yellow-500 flex items-center justify-center shrink-0 shadow-lg">
              <ShoppingCart size={24} className="text-black" />
              {cart.length > 0 && <span className="absolute -top-1 -right-1 bg-black text-white text-[10px] font-black w-6 h-6 rounded-full flex items-center justify-center border-2 border-yellow-500">{cart.length}</span>}
            </button>
            <ThemeToggle />
          </div>
        </div>
        <div className="pb-24"><StaffOrderMenu onAddItem={addToCart} searchQuery={searchQuery} /></div>
      </div>
    </div>
  );
}

// --- Sub-Components (StatusBadge, SuccessOrderModal, CartModal) remain the same ---

function StatusBadge({ status }) {
  const configs = {
    Pending: { color: "bg-zinc-500", icon: <Clock size={10} />, label: "In Queue" },
    Preparing: { color: "bg-blue-500", icon: <Flame size={10} />, label: "Cooking" },
    Ready: { color: "bg-emerald-500", icon: <CheckCircle size={10} />, label: "Ready" },
  };
  const config = configs[status] || configs.Pending;
  return (
    <div className={`${config.color} text-white text-[8px] font-black uppercase px-2 py-1 rounded-md flex items-center gap-1 mt-1`}>
      {config.icon} {config.label}
    </div>
  );
}

function CartModal({ 
  isOpen, onClose, cart, updateQuantity, updateNote, removeFromCart, 
  clearCart, tableName, handleSelectTable, cartTotal, 
  handleProcessOrder, activeTables, theme 
}) {
  const [tableSearch, setTableSearch] = useState("");

  

  if (!isOpen) return null;

  // Filter active tables based on search input
  const searchedTables = activeTables.filter(t => 
    t.toLowerCase().includes(tableSearch.toLowerCase())
  );

  

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className={`w-full max-w-2xl h-[85vh] overflow-hidden flex flex-col rounded-[3rem] shadow-2xl transition-all ${
        theme === 'dark' ? 'bg-zinc-900 border border-white/10 text-white' : 'bg-white text-zinc-900'
      }`}>
        
        {/* --- HEADER: Control Center --- */}
        <div className="p-6 border-b border-zinc-500/10 shrink-0 space-y-4">
          <div className="flex justify-between items-center">
             <div className="flex items-center gap-4">
                <h2 className="text-xl font-black uppercase italic text-yellow-500 tracking-tighter">Table Manager</h2>
                <button 
                  onClick={clearCart} 
                  className="flex items-center gap-2 text-[10px] font-black px-4 py-2 rounded-full border border-rose-500/20 text-rose-500 hover:bg-rose-500/10 transition-all active:scale-95"
                >
                  <RefreshCcw size={12} strokeWidth={3} /> NEW CUSTOMER
                </button>
             </div>
             <button onClick={onClose} className="p-2 rounded-full bg-zinc-500/10 hover:bg-zinc-500/20 transition-colors">
                <X size={24} />
             </button>
          </div>

          {/* SEARCH BAR: Find existing tables */}
          <div className="relative">
            <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all ${
              theme === 'dark' ? 'bg-black/40 border-white/10' : 'bg-zinc-100 border-black/5'
            } focus-within:border-yellow-500/50`}>
              <Search size={16} className="text-zinc-500" />
              <input 
                type="text" 
                placeholder="Quick search active tables..." 
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                className="bg-transparent outline-none flex-1 text-xs font-bold uppercase italic placeholder:text-zinc-500"
              />
            </div>
            
            {/* Search Dropdown Results */}
            {tableSearch && (
              <div className={`absolute top-full left-0 right-0 z-[310] mt-2 p-2 rounded-2xl shadow-2xl border animate-in fade-in zoom-in-95 duration-200 ${
                theme === 'dark' ? 'bg-zinc-800 border-white/10' : 'bg-white border-black/10'
              }`}>
                {searchedTables.length > 0 ? (
                  searchedTables.map(t => (
                    <button 
                      key={t}
                      onClick={() => {
                        handleSelectTable(t);
                        setTableSearch(""); 
                      }}
                      className="w-full text-left p-3 hover:bg-yellow-500 hover:text-black rounded-xl text-[10px] font-black uppercase transition-all flex justify-between items-center group"
                    >
                      {t}
                      <span className="opacity-0 group-hover:opacity-100 text-[8px] italic">Load Order</span>
                    </button>
                  ))
                ) : (
                  <div className="p-3 text-[10px] font-black text-zinc-500 uppercase italic">No matching table found</div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* --- MIDDLE: Scrollable Item List --- */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center space-y-4 opacity-30">
               <div className="w-16 h-16 bg-zinc-500/10 rounded-full flex items-center justify-center">
                  <LayoutGrid className="text-zinc-500" size={32} />
               </div>
               <div className="text-center">
                 <p className="italic font-black uppercase text-[10px] tracking-widest">Cart is Empty</p>
                 <p className="text-[9px] font-bold uppercase mt-1">Search or Type Table below to start</p>
               </div>
            </div>
          ) : (
            cart.map((item) => {
              const canDelete = item.status !== "Preparing" && item.status !== "Ready";
              return (
                <div key={item.id} className={`p-4 rounded-[2rem] border transition-all ${
                  theme === 'dark' ? 'bg-black/40 border-white/5' : 'bg-zinc-50 border-black/5'
                } ${!canDelete ? 'opacity-80' : ''}`}>
                  <div className="flex gap-4">
                    <div className="relative shrink-0">
                      <img src={item.image} className="w-16 h-16 rounded-2xl object-cover" alt={item.name} />
                      <span className="absolute -top-2 -right-2 bg-yellow-500 text-black text-[8px] font-black px-1.5 py-0.5 rounded-md uppercase">
                        {item.station}
                      </span>
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-black uppercase text-sm leading-tight">{item.name}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            <div className={`w-1.5 h-1.5 rounded-full ${item.status === 'Ready' ? 'bg-emerald-500' : 'bg-yellow-500 animate-pulse'}`} />
                            <span className="text-[8px] font-black uppercase tracking-tighter opacity-60 italic">{item.status}</span>
                          </div>
                        </div>
                        {canDelete && (
                          <button onClick={() => removeFromCart(item.id)} className="text-zinc-400 hover:text-rose-600 transition-colors">
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                      
                      <div className="flex flex-col sm:flex-row items-center gap-3 mt-4">
                        <div className={`flex items-center gap-3 p-1 rounded-xl ${theme === 'dark' ? 'bg-zinc-800' : 'bg-zinc-200'}`}>
                          <button onClick={() => updateQuantity(item.id, -1)} disabled={!canDelete} className="p-1 disabled:opacity-20"><Minus size={14}/></button>
                          <span className="text-sm font-black w-6 text-center">{item.quantity}</span>
                          <button onClick={() => updateQuantity(item.id, 1)} disabled={!canDelete} className="p-1 disabled:opacity-20"><Plus size={14}/></button>
                        </div>
                        <input 
                          type="text" placeholder="Add specific notes..." value={item.note || ""}
                          onChange={(e) => updateNote(item.id, e.target.value)}
                          className={`flex-1 text-[11px] py-2 px-4 rounded-xl border outline-none italic transition-all ${
                            theme === 'dark' ? 'bg-zinc-950 border-white/5 focus:border-yellow-500/50' : 'bg-white border-black/5 focus:border-yellow-500/50'
                          }`}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* --- FOOTER: Fixed Action Area --- */}
        <div className={`p-6 border-t shrink-0 ${theme === 'dark' ? 'bg-black/50 border-white/10' : 'bg-zinc-50 border-black/10'}`}>
          <div className="flex flex-col md:flex-row gap-6 items-center mb-6">
            <div className="w-full md:flex-1 relative">
              <label className="text-[9px] font-black uppercase text-zinc-500 mb-1 ml-2 block">Assigned Table</label>
              <div className={`flex items-center gap-3 px-5 py-4 rounded-2xl border-2 transition-all ${
                theme === 'dark' ? 'bg-zinc-900 border-white/5' : 'bg-white border-black/5'
              } focus-within:border-yellow-500`}>
                <UtensilsCrossed size={18} className="text-yellow-500" />
                <input 
                  type="text" 
                  placeholder="TYPE TABLE NAME" 
                  value={tableName}
                  onChange={(e) => handleSelectTable(e.target.value)}
                  className="bg-transparent outline-none flex-1 font-black uppercase text-sm italic placeholder:opacity-20"
                />
              </div>
            </div>

            <div className="text-right w-full md:w-auto shrink-0">
              <span className="text-[10px] font-black text-zinc-500 uppercase block">Running Total</span>
              <div className="text-2xl font-black tracking-tighter text-yellow-500">UGX {cartTotal.toLocaleString()}</div>
            </div>
          </div>

          <button 
            onClick={handleProcessOrder}
            disabled={cart.length === 0 || !tableName}
            className={`w-full py-6 font-black rounded-2xl flex items-center justify-center gap-3 uppercase italic shadow-2xl transition-all active:scale-95 ${
              (cart.length === 0 || !tableName) ? 'bg-zinc-200 text-zinc-400 cursor-not-allowed' : 'bg-yellow-500 text-black hover:bg-yellow-400 shadow-yellow-500/10'
            }`}
          >
            <Send size={20} strokeWidth={3} /> {activeTables.includes(tableName) ? "Update Existing Order" : "Send to Stations"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SuccessOrderModal({ isOpen, onClose, theme }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
      <div className={`w-full max-w-sm rounded-[3rem] p-8 text-center ${theme === 'dark' ? 'bg-zinc-900 border border-white/10' : 'bg-white'}`}>
        <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center text-white mx-auto mb-6 shadow-lg shadow-emerald-500/20">
          <Check size={32} strokeWidth={3} />
        </div>
        <h2 className={`text-xl font-black uppercase tracking-tighter mb-6 ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>Order Synchronized</h2>
        <div className="space-y-3">
          <button onClick={() => window.print()} className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-black uppercase text-[10px] flex items-center justify-center gap-3 hover:bg-black transition-all">
            <Printer size={18} /> Print Voucher
          </button>
          <button onClick={onClose} className="w-full py-4 text-yellow-500 font-black uppercase text-[10px]">Back to Menu</button>
        </div>
      </div>
    </div>
  );
}