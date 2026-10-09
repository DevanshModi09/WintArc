import { api } from './api'

// The parts of WintArc that belong to this particular browser or phone:
// installing it as an app, and switching reminders on for it.

// Registered once, on load. Without it there's no installing and no reminders.
export const serviceWorker: Promise<ServiceWorkerRegistration | null> =
  'serviceWorker' in navigator ? navigator.serviceWorker.register('/sw.js').catch(() => null) : Promise.resolve(null)

// ---- Installing

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

// Chrome and Edge hand over a prompt to show later; hold on to it.
let installPrompt: InstallPrompt | null = null
const installListeners = new Set<() => void>()
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault()
  installPrompt = event as InstallPrompt
  installListeners.forEach((notify) => notify())
})
window.addEventListener('appinstalled', () => {
  installPrompt = null
  installListeners.forEach((notify) => notify())
})

export function onInstallChange(listener: () => void) {
  installListeners.add(listener)
  return () => void installListeners.delete(listener)
}

export type InstallState = 'installed' | 'ready' | 'ios' | 'unavailable'

export function installState(): InstallState {
  const standalone = matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
  if (standalone) return 'installed'
  if (installPrompt) return 'ready'
  // Safari on iPhone and iPad has no prompt: it's done from the Share menu.
  if (/iphone|ipad|ipod/i.test(navigator.userAgent)) return 'ios'
  return 'unavailable'
}

export async function install() {
  if (!installPrompt) return
  await installPrompt.prompt()
  await installPrompt.userChoice
  installPrompt = null
  installListeners.forEach((notify) => notify())
}

// ---- Reminders

export type ReminderState = 'on' | 'off' | 'blocked' | 'unsupported'

async function subscription() {
  const registration = await serviceWorker
  return registration?.pushManager ? registration.pushManager.getSubscription() : null
}

export async function reminderState(): Promise<ReminderState> {
  const registration = await serviceWorker
  if (!registration?.pushManager || !('Notification' in window)) return 'unsupported'
  if (Notification.permission === 'denied') return 'blocked'
  return (await registration.pushManager.getSubscription()) ? 'on' : 'off'
}

// Asks the browser's permission, then tells the server where to send them.
export async function enableReminders(): Promise<ReminderState> {
  const registration = await serviceWorker
  if (!registration?.pushManager) return 'unsupported'
  const { key } = await api.getPushKey()
  if (!key) throw new Error("Reminders aren't set up on the server yet")
  if ((await Notification.requestPermission()) !== 'granted') return 'blocked'
  const sub = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key })
  const { endpoint, keys } = sub.toJSON()
  await api.pushSubscribe({
    endpoint: endpoint!,
    keys: { p256dh: keys!.p256dh, auth: keys!.auth },
    // So "6 PM" means 6 PM where you are.
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  })
  return 'on'
}

export async function disableReminders(): Promise<ReminderState> {
  const sub = await subscription()
  if (sub) {
    await api.pushUnsubscribe(sub.endpoint).catch(() => {})
    await sub.unsubscribe()
  }
  return 'off'
}
