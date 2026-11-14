import { useEffect, useState } from 'react';
import { Bell, BellOff, LoaderCircle } from 'lucide-react';
import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';
import { getId, getInstallations } from 'firebase/installations';
import API_URL from '../../config/api';
import {
  firebaseVapidKey,
  getKuraxFirebaseApp,
  isFirebasePushConfigured,
} from '../../config/firebase';

function readSession(isShisha) {
  try {
    return JSON.parse(localStorage.getItem(isShisha ? 'kurax_shisha_session' : 'kurax_user') || 'null');
  } catch {
    return null;
  }
}

function platformName() {
  const userAgent = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios';
  if (/android/.test(userAgent)) return 'android';
  return 'web';
}

function browserName() {
  const agent = navigator.userAgent;
  if (/Edg\//.test(agent)) return 'Edge';
  if (/Chrome\//.test(agent) && !/Edg\//.test(agent)) return 'Chrome';
  if (/Firefox\//.test(agent)) return 'Firefox';
  if (/Safari\//.test(agent) && !/Chrome\//.test(agent)) return 'Safari';
  return 'Unknown';
}

function isPwaMode() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function openInternalLink(link) {
  if (typeof link === 'string' && link.startsWith('/') && !link.startsWith('//')) {
    window.location.assign(link);
  }
}

function withTimeout(promise, timeoutMs, message) {
  let timeoutId;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timeoutId = window.setTimeout(() => reject(new Error(message)), timeoutMs);
    }),
  ]).finally(() => window.clearTimeout(timeoutId));
}

async function registerCurrentDevice(session, isAutoRegistration = false, onProgress = () => {}) {
  if (!session?.token) return null;
  if (!isFirebasePushConfigured || !('serviceWorker' in navigator) || !('Notification' in window)) {
    return null;
  }

  const permission = Notification.permission;
  if (permission !== 'granted') return null;
  if (!await isSupported()) return null;

  const app = getKuraxFirebaseApp();
  onProgress('Starting notification service worker...');
  const serviceWorkerRegistration = await withTimeout(
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then(() => navigator.serviceWorker.ready),
    15000,
    'Service worker did not become active. Reload the page and check the browser service-worker status.'
  );

  onProgress('Getting this device’s Firebase token...');
  const installationId = await withTimeout(
    getId(getInstallations(app)),
    20000,
    'Firebase device identification timed out. Check the browser connection and Firebase configuration.'
  );
  const fcmToken = await withTimeout(
    getToken(getMessaging(app), {
      vapidKey: firebaseVapidKey,
      serviceWorkerRegistration,
    }),
    20000,
    'Firebase could not create a push token in time. Check browser console and Firebase messaging configuration.'
  );

  if (!fcmToken) return null;

  onProgress('Saving this device to your staff account...');
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 15000);
  let response;
  try {
    response = await fetch(`${API_URL}/api/notifications/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.token}`,
      },
      body: JSON.stringify({
        installationId,
        fcmToken,
        platform: platformName(),
        browser: browserName(),
        isPwa: isPwaMode(),
        permissionStatus: permission,
        notificationsEnabled: true,
        userAgent: navigator.userAgent,
      }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('Saving this device timed out. Check that the backend is reachable and try again.');
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.error || 'Could not register this device.');
  }
  if (!isAutoRegistration) return result;
  return result.device || null;
}

export default function StaffNotificationControl({ isShisha = false }) {
  const [session, setSession] = useState(() => readSession(isShisha));
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const syncSession = () => setSession(readSession(isShisha));
    syncSession();
    window.addEventListener('kurax:staff-session-changed', syncSession);
    window.addEventListener('storage', syncSession);
    return () => {
      window.removeEventListener('kurax:staff-session-changed', syncSession);
      window.removeEventListener('storage', syncSession);
    };
  }, [isShisha]);

  useEffect(() => {
    let cancelled = false;
    setChecking(true);
    if (!session?.token || !session?.id) {
      setChecking(false);
      return undefined;
    }

    const refreshStatus = async () => {
      try {
        const response = await fetch(`${API_URL}/api/notifications/devices`, {
          headers: { Authorization: `Bearer ${session.token}` },
        });
        if (!response.ok) {
          throw new Error(`Could not check device registration (HTTP ${response.status}).`);
        }
        const data = await response.json();
        let installationId = '';
        if (isFirebasePushConfigured && await isSupported()) {
          installationId = await getId(getInstallations(getKuraxFirebaseApp()));
        }
        if (!cancelled) {
          const permission = 'Notification' in window ? Notification.permission : 'unsupported';
          const isRegistered = Boolean(data.devices?.some((device) => (
            device.active !== false
            && device.is_active !== false
            && device.notifications_enabled !== false
            && device.installation_id === installationId
          )));
          if (permission === 'granted' && isFirebasePushConfigured) {
            try {
              const registration = await registerCurrentDevice(session, true);
              if (!registration) throw new Error('Firebase did not return a registered device.');
              if (!cancelled) {
                setEnabled(true);
                setMessage('Notifications are enabled and this device is registered with the server.');
              }
            } catch (error) {
              if (!cancelled) {
                setEnabled(false);
                setMessage(`Browser permission is on, but this device is not registered with the server: ${error.message}`);
              }
            }
          } else {
            setEnabled(isRegistered && permission === 'granted');
            if (isShisha && !isFirebasePushConfigured) {
              setMessage('Shisha push notifications are not configured for this deployment.');
            } else if (isShisha && permission !== 'granted') {
              setMessage('Enable Shisha notifications here to allow this device and register it with the server.');
            }
          }
        }
      } catch (error) {
        if (!cancelled) {
          setEnabled(false);
          setMessage(error.message || 'Could not verify notification registration with the server.');
        }
      } finally {
        if (!cancelled) setChecking(false);
      }
    };

    refreshStatus();
    return () => { cancelled = true; };
  }, [session?.id, session?.token, isShisha]);

  useEffect(() => {
    if (!enabled || !isFirebasePushConfigured) return undefined;
    let unsubscribe;
    let cancelled = false;
    isSupported().then((supported) => {
      if (!supported || cancelled) return;
      const messaging = getMessaging(getKuraxFirebaseApp());
      unsubscribe = onMessage(messaging, (payload) => {
        const data = payload.data || {};
        const title = data.title || payload.notification?.title;
        const body = data.body || payload.notification?.body || '';
        if (Notification.permission !== 'granted' || !title) return;
        navigator.serviceWorker.ready
          .then((registration) => registration.showNotification(title, {
            body,
            icon: '/icons/icon-192x192.png',
            tag: `${data.type || 'staff'}-${data.referenceId || data.createdAt || Date.now()}`,
            data: { link: data.link || payload.fcmOptions?.link || '/' },
          }))
          .catch((error) => console.error('Could not display staff push notification:', error));
      });
    }).catch(() => {});
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [enabled]);

  const handleEnable = async () => {
    if (!session?.token) return setMessage('Sign in again to enable staff notifications.');
    if (!isFirebasePushConfigured) return setMessage('Firebase web configuration is not set for this deployment.');
    if (!('serviceWorker' in navigator) || !('Notification' in window)) return setMessage('This browser does not support web push notifications.');

    setLoading(true);
    setMessage('');
    try {
      if (!await isSupported()) throw new Error('This browser does not support Firebase web push.');
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') throw new Error('Notification permission was not granted.');
      const result = await registerCurrentDevice(session, false, setMessage);
      if (!result?.device) throw new Error('Firebase did not confirm that this device was registered with the server.');
      setEnabled(true);
      setMessage('Notifications are enabled and this device is registered with the server.');
    } catch (error) {
      setMessage(error.message || 'Could not enable notifications.');
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async () => {
    if (!session?.token) return;
    setLoading(true);
    setMessage('');
    try {
      const app = getKuraxFirebaseApp();
      const installationId = await getId(getInstallations(app));
      const response = await fetch(`${API_URL}/api/notifications/unregister`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({ installationId }),
      });
      if (!response.ok && response.status !== 404) throw new Error('Could not disable notifications for this device.');
      setEnabled(false);
    } catch (error) {
      setMessage(error.message || 'Could not disable notifications.');
    } finally {
      setLoading(false);
    }
  };

  if (!session?.token || checking) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[1000] flex max-w-[calc(100vw-2rem)] flex-col items-end">
      {message && <p role="status" className="pointer-events-auto mb-2 max-w-72 rounded-lg bg-zinc-950/95 px-3 py-2 text-xs text-zinc-200 shadow-lg">{message}</p>}
      <button
        type="button"
        onClick={enabled ? handleDisable : handleEnable}
        disabled={loading}
        className={`pointer-events-auto flex h-11 items-center justify-center gap-2 border border-zinc-700 bg-zinc-950 px-3 text-white shadow-xl transition-colors hover:border-yellow-500 hover:text-yellow-400 disabled:cursor-not-allowed disabled:opacity-60 ${isShisha ? 'rounded-xl text-xs font-bold' : 'w-11 rounded-full'}`}
        aria-label={enabled
          ? `Disable ${isShisha ? 'Shisha ' : ''}notifications on this device`
          : `Enable ${isShisha ? 'Shisha ' : 'staff '}notifications`}
      >
        {loading
          ? <LoaderCircle size={18} className="animate-spin" />
          : enabled
            ? <BellOff size={18} />
            : <Bell size={18} />}
        {isShisha && (loading ? 'Registering…' : enabled ? 'Shisha notifications on' : 'Enable Shisha notifications')}
      </button>
    </div>
  );
}