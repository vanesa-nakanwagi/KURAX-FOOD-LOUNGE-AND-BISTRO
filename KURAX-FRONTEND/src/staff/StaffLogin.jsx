import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../customer/components/context/DataContext';
import kuraxLogo from '../customer/assets/images/logo.jpeg';

import carouselImg1 from '../customer/assets/images/kurax8.jpg';
import carouselImg2 from '../customer/assets/images/kurax3.jpeg';
import carouselImg3 from '../customer/assets/images/kurax7.jpg';
import carouselImg4 from '../customer/assets/images/kurax2.jpeg';

const CAROUSEL_IMAGES = [
  { src: carouselImg1, label: 'The Rooftop Experience' },
  { src: carouselImg2, label: 'Signature Cocktails' },
  { src: carouselImg3, label: 'Fine Dining' },
  { src: carouselImg4, label: 'Exclusive Ambiance' },
];

const CAROUSEL_INTERVAL = 4000;

// Icons
const EyeOpen = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);

const EyeClosed = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
  </svg>
);

const EnvelopeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);

const LockIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
  </svg>
);

// ─── Carousel (unchanged) ───────────────────────────────────────────────────
const ImageCarousel = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [prevIndex, setPrevIndex] = useState(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const goTo = useCallback((index) => {
    if (isTransitioning) return;
    setPrevIndex(activeIndex);
    setIsTransitioning(true);
    setActiveIndex(index);
    setTimeout(() => { setPrevIndex(null); setIsTransitioning(false); }, 900);
  }, [activeIndex, isTransitioning]);

  useEffect(() => {
    const timer = setInterval(() => {
      goTo((activeIndex + 1) % CAROUSEL_IMAGES.length);
    }, CAROUSEL_INTERVAL);
    return () => clearInterval(timer);
  }, [activeIndex, goTo]);

  return (
    <div className="relative w-full h-full overflow-hidden bg-black select-none">
      {CAROUSEL_IMAGES.map((img, i) => {
        const isActive = i === activeIndex;
        const isPrev = i === prevIndex;
        return (
          <div
            key={i}
            className="absolute inset-0"
            style={{
              opacity: isActive ? 1 : isPrev ? 0 : 0,
              transform: isActive ? 'scale(1.04)' : 'scale(1)',
              zIndex: isActive ? 2 : isPrev ? 1 : 0,
              transition: 'opacity 900ms ease-in-out, transform 5000ms ease-out',
            }}
          >
            <img src={img.src} alt={img.label} className="w-full h-full object-cover" style={{ filter: 'brightness(0.55)' }} />
          </div>
        );
      })}

      <div className="absolute inset-0 z-10 bg-gradient-to-t from-black/70 via-transparent to-black/20 pointer-events-none" />

      <div className="absolute top-8 left-8 z-20 flex items-center gap-3">
        <div className="w-8 h-px bg-amber-400/70" />
        <span className="text-amber-400/80 text-[10px] font-bold uppercase tracking-[0.35em]">Kampala, Uganda</span>
      </div>

      <div className="absolute bottom-0 left-0 right-0 z-20 p-10 pb-10">
        <span className="inline-block text-amber-400 text-[10px] font-bold uppercase tracking-[0.4em] mb-3 opacity-90">
          {CAROUSEL_IMAGES[activeIndex].label}
        </span>
        <h2 className="text-white text-4xl font-black leading-none tracking-tight uppercase">
          Where Every<br /><span className="text-amber-400">Moment</span> Matters
        </h2>
        <p className="text-white/50 text-sm mt-3 font-light tracking-wide max-w-xs leading-relaxed">
          Exceptional dining, signature cocktails, and rooftop experiences.
        </p>

        <div className="flex items-center gap-2 mt-6">
          {CAROUSEL_IMAGES.map((_, i) => (
            <button key={i} onClick={() => goTo(i)} aria-label={`Slide ${i + 1}`} className="focus:outline-none">
              <div
                className="transition-all duration-500 rounded-full"
                style={{
                  width: i === activeIndex ? '28px' : '6px',
                  height: '6px',
                  backgroundColor: i === activeIndex ? '#f59e0b' : 'rgba(255,255,255,0.35)',
                }}
              />
            </button>
          ))}
          <div className="ml-auto w-20 h-[2px] bg-white/10 rounded-full overflow-hidden">
            <div
              key={activeIndex}
              className="h-full bg-amber-400/70 rounded-full"
              style={{ animation: `kProgress ${CAROUSEL_INTERVAL}ms linear forwards` }}
            />
          </div>
        </div>
      </div>

      <style>{`
        @keyframes kProgress { from { width: 0% } to { width: 100% } }
      `}</style>
    </div>
  );
};

// ─── Underline Input Component – no red underline on error ─────────────────
const UnderlineInput = ({
  id,
  type,
  value,
  onChange,
  onBlur,
  icon: Icon,
  label,
  error,
  touched,
  disabled,
  maxLength,
  rightElement,
}) => {
  const [focused, setFocused] = useState(false);
  const hasValue = value && value.length > 0;
  const isActive = focused || hasValue;

  return (
    <div className="relative mb-5">
      <div className="relative border-b border-gray-200 focus-within:border-amber-500 transition-colors">
        {/* Left Icon */}
        <div className="absolute left-0 bottom-2 text-gray-400 pointer-events-none z-10">
          <Icon />
        </div>

        {/* Input Field */}
        <input
          id={id}
          type={type}
          value={value}
          onChange={onChange}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            if (onBlur) onBlur();
          }}
          disabled={disabled}
          maxLength={maxLength}
          className={`
            w-full pl-7 pr-8 py-2 text-gray-800 text-sm bg-transparent 
            focus:outline-none placeholder-transparent
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          `}
          placeholder={label}
        />

        {/* Floating Label */}
        <label
          htmlFor={id}
          className={`
            absolute left-7 transition-all duration-200 pointer-events-none text-gray-400
            ${isActive 
              ? 'text-[10px] -top-3 text-amber-600' 
              : 'text-sm bottom-2'
            }
          `}
        >
          {label}
        </label>

        {/* Right Element (eye icon for PIN) */}
        {rightElement && (
          <div className="absolute right-0 bottom-1">
            {rightElement}
          </div>
        )}
      </div>

      {/* Error Message only – no red underline */}
      {touched && error && (
        <p className="mt-1 text-xs text-red-500">{error}</p>
      )}
    </div>
  );
};

// ─── Main Login Component ──────────────────────────────────────────────────
const StaffLogin = () => {
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [touchedEmail, setTouchedEmail] = useState(false);
  const [touchedPin, setTouchedPin] = useState(false);

  const navigate = useNavigate();
  const { setCurrentUser } = useData();

  // Validation
  const emailError = touchedEmail && !email.trim()
    ? 'Email is required'
    : touchedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ? 'Enter a valid email address'
    : '';

  const pinError = touchedPin && !pin.trim()
    ? 'PIN is required'
    : touchedPin && !/^\d{4}$/.test(pin)
    ? 'PIN must be exactly 4 digits'
    : '';

  const handleLogin = async (e) => {
    e.preventDefault();
    setTouchedEmail(true);
    setTouchedPin(true);
    if (emailError || pinError || !email.trim() || !pin.trim()) return;
    if (isLoading) return;
    setError('');
    setIsLoading(true);
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5010';
      const response = await fetch(`${API_URL}/api/staff/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, pin }),
      });
      const data = await response.json();
      if (response.ok) {
        localStorage.setItem('kurax_user', JSON.stringify(data.user));
        setCurrentUser(data.user);
        const role = data.user.role.toUpperCase().trim();
        const roleRoutes = {
          DIRECTOR: '/director/dashboard',
          WAITER: '/staff/waiter',
          CASHIER: '/cashier',
          BARISTA: '/barista',
          BARMAN: '/barman',
          ACCOUNTANT: '/accountant',
          'CONTENT-MANAGER': '/content-creator',
          MANAGER: '/staff/manager',
          SUPERVISOR: '/supervisor',
          CHEF: '/kitchen',
        };
        navigate(roleRoutes[role] || '/staff/dashboard');
      } else {
        setError(data.error || 'Access Denied');
      }
    } catch {
      setError('Network error. Please check your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen flex overflow-hidden font-[Outfit]">
      {/* LEFT PANEL */}
      <div className="relative flex flex-col h-full w-full lg:w-[42%] xl:w-[38%] bg-white px-6 sm:px-10 xl:px-14 py-6 overflow-y-auto">
        <div className="pointer-events-none absolute bottom-0 right-0 w-64 h-64 bg-amber-400/8 rounded-full blur-[100px]" />

        {/* Branding */}
        <div className="flex flex-col items-center text-center mb-4 relative z-10">
          <img src={kuraxLogo} alt="Kurax" className="h-16 w-auto object-contain mb-2" />
          <h1 className="text-black text-lg font-black tracking-widest uppercase">Kurax Food</h1>
          <p className="text-black text-xs font-bold tracking-[0.2em] uppercase">Lounge & Bistro</p>
          <p className="text-zinc-700 text-[11px] font-medium tracking-wide mt-1">Luxury Dining & Rooftop Vibes</p>
        </div>

        {/* Form Container */}
        <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full relative z-10">
          <div className="mb-6">
            <h2 className="text-black text-2xl font-black tracking-tight">Welcome back</h2>
            <p className="text-zinc-700 text-sm mt-1 font-medium">Sign in to access your staff portal.</p>
          </div>

          {/* Global API Error */}
          {error && (
            <div className="mb-4 flex items-center gap-2 px-3 py-2 bg-red-50 border-l-2 border-red-500">
              <p className="text-red-600 text-[11px] font-bold uppercase tracking-widest">{error}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-2">
            {/* Email Field */}
            <UnderlineInput
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setTouchedEmail(true)}
              icon={EnvelopeIcon}
              label="Email"
              error={emailError}
              touched={touchedEmail}
              disabled={isLoading}
            />

            {/* PIN Field */}
            <UnderlineInput
              id="pin"
              type={showPin ? 'text' : 'password'}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              onBlur={() => setTouchedPin(true)}
              icon={LockIcon}
              label="PIN"
              error={pinError}
              touched={touchedPin}
              disabled={isLoading}
              maxLength={4}
              rightElement={
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="text-gray-400 hover:text-amber-600 transition-colors focus:outline-none"
                  tabIndex={-1}
                >
                  {showPin ? <EyeClosed /> : <EyeOpen />}
                </button>
              }
            />

            {/* Forgot PIN & Contact Admin */}
            <div className="flex items-center justify-between pt-2 pb-2">
              <span className="text-xs text-gray-400 cursor-default">Forgot PIN?</span>
              <a
                href="mailto:admin@kurax.com"
                className="text-xs text-amber-600 hover:text-amber-700 font-semibold transition-colors"
              >
                Contact Admin
              </a>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="relative w-full py-3 mt-2 font-black text-xs uppercase tracking-[0.35em] overflow-hidden group transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed"
              style={{
                background: isLoading
                  ? 'rgba(180,130,0,0.15)'
                  : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              }}
            >
              {!isLoading && (
                <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/25 to-transparent skew-x-12" />
              )}
              <span className={`relative flex items-center justify-center gap-2 ${isLoading ? 'text-amber-700' : 'text-black'}`}>
                {isLoading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Authenticating
                  </>
                ) : (
                  <>
                    Unlock Portal
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </>
                )}
              </span>
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="relative z-5 text-center mt-2">
          <p className="text-zinc-700 text-[10px] uppercase tracking-widest font-medium">
            © 2026 Kurax Lounge & Bistro
          </p>
        </div>
      </div>

      {/* RIGHT CAROUSEL */}
      <div className="hidden lg:block flex-1 relative h-full">
        <ImageCarousel />
      </div>
    </div>
  );
};

export default StaffLogin;