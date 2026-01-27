import React, { useState, useEffect } from "react";
import StaffOrderMenu from "./StaffOrderMenu";
import { useData } from "../../../components/context/DataContext";
import { Banknote, CreditCard, Smartphone, Search, Plus, Minus, Trash2, MessageSquare, Send, X, RefreshCcw, Phone, ChevronLeft } from "lucide-react";

export default function NewOrder() {
  const { setOrders } = useData() || {};
  const currentWaiter = "John Doe"; 

  const [cart, setCart] = useState(() => {
    const savedCart = localStorage.getItem('kurax_waiter_cart');
    return savedCart ? JSON.parse(savedCart) : [];
  });
  const [showMomoModal, setShowMomoModal] = useState(false);
  const [momoDetails, setMomoDetails] = useState({ phone: "", provider: "MTN" });
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [searchQuery, setSearchQuery] = useState("");
  
  // NEW STATE: Controls the mobile sidebar drawer
  const [isCartOpen, setIsCartOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('kurax_waiter_cart', JSON.stringify(cart));
  }, [cart]);

  const startNewOrder = () => {
    if (cart.length > 0 && !window.confirm("Start a new order? This will clear the current cart.")) return;
    setCart([]);
    setPaymentMethod("Cash");
    setSearchQuery("");
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

  const updateNote = (id, text) => {
    setCart(prev => prev.map(item => item.id === id ? { ...item, note: text } : item));
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

  const removeFromCart = (id) => {
    setCart(cart.filter(item => item.id !== id));
  };

  const total = cart.reduce((sum, item) => sum + (Number(item.price) * item.quantity), 0);

  const handleProcessOrder = () => {
    if (cart.length === 0) return;
    if (paymentMethod === "Momo" && !momoDetails.phone) {
      setShowMomoModal(true);
      return;
    }

    const finalOrder = {
      id: `ORD-${Date.now().toString().slice(-4)}`,
      items: cart.map(item => ({ ...item })),
      total,
      paymentMethod,
      momoDetails: paymentMethod === "Momo" ? momoDetails : null,
      status: "Pending",
      timestamp: new Date().getTime(),
      waiterName: currentWaiter,
    };

    setOrders(prev => [...prev, finalOrder]);
    setCart([]);
    setMomoDetails({ phone: "", provider: "MTN" });
    setShowMomoModal(false);
    setIsCartOpen(false); // Close drawer on success
    localStorage.removeItem('kurax_waiter_cart');
    setPaymentMethod("Cash");
  };

  return (
    <div className="flex flex-col lg:flex-row h-full bg-black font-[Outfit] text-slate-200 overflow-hidden relative">
      
      {/* MOBILE VERTICAL TOGGLE BAR - Only visible on small screens */}
      {!isCartOpen && (
        <button 
          onClick={() => setIsCartOpen(true)}
          className="lg:hidden fixed right-0 top-1/2 -translate-y-1/2 z-40 bg-yellow-500 text-black py-6 px-1.5 rounded-l-xl shadow-2xl flex flex-col items-center border-y border-l border-white/20"
        >
          <span className="[writing-mode:vertical-lr] font-black uppercase tracking-widest text-[10px] rotate-180">
            VIEW CART ({cart.length})
          </span>
          <ChevronLeft size={16} className="mt-2" />
        </button>
      )}

      {showMomoModal && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-white/10 w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black uppercase italic text-yellow-500">Momo Payment</h3>
              <button onClick={() => setShowMomoModal(false)} className="p-2 bg-white/5 rounded-full hover:bg-white/10">
                <X size={20}/>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <button 
                onClick={() => setMomoDetails({...momoDetails, provider: 'MTN'})}
                className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${momoDetails.provider === 'MTN' ? 'border-yellow-500 bg-yellow-500/10' : 'border-white/5 bg-black/40'}`}
              >
                <div className="w-10 h-10 bg-yellow-500 rounded-lg flex items-center justify-center font-black text-black text-[10px] uppercase">MTN</div>
                <span className="text-[10px] font-black uppercase">MTN Momo</span>
              </button>
              <button 
                onClick={() => setMomoDetails({...momoDetails, provider: 'Airtel'})}
                className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${momoDetails.provider === 'Airtel' ? 'border-rose-600 bg-rose-600/10' : 'border-white/5 bg-black/40'}`}
              >
                <div className="w-10 h-10 bg-rose-600 rounded-lg flex items-center justify-center font-black text-white text-[10px] uppercase">Air</div>
                <span className="text-[10px] font-black uppercase">Airtel Money</span>
              </button>
            </div>
            <div className="space-y-2 mb-8">
              <label className="text-[10px] font-black uppercase text-zinc-500 ml-2">Phone Number</label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                <input 
                  type="tel"
                  placeholder="07XX XXX XXX"
                  value={momoDetails.phone}
                  className="w-full bg-black border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white font-bold outline-none focus:border-yellow-500 transition-all"
                  onChange={(e) => setMomoDetails({...momoDetails, phone: e.target.value})}
                />
              </div>
            </div>
            <button 
              onClick={handleProcessOrder}
              className="w-full py-4 bg-yellow-500 text-black font-black rounded-2xl uppercase italic hover:bg-yellow-400 transition-all"
            >
              Confirm & Send to Kitchen
            </button>
          </div>
        </div>
      )}

      {/* Menu Area */}
      <div className="flex-1 p-6 overflow-y-auto bg-black">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-black uppercase italic border-l-4 border-yellow-500 pl-3">Explore Menu</h2>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
            <input 
              type="text"
              placeholder="Search menu..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-900 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-sm focus:border-yellow-500 outline-none transition-all"
            />
          </div>
        </div>
        <StaffOrderMenu onAddItem={addToCart} searchQuery={searchQuery} />
      </div>

      {/* BALANCED DARK CART SIDEBAR - Now fully scrollable as one unit */}
<div className={`
  fixed lg:relative inset-y-0 right-0 z-[60] 
  w-full sm:w-[400px] lg:w-[420px] 
  bg-zinc-900 border-l border-white/5 p-5 
  flex flex-col shadow-2xl transition-transform duration-300 ease-in-out
  ${isCartOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
  overflow-y-auto scrollbar-hide [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden
`}>
  
  {/* Header Section */}
  <div className="flex justify-between items-center mb-6 shrink-0">
    <div className="flex items-center gap-3">
       <button onClick={() => setIsCartOpen(false)} className="lg:hidden p-2 bg-white/5 rounded-lg">
          <ChevronLeft size={20} />
       </button>
       <h2 className="text-xl font-black uppercase tracking-tighter text-yellow-500 italic">Your Cart</h2>
    </div>
    <button 
      onClick={startNewOrder}
      className="flex items-center gap-2 text-[10px] font-bold bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-full transition-all text-zinc-400 border border-white/5"
    >
      <RefreshCcw size={12} /> NEW ORDER
    </button>
  </div>
        {/* Natural Height List - No internal scrolling */}
<div className="space-y-4 mb-8">
  {cart.map((item) => (
    <div key={item.id} className="bg-black/40 border border-white/5 p-3 rounded-2xl flex flex-col gap-3 transition-all">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-zinc-800 border border-white/10">
          <img src={item.image || "https://via.placeholder.com/150"} alt={item.name} className="w-full h-full object-cover opacity-80" />
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-bold text-white leading-tight uppercase tracking-tight">{item.name}</h4>
          <p className="text-[11px] text-yellow-500/80 font-black mt-0.5">UGX {Number(item.price).toLocaleString()}</p>
        </div>
        <div className="flex items-center bg-zinc-800 rounded-lg p-1 border border-white/5">
          <button onClick={() => updateQuantity(item.id, -1)} className="p-1 hover:text-yellow-500 transition-colors"><Minus size={14} /></button>
          <span className="px-3 text-xs font-bold text-white">{item.quantity}</span>
          <button onClick={() => updateQuantity(item.id, 1)} className="p-1 hover:text-yellow-500 transition-colors"><Plus size={14} /></button>
        </div>
        <button onClick={() => removeFromCart(item.id)} className="text-rose-500/70 hover:text-rose-500 p-1 transition-colors">
          <Trash2 size={18} />
        </button>
      </div>
      <div className="flex items-center gap-2 bg-black/50 p-2.5 rounded-xl border border-white/5">
        <MessageSquare size={14} className="text-zinc-600" />
        <input 
          type="text"
          placeholder="Note for chef..."
          value={item.note}
          onChange={(e) => updateNote(item.id, e.target.value)}
          className="bg-transparent text-[10px] w-full outline-none text-zinc-400 placeholder:text-zinc-700 italic"
        />
      </div>
    </div>
  ))}
  
  {cart.length === 0 && (
    <div className="flex flex-col items-center justify-center py-10 opacity-20">
      <Plus size={48} className="mb-2" />
      <p className="text-xs font-bold uppercase tracking-widest text-center">Your order is empty</p>
    </div>
  )}
</div>

        <div className="mt-auto pt-6 border-t border-white/10">
          <div className="flex justify-between items-center mb-6">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-zinc-500 uppercase">Responsible Waiter</span>
              <span className="text-xs font-bold text-white">{currentWaiter}</span>
            </div>
            <div className="text-right">
              <span className="text-xs font-black text-zinc-500 uppercase block">Total</span>
              <span className="text-2xl font-black text-white tracking-tighter">
                <span className="text-yellow-500 mr-1 text-sm">UGX</span>
                {total.toLocaleString()}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-4">
            <PaymentTab label="Cash" icon={<Banknote size={16}/>} active={paymentMethod === 'Cash'} onClick={setPaymentMethod} />
            <PaymentTab label="Card" icon={<CreditCard size={16}/>} active={paymentMethod === 'Card'} onClick={setPaymentMethod} />
            <PaymentTab 
              label="Momo" 
              icon={<Smartphone size={16}/>} 
              active={paymentMethod === 'Momo'} 
              onClick={(val) => { setPaymentMethod(val); setShowMomoModal(true); }} 
            />
          </div>
          <button 
            onClick={handleProcessOrder} 
            className="w-full py-4 bg-yellow-500 hover:bg-yellow-400 text-black font-black rounded-2xl flex items-center justify-center gap-3 uppercase italic transition-all shadow-[0_10px_20px_-10px_rgba(234,179,8,0.3)]"
          >
            <Send size={18} /> Send to Kitchen
          </button>
        </div>
      </div>

      {/* Background Overlay for mobile drawer */}
      {isCartOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 lg:hidden" onClick={() => setIsCartOpen(false)} />
      )}
    </div>
  );
}

function PaymentTab({ label, icon, active, onClick }) {
  return (
    <button 
      onClick={() => onClick(label)} 
      className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border transition-all ${
        active 
        ? 'bg-white text-black border-white shadow-lg shadow-white/5 scale-[1.02]' 
        : 'bg-zinc-800/50 border-white/5 text-zinc-500 hover:border-white/10'
      }`}
    >
      {icon} <span className="text-[10px] font-black uppercase tracking-tighter">{label}</span>
    </button>
  );
}