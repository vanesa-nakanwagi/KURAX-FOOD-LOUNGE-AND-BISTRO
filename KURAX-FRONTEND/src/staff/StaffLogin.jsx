import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import kuraxLogo from '../customer/assets/images/logo.jpeg'; 

const StaffLogin = () => {
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const response = await fetch('http://localhost:5000/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, pin }),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('user', JSON.stringify(data.user));
        if(data.user.role === 'director') navigate('/director/dashboard');
        else navigate('/staff/dashboard');
      } else {
        setError(data.error || 'Access Denied');
      }
    } catch (err) {
      setError('System Error. Please try again later.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white font-[Outfit] px-4 relative overflow-hidden">
      
      {/* Subtle Kurax Yellow Glow */}
      <div className="absolute top-[-10%] right-[-10%] w-64 h-64 bg-yellow-500/5 rounded-full blur-[100px]"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-64 h-64 bg-yellow-500/5 rounded-full blur-[100px]"></div>

      {/* Slimmed Down Container: max-w-sm is narrower than max-w-md */}
      <div className="relative max-w-sm w-full">
        <div className="bg-white rounded-[2.5rem] p-8 shadow-[0_20px_50px_rgba(0,0,0,0.3)]">
          
          {/* Branding Section */}
          <div className="text-center mb-8">
            {/* mix-blend-mode: multiply removes the white/black box from the image */}
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
              />
            </div>

            <button
              type="submit"
              className="w-full py-4 bg-black hover:bg-yellow-500 text-yellow-500 hover:text-black font-black rounded-xl transition-all duration-300 uppercase tracking-widest text-xs flex items-center justify-center"
            >
              Unlock Portal
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
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