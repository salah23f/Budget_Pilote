/**
 * Push notification helpers.
 *
 * Uses the browser Notification API (not a push service) to send
 * local alerts for price drops, mission updates, etc.
 *
 * Works in PWA and browser contexts.
 */

const PERMISSION_KEY = 'flyeas_notif_permission';

/** Check if notifications are supported */
export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/** Get current permission status */
export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

/**
 * Request notification permission.
 * Returns true if granted.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!isNotificationSupported()) return false;

  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;

  const result = await Notification.requestPermission();
  if (result === 'granted') {
    localStorage.setItem(PERMISSION_KEY, 'granted');
  }
  return result === 'granted';
}

/**
 * Send a local notification.
 * Falls back to in-app toast if notifications are not permitted.
 */
export function sendNotification(
  title: string,
  options?: {
    body?: string;
    icon?: string;
    tag?: string;
    data?: Record<string, any>;
    onClick?: () => void;
  }
): void {
  if (!isNotificationSupported()) return;

  if (Notification.permission !== 'granted') {
    // Fall back to console — the in-app notification bell handles this separately
    console.info(`[Flyeas Notification] ${title}: ${options?.body || ''}`);
    return;
  }

  const notification = new Notification(title, {
    body: options?.body,
    icon: options?.icon || '/icon-192.png',
    badge: '/icon-192.png',
    tag: options?.tag || `flyeas-${Date.now()}`,
    data: options?.data,
    silent: false,
  });

  if (options?.onClick) {
    notification.onclick = () => {
      window.focus();
      options.onClick?.();
      notification.close();
    };
  }

  // Auto-close after 8 seconds
  setTimeout(() => notification.close(), 8000);
}

/**
 * Send a price drop notification.
 */
export function notifyPriceDrop(route: string, oldPrice: number, newPrice: number): void {
  const saving = oldPrice - newPrice;
  const pct = Math.round((saving / oldPrice) * 100);

  sendNotification('🔥 Price Drop Alert!', {
    body: `${route}: $${oldPrice} → $${newPrice} (${pct}% off)`,
    tag: `price-drop-${route.replace(/\s/g, '-')}`,
    onClick: () => {
      window.location.href = '/flights';
    },
  });
}

/**
 * Send a mission status notification.
 */
export function notifyMissionUpdate(missionName: string, message: string): void {
  sendNotification(`🎯 Mission: ${missionName}`, {
    body: message,
    tag: `mission-${missionName.replace(/\s/g, '-')}`,
    onClick: () => {
      window.location.href = '/missions';
    },
  });
}

/**
 * Send a deal found notification.
 */
export function notifyDealFound(route: string, price: number): void {
  sendNotification('✈️ Great Deal Found!', {
    body: `${route} for just $${price}`,
    tag: `deal-${route.replace(/\s/g, '-')}`,
    onClick: () => {
      window.location.href = '/flights';
    },
  });
}
