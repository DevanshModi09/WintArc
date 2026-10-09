import { useEffect, useState, useSyncExternalStore } from 'react'
import { api } from '../api'
import {
  disableReminders,
  enableReminders,
  install,
  installState,
  onInstallChange,
  reminderState,
  type ReminderState,
} from '../device'
import { ErrorNote } from './ArcParts'

// Two things that belong to this phone or browser rather than to the account:
// reminders, and installing WintArc as an app.
export function DeviceSettings() {
  return (
    <>
      <Reminders />
      <InstallApp />
    </>
  )
}

function Reminders() {
  // undefined = still finding out
  const [state, setState] = useState<ReminderState>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  useEffect(() => {
    reminderState().then(setState)
  }, [])

  async function act(action: () => Promise<ReminderState>) {
    setError('')
    setBusy(true)
    try {
      setState(await action())
    } catch (err) {
      setError((err as Error).message)
    }
    setBusy(false)
  }

  const test = () =>
    api.pushTest().then(
      () => {
        setSent(true)
        setTimeout(() => setSent(false), 4000)
      },
      (err: Error) => setError(err.message),
    )

  if (!state) return null
  return (
    <section className="space-y-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="h2">Reminders</h2>
        {(state === 'on' || state === 'off') && (
          <button
            className="label hover:text-fg"
            role="switch"
            aria-checked={state === 'on'}
            disabled={busy}
            onClick={() => act(state === 'on' ? disableReminders : enableReminders)}
          >
            {state === 'on' ? 'On · turn off' : 'Off · turn on'}
          </button>
        )}
      </div>
      <p className="label">
        {state === 'on' && 'This device gets a nudge before each track that has a reminder set, and at 9 PM if anything is still to commit.'}
        {state === 'off' && 'Get a nudge before each track starts, and at 9 PM if anything is still to commit. Set a start time and a reminder on a track to use the first kind.'}
        {state === 'blocked' && "Notifications are blocked for WintArc in this browser. Allow them in the browser's site settings, then come back."}
        {state === 'unsupported' && 'This browser can’t show reminders. On an iPhone, install WintArc to your Home Screen first and open it from there.'}
      </p>
      {state === 'on' && (
        <button className="label hover:text-fg" onClick={test}>
          {sent ? 'Sent. It should appear in a moment.' : 'Send a test reminder'}
        </button>
      )}
      <ErrorNote message={error} />
    </section>
  )
}

function InstallApp() {
  const state = useSyncExternalStore(onInstallChange, installState)
  // Already running as an app, or a browser with no way to install: nothing to offer.
  if (state === 'installed' || state === 'unavailable') return null
  return (
    <section className="space-y-2.5">
      <h2 className="h2">Install the app</h2>
      {state === 'ready' ? (
        <>
          <p className="label">Put WintArc on your home screen. It opens full screen, straight to Today.</p>
          <button className="btn-outline" onClick={install}>
            Install WintArc
          </button>
        </>
      ) : (
        <p className="label">
          On iPhone or iPad: tap the Share button in Safari, then <span className="text-fg">Add to Home Screen</span>. It
          opens full screen, and reminders work from there.
        </p>
      )}
    </section>
  )
}
