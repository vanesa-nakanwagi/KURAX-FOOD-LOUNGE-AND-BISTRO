import { Routes, Route, Navigate } from "react-router-dom";
import ScrollToHash from "./customer/components/home/ScrollToHash";
import { useState, useEffect } from "react";
// Public Pages
import HomePage from "./customer/pages/HomePage.jsx";
import MenusPage from "./customer/pages/menuPage.jsx";
import EventsPage from "./customer/pages/eventsPage.jsx";
import ReservationsPage from "./customer/components/reservations/Reservations.jsx";

// Staff & Admin Routes
import WaiterRoutes from "./staff/routes/WaiterRoutes";
import ContentCreatorRoutes from "./staff/routes/ContentCreatorRoutes.jsx";
import KitchenRoutes from "./staff/routes/KitchenRoutes";
import CashierRoutes from "./staff/routes/CashierRoutes.jsx";
import DirectorRoutes from "./staff/routes/DirectorRoutes.jsx"; 
import AccountantRoutes from "./staff/routes/AccountantRoutes.jsx";
import ManagerRoutes from "./staff/routes/ManagerRoutes.jsx";
import BarmanRoutes from "./staff/routes/BarmanRoutes";
import BaristaRoutes from "./staff/routes/BaristaRoutes"; 
import SupervisorRoutes from "./staff/routes/SupervisorRoutes";
import StaffRoutes from './staff/routes/StaffLoginRoutes';
import NewOrder  from './staff/waiter/components/NewOrder.jsx';

//  PWA Install Prompt Component
function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if app is already installed (standalone mode on mobile)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
      console.log('✅ PWA installation prompt ready');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Check if app was installed
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setShowPrompt(false);
      setDeferredPrompt(null);
      console.log('✅ Kurax app installed successfully!');
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    console.log(`User ${outcome} the installation`);
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    // Don't show again for 7 days
    localStorage.setItem('pwa_prompt_dismissed', Date.now().toString());
  };

  // Don't show if:
  // - Already installed as app
  // - User dismissed in last 7 days
  // - On desktop (optional)
  const dismissedTime = localStorage.getItem('pwa_prompt_dismissed');
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const shouldNotShow = isInstalled || (dismissedTime && (Date.now() - parseInt(dismissedTime) < sevenDaysMs));

  if (!showPrompt || shouldNotShow) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-sm z-[1000] animate-in slide-in-from-bottom-5 duration-300">
      <div className="bg-gradient-to-r from-yellow-500 to-yellow-600 rounded-2xl p-4 shadow-2xl border border-white/20">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-black/20 rounded-xl">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-black font-black text-sm uppercase tracking-tighter">Install Kurax App</p>
            <p className="text-black/70 text-[10px] mt-0.5">Install on your home screen for quick access</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleInstall}
              className="px-4 py-2 bg-black text-yellow-500 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-black/80 transition-all"
            >
              Install
            </button>
            <button
              onClick={handleDismiss}
              className="p-2 bg-black/20 rounded-xl text-black/60 hover:text-black transition-all"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

//  Register Service Worker
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then(registration => {
          console.log(' Service Worker registered:', registration.scope);
        })
        .catch(error => {
          console.error(' Service Worker registration failed:', error);
        });
    });
  }
}

export default function App() {
  // Register service worker on app mount
  useEffect(() => {
    registerServiceWorker();
  }, []);

  return (
    <>
      <ScrollToHash />
      <Routes>
        {/* --- PUBLIC CUSTOMER PAGES --- */}
        <Route path="/" element={<HomePage />} />
        <Route path="/menus" element={<MenusPage />} />
        <Route path="/events" element={<EventsPage />} />
        <Route path="/reservations" element={<ReservationsPage />} />
        <Route path="/staff/waiter/menu" element={<NewOrder />} /> 

        {/* --- STAFF DIRECT URL ACCESS --- */}
        <Route path="/staff/login/*" element={<StaffRoutes />} />

        {/* --- ROLE-BASED STAFF ROUTES --- */}
        <Route path="/director/*" element={<DirectorRoutes />} />
        <Route path="/cashier/*" element={<CashierRoutes />} />
        <Route path="/staff/waiter/*" element={<WaiterRoutes />} />
        <Route path="/staff/manager/*" element={<ManagerRoutes />} />
        <Route path="/supervisor/*" element={<SupervisorRoutes />} />
        <Route path="/accountant/*" element={<AccountantRoutes />} />
        <Route path="/kitchen/*" element={<KitchenRoutes />} />
        <Route path="/barman/*" element={<BarmanRoutes />} />
        <Route path="/barista/*" element={<BaristaRoutes />} />
        <Route path="/content-creator/*" element={<ContentCreatorRoutes />} />

        {/* --- FALLBACKS --- */}
        <Route
          path="*"
          element={
            <div className="h-screen bg-black flex flex-col items-center justify-center text-white font-[Outfit]">
              <h1 className="text-4xl font-black italic text-yellow-500">404</h1>
              <p className="opacity-50 uppercase tracking-widest text-xs mt-2">Page Not Found</p>
              <button 
                onClick={() => window.location.href = '/'}
                className="mt-6 px-6 py-2 border border-white/10 rounded-full text-[10px] font-black uppercase hover:bg-white/5"
              >
                Back to Kurax
              </button>
            </div>
          }
        />
      </Routes>
      
      {/*  PWA Install Prompt - Shows on all pages */}
      <PWAInstallPrompt />
    </>
  );
}