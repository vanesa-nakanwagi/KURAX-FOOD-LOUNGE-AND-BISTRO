import API_URL from '../config/api';
import { firebaseVapidKey, getKuraxFirebaseApp, isFirebasePushConfigured } from '../config/firebase';
import { getId, getInstallations } from 'firebase/installations';
import { getToken, isSupported } from 'firebase/messaging';

function readSession() {
  try {
    const restaurant = JSON.parse(localStorage.getItem('kurax_user') || 'null');
    if (restaurant?.token) return { ...restaurant, scope: 'restaurant' };
    const shisha = JSON.parse(localStorage.getItem('kurax_shisha_session') || 'null');
    if (shisha?.token) return { ...shisha, scope: 'shisha' };
  } catch {
    return null;
  }
  return null;
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

async function registerCurrentSession() {
  const session = readSession();
  if (!session?.token || !session?.id || Notification.permission !== 'granted') return;
  if (!('serviceWorker' in navigator) || !('Notification' in window)) return;
  if (!isFirebasePushConfigured) return;
  if (!await isSupported()) return;

  try {
    const app = getKuraxFirebaseApp();
    const registration = await navigator.serviceWorker.ready.catch(() => null);
    const installationId = await getId(getInstallations(app));
    const fcmToken = await getToken(getMessaging(app), {
      vapidKey: firebaseVapidKey,
      serviceWorkerRegistration: registration || await navigator.serviceWorker.register('/sw.js').catch(() => null),
    });

    if (!fcmToken) return;
    const response = await fetch(`${API_URL}/api/notifications/register`, {
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
        userAgent: navigator.userAgent,
        isPwa: isPwaMode(),
        permissionStatus: Notification.permission,
        notificationsEnabled: true,
      }),
    });

    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      console.warn('Kurax notification registration failed:', result.error || response.statusText);
    }
  } catch (error) {
    console.warn('Kurax session notification registration ignored:', error.message);
  }
}

async function unregisterCurrentSession(sessionSnapshot) {
  const session = sessionSnapshot || readSession();
  if (!session?.token || !session?.id) return;
  if (!('serviceWorker' in navigator)) return;
  try {
    const app = getKuraxFirebaseApp();
    const installationId = await getId(getInstallations(app)).catch(() => null);
    if (!installationId) return;

    await fetch(`${API_URL}/api/notifications/unregister`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.token}`,
      },
      body: JSON.stringify({ installationId }),
    }).catch(() => {});

  } catch (error) {
    console.warn('Kurax session cleanup did not complete:', error.message);
  }
}

export function installNotificationSessionSync() {
  if (typeof window === 'undefined' || window.__kuraxNotificationSessionSyncInstalled) return;
  window.__kuraxNotificationSessionSyncInstalled = true;

  const originalSetItem = Storage.prototype.setItem;
  const originalRemoveItem = Storage.prototype.removeItem;

  Storage.prototype.setItem = function patchedSetItem(key, value) {
    originalSetItem.call(this, key, value);
    if (key === 'kurax_user' || key === 'kurax_shisha_session') {
      setTimeout(() => registerCurrentSession(), 250);
    }
  };

  Storage.prototype.removeItem = function patchedRemoveItem(key) {
    let snapshot = null;
    if (key === 'kurax_user' || key === 'kurax_shisha_session') {
      try {
        snapshot = JSON.parse(localStorage.getItem(key) || 'null');
      } catch {
        snapshot = null;
      }
    }
    originalRemoveItem.call(this, key);
    if (snapshot?.token) {
      setTimeout(() => {
        if (!readSession()?.token) {
          void unregisterCurrentSession(snapshot);
        }
      }, 200);
    }
  };

  if (Notification.permission === 'granted') {
    setTimeout(() => registerCurrentSession(), 1000);
  }
}
