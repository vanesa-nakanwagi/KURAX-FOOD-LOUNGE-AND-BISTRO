import React, { useState, useEffect } from "react";
import StaffOrderMenu from "./StaffOrderMenu";
import { useData } from "../../../customer/components/context/DataContext";
import { useTheme } from "../../../customer/components/context/ThemeContext"; // Added useTheme
import { 
  Banknote, CreditCard, Smartphone, Plus, Minus, 
  Trash2, MessageSquare, Send, X, RefreshCcw, Phone, 
  ChevronLeft, LogOut, ShieldCheck, Search, ShoppingCart 
} from "lucide-react";
import ThemeToggle from "../../../customer/components/context/ThemeToggle";

export default function NewOrder() {
  const { setOrders } = useData() || {};
  const { theme } = useTheme(); // Access current theme
  const currentWaiter = "John Doe"; 

  const [cart, setCart] = useState(() => {
    const savedCart = localStorage.getItem('kurax_waiter_cart');
    return savedCart ? JSON.parse(savedCart) : [];
  });
  
  const [showMomoModal, setShowMomoModal] = useState(false);
  const [showEndShiftModal, setShowEndShiftModal] = useState(false);
  const [momoDetails, setMomoDetails] = useState({ phone: "", provider: "MTN" });
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [searchQuery, setSearchQuery] = useState("");
  const [isCartOpen, setIsCartOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('kurax_waiter_cart', JSON.stringify(cart));
  }, [cart]);

  // ... (keep startNewOrder, addToCart, updateNote, updateQuantity, handleremoveFromCart, total, handleProcessOrder as they are)
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



const handleremoveFromCart = (id) => {

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

setIsCartOpen(false);

localStorage.removeItem('kurax_waiter_cart');

setPaymentMethod("Cash");

};

  return (
    <div className={`flex flex-col lg:flex-row h-full font-[Outfit] overflow-hidden relative transition-colors duration-300
      ${theme === 'dark' ? 'bg-black text-white' : 'bg-white text-black'}`}>
      
      {/* MOBILE TOGGLE (Adjusted for light mode) */}
      {!isCartOpen && (
        <button 
          onClick={() => setIsCartOpen(true)}
          className={`lg:hidden fixed right-0 top-1/2 -translate-y-1/2 z-40 bg-yellow-500 text-black py-6 px-1.5 rounded-l-xl shadow-2xl flex flex-col items-center border-y border-l ${theme === 'dark' ? 'border-white/20' : 'border-black/10'}`}
        >
          <span className="[writing-mode:vertical-lr] font-black uppercase tracking-widest text-[10px] rotate-180">
            VIEW CART ({cart.length})
          </span>
          <ChevronLeft size={16} className="mt-2" />
        </button>
      )}

      {/* MOMO MODAL */}
      {showMomoModal && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className={`${theme === 'dark' ? 'bg-zinc-900 border-white/10' : 'bg-white border-black/5'} border w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl`}>
             <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black uppercase italic text-yellow-500">Momo Payment</h3>
              <button onClick={() => setShowMomoModal(false)} className={`p-2 rounded-full ${theme === 'dark' ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10'}`}>
                <X size={20}/>
              </button>
            </div>Cart
            {/* ... Modal content remains similar, just use theme for inputs/buttons ... */}
          </div>
        </div>
      )}

      {/* Menu Area */}
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

            <button className="relative w-10 h-10 rounded-full bg-yellow-500 flex items-center justify-center shrink-0 hover:scale-105 transition-transform">
              <ShoppingCart size={18} className="text-black" />
              {cart.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1 font-bold border-2 border-black">
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

      {/* CART SIDEBAR */}
      <div className={`
        fixed lg:relative inset-y-0 right-0 z-[60] 
        w-full sm:w-[400px] lg:w-[420px] 
        flex flex-col shadow-2xl transition-all duration-300 ease-in-out
        ${theme === 'dark' ? 'bg-zinc-900 border-l border-white/5' : 'bg-white border-l border-black/5'}
        ${isCartOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
        h-full overflow-hidden
      `}>
        
        <div className={`p-5 pb-2 shrink-0 backdrop-blur-md ${theme === 'dark' ? 'bg-zinc-900/50' : 'bg-zinc-50/50'}`}>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-black uppercase tracking-tighter text-yellow-500 italic">Your Cart</h2>
            <button onClick={startNewOrder} className={`flex items-center gap-2 text-[10px] font-bold px-3 py-1.5 rounded-full transition-all border ${theme === 'dark' ? 'bg-white/5 border-white/5 text-zinc-400' : 'bg-black/5 border-black/5 text-zinc-600'}`}>
              <RefreshCcw size={12} /> NEW ORDER
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 pt-0">
          <div className="space-y-4 mb-8">
            {cart.map((item) => (
              <div key={item.id} className={`p-3 rounded-2xl flex flex-col gap-3 border ${theme === 'dark' ? 'bg-black/40 border-white/5' : 'bg-zinc-50 border-black/5'}`}>
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 border ${theme === 'dark' ? 'bg-zinc-800 border-white/10' : 'bg-zinc-200 border-black/5'}`}>
                    <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1">
                    <h4 className={`text-sm font-bold uppercase ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>{item.name}</h4>
                    <p className="text-[11px] text-yellow-600 font-black">UGX {Number(item.price).toLocaleString()}</p>
                  </div>
                  <div className={`flex items-center rounded-lg p-1 ${theme === 'dark' ? 'bg-zinc-800' : 'bg-zinc-200'}`}>
                    <button onClick={() => updateQuantity(item.id, -1)} className="p-1 hover:text-yellow-500"><Minus size={14} /></button>
                    <span className={`px-3 text-xs font-bold ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.id, 1)} className="p-1 hover:text-yellow-500"><Plus size={14} /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* STICKY FOOTER */}
        <div className={`p-5 border-t shrink-0 shadow-2xl mb-20 lg:mb-0 ${theme === 'dark' ? 'bg-zinc-900 border-white/10' : 'bg-zinc-50 border-black/10'}`}>
          <div className="flex justify-between items-center mb-6">
             <div className="text-right w-full flex justify-between items-end">
              <span className="text-xs font-black text-zinc-500 uppercase">Total Payable</span>
              <span className={`text-2xl font-black tracking-tighter ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>
                <span className="text-yellow-500 mr-1 text-sm">UGX</span>
                {total.toLocaleString()}
              </span>
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-2 mb-4">
            <PaymentTab label="Cash" icon={<Banknote size={16}/>} active={paymentMethod === 'Cash'} onClick={setPaymentMethod} theme={theme} />
            <PaymentTab label="Card" icon={<CreditCard size={16}/>} active={paymentMethod === 'Card'} onClick={setPaymentMethod} theme={theme} />
            <PaymentTab label="Momo" icon={<Smartphone size={16}/>} active={paymentMethod === 'Momo'} onClick={(val) => { setPaymentMethod(val); setShowMomoModal(true); }} theme={theme} />
          </div>

          <button onClick={handleProcessOrder} className="w-full py-4 bg-yellow-500 hover:bg-yellow-400 text-black font-black rounded-2xl flex items-center justify-center gap-3 uppercase italic transition-all shadow-lg">
            <Send size={18} /> Send to Kitchen
          </button>
        </div>
      </div>
    </div>
  );
}

// Updated PaymentTab to accept theme prop
function PaymentTab({ label, icon, active, onClick, theme }) {
  const activeClasses = 'bg-yellow-500 text-black border-yellow-500 shadow-lg';
  const inactiveClasses = theme === 'dark' 
    ? 'bg-zinc-800/50 border-white/5 text-zinc-500 hover:text-white' 
    : 'bg-zinc-200 border-black/5 text-zinc-600 hover:text-black';

  return (
    <button onClick={() => onClick(label)} className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border transition-all ${active ? activeClasses : inactiveClasses}`}>
      {icon} <span className="text-[10px] font-black uppercase">{label}</span>
    </button>
  );
}