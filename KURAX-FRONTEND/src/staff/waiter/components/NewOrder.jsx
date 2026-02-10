import React, { useState, useEffect } from "react";
import StaffOrderMenu from "./StaffOrderMenu";
import { useData } from "../../../customer/components/context/DataContext";
import { useTheme } from "../../../customer/components/context/ThemeContext";
import MomoPaymentModal from "./MomoPaymentModal";
import { 
  Banknote, CreditCard, Smartphone, Plus, Minus, Trash2,
  Send, X, RefreshCcw, ChevronLeft, Search, ShoppingCart, QrCode, Printer, Check,  UtensilsCrossed
} from "lucide-react";
import ThemeToggle from "../../../customer/components/context/ThemeToggle";

export default function NewOrder() {
 const { orders, setOrders } = useData() || { orders: [], setOrders: () => {} };
  const { theme } = useTheme();
  const currentWaiter = "John Doe"; 

  const [tableName, setTableName] = useState("");

  // --- STATE MANAGEMENT ---
  const [cart, setCart] = useState(() => {
    const savedCart = localStorage.getItem('kurax_waiter_cart');
    return savedCart ? JSON.parse(savedCart) : [];
  });

  const [showMomoModal, setShowMomoModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [searchQuery, setSearchQuery] = useState("");
  const [isCartOpen, setIsCartOpen] = useState(false);


  // Persistence
  useEffect(() => {
    localStorage.setItem('kurax_waiter_cart', JSON.stringify(cart));
  }, [cart]);

  // --- CART LOGIC ---
  const cartTotal = cart.reduce((sum, item) => sum + (Number(item.price) * item.quantity), 0);
  // Add 'orders' here so the function can see the existing list


  const startNewOrder = () => {
    if (cart.length > 0 && !window.confirm("Start a new order? This will clear current cart.")) return;
    setCart([]);
    setPaymentMethod("Cash");
    setSearchQuery("");
    localStorage.removeItem('kurax_waiter_cart');
  };


  const editOrder = (existingOrder) => {
  // 1. Move existing items to cart
  setCart(existingOrder.items);
  
  // 2. Set the table name so the waiter doesn't have to re-type it
  setTableName(existingOrder.tableName);
  
  // 3. Remove the old version of the order from the list
  // (It will be re-added as a new 'finalOrder' when they hit Send again)
  setOrders(prev => prev.filter(order => order.id !== existingOrder.id));
  
  // 4. Open the cart so they can see what they are editing
  setIsCartOpen(true);
};

 const addToCart = (item) => {
  setCart(prev => {
    const existingItem = prev.find(i => i.id === item.id);
    if (existingItem) {
      return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
    }
    return [...prev, { ...item, quantity: 1, note: "" }]; 
  });
};

const removeFromCart = (id) => {
  setCart(prev => prev.filter(item => item.id !== id));
};

  const updateQuantity = (id, delta) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const updateNote = (id, note) => {
  setCart(prev => prev.map(item => 
    item.id === id ? { ...item, note: note } : item
  ));
};

  const handleProcessOrder = () => {
  if (!tableName) {
    alert("Please enter a Table Name/Number first!");
    return;
  }

  // Check if this table already has an active (unpaid) order
  const existingOrder = orders.find(o => o.tableName === tableName && o.isPaid === false);

  if (existingOrder) {
    // UPDATE EXISTING ORDER (Customer asked for more items)
    const updatedOrders = orders.map(order => {
      if (order.id === existingOrder.id) {
        return {
          ...order,
          // Merge old items with new items in the cart
          items: [...order.items, ...cart.map(item => ({ ...item, isNew: true }))], 
          total: order.total + cartTotal,
          status: "Pending", // Reset to Pending so Chef sees it
        };
      }
      return order;
    });
    setOrders(updatedOrders);
  } else {
    // CREATE BRAND NEW ORDER
    const finalOrder = {
      id: `TBL-${tableName}-${Date.now().toString().slice(-4)}`,
      items: [...cart],
      total: cartTotal,
      paymentMethod,
      status: "Pending",
      isPaid: false,
      tableName,
      timestamp: new Date().toISOString(),
      waiterName: currentWaiter,
    };
    setOrders(prev => [...prev, finalOrder]);
  }

  // Reset everything
  setCart([]);
  setTableName("");
  setIsCartOpen(false); 
  localStorage.removeItem('kurax_waiter_cart');
};
  return (
    <div className={`flex flex-col lg:flex-row h-full font-[Outfit] overflow-hidden relative transition-colors duration-300
      ${theme === 'dark' ? 'bg-black text-white' : 'bg-white text-black'}`}>


    <CartModal 
      isOpen={isCartOpen}
      onClose={() => setIsCartOpen(false)}
      cart={cart}
      updateQuantity={updateQuantity}
      startNewOrder={startNewOrder}
      updateNote={updateNote}
      tableName={tableName}
      setTableName={setTableName}
      cartTotal={cartTotal}
      removeFromCart={removeFromCart}
      paymentMethod={paymentMethod}
      setPaymentMethod={setPaymentMethod}
      setShowMomoModal={setShowMomoModal}
      handleProcessOrder={handleProcessOrder}
      theme={theme}
    />
      
      {/* MOBILE CART TOGGLE */}
      {!isCartOpen && (
        <button 
          onClick={() => setIsCartOpen(true)}
          className={`lg:hidden fixed right-0 top-1/2 -translate-y-1/2 z-40 bg-yellow-500 text-black py-6 px-1.5 rounded-l-xl shadow-2xl flex flex-col items-center border-y border-l ${theme === 'dark' ? 'border-white/20' : 'border-black/10'}`}
        >
          
          <ChevronLeft size={16} className="mt-2" />
        </button>
      )}

      {/* REPLACED: NEW MOMO MODAL INTEGRATION */}
      <MomoPaymentModal 
        isOpen={showMomoModal} 
        onClose={() => setShowMomoModal(false)} 
        totalAmount={cartTotal} 
      />

      {/* MENU AREA */}
      <div className={`flex-1 p-6 overflow-y-auto transition-colors duration-300 ${theme === 'dark' ? 'bg-black' : 'bg-white'}`}>
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <h2 className={`text-xl font-black uppercase italic border-l-4 border-yellow-500 pl-3 ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>
            Explore Menu
          </h2>
        
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
              <input 
                type="text"
                placeholder="Search menu items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full border rounded-full py-2 pl-10 pr-4 text-sm outline-none transition-all
                  ${theme === 'dark' 
                    ? 'bg-zinc-900 border-white/10 text-white focus:border-yellow-500' 
                    : 'bg-zinc-100 border-black/10 text-zinc-900 focus:border-yellow-500'}`}
              />
            </div>

          <button 
  onClick={() => setIsCartOpen(true)} 
  className="relative w-12 h-12 rounded-full bg-yellow-500 flex items-center justify-center shrink-0 shadow-lg shadow-yellow-500/20 hover:scale-105 transition-transform active:scale-95"
>
  <ShoppingCart size={22} className="text-black" />
  {cart.length > 0 && (
    <span className="absolute -top-1 -right-1 bg-rose-600 text-white text-[10px] font-black w-6 h-6 rounded-full flex items-center justify-center shadow-md animate-in zoom-in duration-300">
      {cart.length}
    </span>
  )}
</button>

            <div className={`shrink-0 rounded-full p-1 border ${theme === 'dark' ? 'bg-zinc-900 border-white/10' : 'bg-zinc-100 border-black/10'}`}>
              <ThemeToggle />
            </div>
          </div>
        </div>

        <StaffOrderMenu onAddItem={addToCart} searchQuery={searchQuery} />
      </div>

      {/* MOBILE BACKDROP */}
{isCartOpen && (
  <div 
    onClick={() => setIsCartOpen(false)}
    className="fixed inset-0 bg-black/60 z-[150] lg:hidden"
  />
)}

    </div>
  );
}

function SuccessOrderModal({ isOpen, onClose, order, theme }) {
  if (!isOpen || !order) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
      <div className={`w-full max-w-sm rounded-[3rem] overflow-hidden shadow-2xl ${
        theme === 'dark' ? 'bg-zinc-900 border border-white/10' : 'bg-white'
      }`}>
        
        <div className="p-8">
          {/* Success Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
              <Check size={32} strokeWidth={3} />
            </div>
          </div>

          <h2 className={`text-center text-xl font-black uppercase tracking-tighter mb-6 ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>
            Order Confirmed
          </h2>

          {/* Action Buttons */}
          <div className="space-y-3">
            {/* Physical Print Option */}
            <button 
              onClick={() => window.print()}
              className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-3 hover:bg-black transition-all"
            >
              <Printer size={18} /> Print to Bluetooth
            </button>

            {/* Digital Share Option */}
            <button 
              className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-3 border transition-all ${
                theme === 'dark' ? 'border-white/10 text-white bg-white/5' : 'border-black/5 text-zinc-900 bg-zinc-50'
              }`}
            >
              <QrCode size={18} /> Show QR for Customer
            </button>
            
            <button 
              onClick={onClose}
              className="w-full py-4 text-zinc-500 font-black uppercase tracking-widest text-[10px] hover:text-yellow-500 transition-colors"
            >
              Back to Menu
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PaymentTab({ label, icon, active, onClick, theme }) {
  const activeClasses = 'bg-yellow-500 text-black border-yellow-500 shadow-lg scale-105';
  const inactiveClasses = theme === 'dark' 
    ? 'bg-zinc-800/50 border-white/5 text-zinc-500 hover:text-white' 
    : 'bg-white border-black/10 text-zinc-500 hover:text-black';

  return (
    <button 
      onClick={() => onClick(label)} 
      className={`flex flex-col items-center gap-2 py-4 rounded-2xl border transition-all duration-300 ${active ? activeClasses : inactiveClasses}`}
    >
      {icon} 
      <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
    </button>
  );
}


function CartModal({ 
  isOpen, onClose, cart, updateQuantity, updateNote, removeFromCart, 
  startNewOrder, // Pass the reset function here
  tableName, setTableName, cartTotal, paymentMethod, setPaymentMethod, 
  setShowMomoModal, handleProcessOrder, theme 
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className={`w-full max-w-2xl max-h-[95vh] overflow-hidden flex flex-col rounded-[2.5rem] shadow-2xl transition-all ${
        theme === 'dark' ? 'bg-zinc-900 border border-white/10' : 'bg-white'
      }`}>
        
        {/* MODAL HEADER */}
        <div className="p-6 border-b flex justify-between items-center border-zinc-500/10">
          <div className="flex items-center gap-4">
             <h2 className="text-xl font-black uppercase italic text-yellow-500 tracking-tighter">Review Order</h2>
             
             {/* REFRESH / NEW ORDER BUTTON */}
             <button 
               onClick={() => {
                 startNewOrder();
                 onClose(); // Close modal after resetting
               }}
               className={`flex items-center gap-2 text-[10px] font-black px-4 py-2 rounded-full border transition-all active:scale-95 ${
                 theme === 'dark' 
                 ? 'bg-white/5 border-white/10 text-zinc-400 hover:text-rose-500' 
                 : 'bg-black/5 border-black/10 text-zinc-600 hover:text-rose-600'
               }`}
             >
               <RefreshCcw size={12} strokeWidth={3} /> REFRESH ORDER
             </button>
          </div>

          <button onClick={onClose} className="p-2 rounded-full bg-zinc-500/10 hover:bg-rose-500/20 transition-colors">
            <X size={24} strokeWidth={3} />
          </button>
        </div>

        {/* ITEMS LIST */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {cart.length === 0 ? (
            <div className="h-40 flex flex-col items-center justify-center opacity-30 italic font-black uppercase text-xs">
              Cart is currently empty
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.id} className={`p-4 rounded-[2rem] border ${theme === 'dark' ? 'bg-black/40 border-white/5' : 'bg-zinc-50 border-black/5'}`}>
                <div className="flex gap-4">
                  <img src={item.image} className="w-16 h-16 rounded-2xl object-cover shadow-lg" alt="" />
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-black uppercase text-sm leading-tight">{item.name}</h4>
                        <p className="font-black text-yellow-500 text-xs mt-1">UGX {Number(item.price).toLocaleString()}</p>
                      </div>
                      
                      {/* DELETE ITEM BUTTON */}
                      <button 
                        onClick={() => removeFromCart(item.id)}
                        className="p-2 text-zinc-400 hover:text-rose-600 transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-3 mt-4">
                      {/* Quantity Controls */}
                      <div className={`flex items-center gap-3 p-1 rounded-xl shrink-0 ${theme === 'dark' ? 'bg-zinc-800' : 'bg-zinc-200'}`}>
                        <button onClick={() => updateQuantity(item.id, -1)} className="p-1"><Minus size={14}/></button>
                        <span className="text-sm font-black w-6 text-center">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.id, 1)} className="p-1"><Plus size={14}/></button>
                      </div>
                      
                      {/* Special Note Input */}
                      <input 
                        type="text"
                        placeholder="Add special instructions..."
                        value={item.note || ""}
                        onChange={(e) => updateNote(item.id, e.target.value)}
                        className={`flex-1 text-[11px] py-2 px-4 rounded-xl border outline-none italic transition-all ${
                          theme === 'dark' ? 'bg-zinc-900 border-white/5' : 'bg-white border-black/5'
                        }`}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className={`p-6 border-t ${theme === 'dark' ? 'bg-black/50 border-white/10' : 'bg-zinc-50 border-black/10'}`}>
          
          {/* PAYMENT CARDS IN MODAL */}
          <div className="mb-6">
            <div className="grid grid-cols-3 gap-3">
              <PaymentTab label="Cash" icon={<Banknote size={20}/>} active={paymentMethod === 'Cash'} onClick={setPaymentMethod} theme={theme} />
              <PaymentTab label="Card" icon={<CreditCard size={20}/>} active={paymentMethod === 'Card'} onClick={setPaymentMethod} theme={theme} />
              <PaymentTab label="Momo" icon={<Smartphone size={20}/>} active={paymentMethod === 'Momo'} onClick={(val) => { setPaymentMethod(val); setShowMomoModal(true); }} theme={theme} />
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-6 items-center">
            {/* Table Name Input */}
            <div className={`w-full md:flex-1 flex items-center gap-3 px-5 py-4 rounded-2xl border-2 transition-all ${
              theme === 'dark' ? 'bg-zinc-900 border-white/5 focus-within:border-yellow-500' : 'bg-white border-black/5 focus-within:border-yellow-500'
            }`}>
              <UtensilsCrossed size={18} className="text-yellow-500" />
              <input 
                type="text"
                placeholder="ENTER TABLE (E.G. T04)"
                value={tableName}
                onChange={(e) => setTableName(e.target.value)}
                className="bg-transparent outline-none flex-1 font-black uppercase text-sm italic"
              />
            </div>

            {/* Total Display */}
            <div className="text-right w-full md:w-auto">
              <span className="text-[10px] font-black text-zinc-500 uppercase block mb-1">Total Payable</span>
              <div className="leading-none">
                <span className="text-yellow-500 text-xs font-black mr-1">UGX</span>
                <span className="text-4xl font-black tracking-tighter leading-none">{cartTotal.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* SEND TO KITCHEN ACTION */}
          <button 
            onClick={() => { handleProcessOrder(); onClose(); }}
            disabled={cart.length === 0 || !tableName}
            className={`w-full mt-6 py-6 font-black rounded-[1.5rem] flex items-center justify-center gap-3 uppercase italic shadow-2xl transition-all active:scale-95 ${
              (cart.length === 0 || !tableName) ? 'bg-yellow-400 text-zinc-600 cursor-not-allowed' : 'bg-yellow-500 text-black hover:bg-yellow-400'
            }`}
          >
            <Send size={20} strokeWidth={3} /> Send to Kitchen
          </button>
        </div>
      </div>
    </div>
  );
}