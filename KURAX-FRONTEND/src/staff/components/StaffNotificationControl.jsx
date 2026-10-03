import { useEffect, useState } from 'react';
import { Bell, BellOff, LoaderCircle } from 'lucide-react';
import { deleteToken, getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';
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

function openInternalLink(link) {
  if (typeof link === 'string' && link.startsWith('/') && !link.startsWith('//')) {
    window.location.assign(link);
  }
}

export default function StaffNotificationControl({ isShisha = false }) {
  const session = readSession(isShisha);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    if (!session?.token || !session?.id) {
      setChecking(false);
      return undefined;
    }
    fetch(`${API_URL}/api/notifications/devices`, {
      headers: { Authorization: `Bearer ${session.token}` },
    })
      .then((response) => response.ok ? response.json() : null)
      .then(async (data) => {
        if (!data || cancelled) return;
        let installationId = '';
        if (isFirebasePushConfigured && await isSupported()) {
          installationId = await getId(getInstallations(getKuraxFirebaseApp()));
        }
        if (!cancelled) {
          setEnabled(Boolean(data.devices?.some((device) => (
            device.is_active && device.firebase_installation_id === installationId
          ))));
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setChecking(false); });
    return () => { cancelled = true; };
  }, [session?.id, session?.token]);

  useEffect(() => {
    if (!enabled || !isFirebasePushConfigured) return undefined;
    let unsubscribe;
    let cancelled = false;
    isSupported().then((supported) => {
      if (!supported || cancelled) return;
      const messaging = getMessaging(getKuraxFirebaseApp());
      unsubscribe = onMessage(messaging, (payload) => {
        const data = payload.data || {};
        if (Notification.permission !== 'granted' || !data.title) return;
        const notice = new Notification(data.title, {
          body: data.body || '',
          icon: '/icons/icon-192x192.png',
          data: { link: data.link || '/' },
        });
        notice.onclick = () => openInternalLink(notice.data.link);
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

      const app = getKuraxFirebaseApp();
      const serviceWorkerRegistration = await navigator.serviceWorker.register('/sw.js');
      const installationId = await getId(getInstallations(app));
      const fcmToken = await getToken(getMessaging(app), {
        vapidKey: firebaseVapidKey,
        serviceWorkerRegistration,
      });
      if (!fcmToken) throw new Error('Firebase did not return a push token for this device.');

      const response = await fetch(`${API_URL}/api/notifications/devices`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({
          installationId,
          fcmToken,
          platform: platformName(),
          userAgent: navigator.userAgent,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Could not register this device.');
      setEnabled(true);
      setMessage('Notifications enabled on this device.');
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
      const response = await fetch(`${API_URL}/api/notifications/devices/${encodeURIComponent(installationId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.token}` },
      });
      if (!response.ok && response.status !== 404) throw new Error('Could not disable notifications for this device.');
      await deleteToken(getMessaging(app)).catch(() => {});
      setEnabled(false);
      setMessage('Notifications disabled on this device.');
    } catch (error) {
      setMessage(error.message || 'Could not disable notifications.');
    } finally {
      setLoading(false);
    }
  };

  if (!session?.token || checking) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[1000] max-w-[calc(100vw-2rem)]">
      <button
        type="button"
        onClick={enabled ? handleDisable : handleEnable}
        disabled={loading}
        className="flex min-h-11 items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-xs font-bold text-white shadow-xl transition-colors hover:border-yellow-500 hover:text-yellow-400 disabled:cursor-not-allowed disabled:opacity-60"
        aria-label={enabled ? 'Disable notifications on this device' : 'Enable staff notifications'}
      >
        {loading ? <LoaderCircle size={16} className="animate-spin" /> : enabled ? <BellOff size={16} /> : <Bell size={16} />}
        {loading ? 'Saving...' : enabled ? 'Disable Notifications' : 'Enable Notifications'}
      </button>
      {message && <p role="status" className="mt-2 max-w-72 rounded-lg bg-zinc-950/95 px-3 py-2 text-xs text-zinc-200 shadow-lg">{message}</p>}
    </div>
  );
}