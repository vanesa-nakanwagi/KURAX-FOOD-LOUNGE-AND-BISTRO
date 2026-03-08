import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../customer/components/context/DataContext'; // ✅ ADDED
import kuraxLogo from '../customer/assets/images/logo.jpeg';

const StaffLogin = () => {
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const { setCurrentUser } = useData(); // ✅ ADDED: pulls setter from context

  const handleLogin = async (e) => {
    e.preventDefault();

    if (isLoading) return;

    setError('');
    setIsLoading(true);

    try {
      console.log('🔐 Starting login...');

      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      console.log('🌐 API URL:', API_URL);

      const response = await fetch(`${API_URL}/api/staff/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, pin }),
      });

      const data = await response.json();
      console.log('📦 Response data:', data);

      if (response.ok) {
        console.log('✅ Login successful, storing user...');

        // ✅ FIX 1: Save under 'kurax_user' — matches what DataContext reads
        localStorage.setItem('kurax_user', JSON.stringify(data.user));

        // ✅ FIX 2: Immediately update context so all components get the user
        setCurrentUser(data.user);

        const role = data.user.role.toUpperCase().trim();
        console.log('👤 User role:', role);
        console.log('🚀 Navigating to dashboard...');

        const roleRoutes = {
          'DIRECTOR': '/director/dashboard',
          'WAITER': '/staff/waiter',
          'CASHIER': '/cashier',
          'BARISTA': '/barista',
          'BARMAN': '/barman',
          'ACCOUNTANT': '/accountant',
          'CONTENT-MANAGER': '/content-creator',
          'MANAGER': '/staff/manager',
          'SUPERVISOR': '/supervisor',
          'CHEF': '/kitchen'
        };

        const route = roleRoutes[role] || '/staff/dashboard';
        navigate(route);
      } else {
        console.log('❌ Login failed:', data.error);
        setError(data.error || 'Access Denied');
      }
    } catch (err) {
      console.error('🚨 Login error:', err);
      setError('Network error. Please check your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white font-[Outfit] px-4 relative overflow-hidden">

      {/* Subtle Kurax Yellow Glow */}
      <div className="absolute top-[-10%] right-[-10%] w-64 h-64 bg-yellow-500/5 rounded-full blur-[100px]"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-64 h-64 bg-yellow-500/5 rounded-full blur-[100px]"></div>

      <div className="relative max-w-sm w-full">
        <div className="bg-white rounded-[2.5rem] p-8 shadow-[0_20px_50px_rgba(0,0,0,0.3)]">

          {/* Branding Section */}
          <div className="text-center mb-8">
            <img
              src={kuraxLogo}
              alt="Kurax Logo"
              className="h-20 w-auto mx-auto mb-4 mix-blend-multiply"
            />
            <h2 className="text-2xl font-black tracking-tight text-black uppercase">
              Staff <span className="text-black">Entry</span>
            </h2>
            <p className="text-[12px] mt-1 text-yellow-700 font-bold">
              Luxury dining, signature drinks & rooftop vibes
            </p>
          </div>

          {error && (
            <div className="mb-6 p-2 bg-red-50 border-l-2 border-red-600 text-red-600 text-[10px] font-bold uppercase text-center">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="relative">
              <label className="text-[9px] font-black text-black uppercase tracking-widest absolute -top-2 left-4 bg-white px-2 z-10">
                Email
              </label>
              <input
                type="email"
                required
                className="w-full px-4 py-3 bg-white border border-stone-100 rounded-xl focus:border-yellow-500 transition-all outline-none text-black text-sm"
                placeholder="director@kurax.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div className="relative">
              <label className="text-[9px] font-black text-black uppercase tracking-widest absolute -top-2 left-4 bg-white px-2 z-10">
                PIN
              </label>
              <input
                type="password"
                required
                maxLength="4"
                className="w-full px-4 py-3 bg-white border border-stone-100 rounded-xl focus:border-yellow-500 transition-all outline-none text-black tracking-[0.8em] text-center font-bold"
                placeholder="****"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 bg-black hover:bg-yellow-500 text-yellow-500 hover:text-black font-black rounded-xl transition-all duration-300 uppercase tracking-widest text-xs flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Authenticating...' : 'Unlock Portal'}
              {!isLoading && (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              )}
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-[12px] text-black uppercase tracking-widest">
              © 2026 Kurax Lounge & Bistro
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StaffLogin;