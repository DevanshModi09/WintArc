import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ErrorNote, Logo } from '../components/ArcParts'
import { renderGoogleButton } from '../googleSignIn'
import { signInWithGoogle, supabase } from '../supabase'

const COPY = {
  login: {
    title: 'Log in to WintArc',
    submit: 'Log in',
    switchText: "Don't have an account?",
    switchLink: 'Sign up',
    switchTo: '/signup',
  },
  signup: {
    title: 'Create your account',
    submit: 'Sign up',
    switchText: 'Already have an account?',
    switchLink: 'Log in',
    switchTo: '/login',
  },
}

const DAY_MS = 24 * 60 * 60 * 1000

// The lines that sell it, kept true as the year runs out: months while there
// are months left, then days, and a single different pitch once starts have
// closed.
function seasonPitch() {
  const now = new Date()
  const year = now.getFullYear()
  const midnight = new Date(year, now.getMonth(), now.getDate()).getTime()
  const daysLeft = Math.round((new Date(year + 1, 0, 1).getTime() - midnight) / DAY_MS)
  const toStart = Math.round((new Date(year, 10, 10).getTime() - midnight) / DAY_MS)
  const open = now.getMonth() >= 9 && toStart >= 0
  if (!open) {
    return {
      eyebrow: 'Winter Arc',
      slides: [{ headline: 'The arc is closed to new starts.', sub: 'It opens again on 1 October. Log in to follow the people who are in.' }],
    }
  }
  const months = Math.round(daysLeft / 30)
  const long = daysLeft > 45
  const stretch = long ? `these last ${months} months` : `these last ${daysLeft} days`
  const span = long ? `${months === 3 ? 'Three' : months === 2 ? 'Two' : months} months` : `${daysLeft} days`
  return {
    eyebrow: `${daysLeft} days left in ${year} · ${toStart === 0 ? 'last day to start' : `${toStart} days left to start`}`,
    slides: [
      { headline: `Bleed the maximum out of ${stretch}.`, sub: 'Start your winter arc now.' },
      { headline: `${daysLeft} days left. Make them count.`, sub: 'Lock in your winter arc before 10 November.' },
      { headline: "The year isn't over. You just stopped trying.", sub: `${span} is enough to change it. Start your arc.` },
      { headline: "Everyone waits for January. Don't.", sub: 'Start now and walk into the new year already ahead.' },
      { headline: 'No more "next year". It starts today.', sub: `${daysLeft} days, photo proof every day, no backing off.` },
      { headline: `${span}. No excuses. No exit.`, sub: 'Set your tracks, lock them in, show up daily.' },
      { headline: 'Finish the year like you meant it.', sub: 'Your winter arc starts the day you sign up.' },
    ],
  }
}

const SLIDE_MS = 4500

// The pitch as a slideshow: one line at a time, sliding in, moving on by
// itself. It waits while you hover or tab into it, and stays put for anyone
// who has asked their system for less motion. The dots jump to a line.
function Pitch({ eyebrow, slides }: { eyebrow: string; slides: { headline: string; sub: string }[] }) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (paused || slides.length < 2 || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timer = setInterval(() => setIndex((i) => (i + 1) % slides.length), SLIDE_MS)
    return () => clearInterval(timer)
  }, [paused, slides.length])

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {/* Every line is laid out in the same spot and only the current one is
          shown, so the block is exactly as tall as the longest line needs and
          nothing around it moves. Each sits at the bottom, against the dots. */}
      <div className="grid overflow-hidden" aria-live="polite">
        {slides.map((slide, i) => {
          const current = i === index
          const Headline = current ? 'h1' : 'div'
          return (
            <div
              key={slide.headline}
              className={`col-start-1 row-start-1 flex flex-col justify-end ${current ? '' : 'invisible'}`}
              aria-hidden={!current}
            >
              <div className="eyebrow">{eyebrow}</div>
              <div className={current ? 'slide-in' : ''}>
                <Headline className="mt-5 text-[38px] leading-[1.05] font-medium text-balance sm:text-[48px]">{slide.headline}</Headline>
                <p className="mt-4 text-xl text-muted">{slide.sub}</p>
              </div>
            </div>
          )
        })}
      </div>
      {slides.length > 1 && (
        <div className="mt-6 flex gap-1.5" role="group" aria-label="Choose a line">
          {slides.map((s, i) => (
            <button
              key={s.headline}
              type="button"
              className={`h-1.5 rounded-full transition-all ${i === index ? 'w-8 bg-fg' : 'w-3 bg-cell-partial hover:bg-fg'}`}
              aria-label={`Line ${i + 1} of ${slides.length}`}
              aria-pressed={i === index}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function AuthPage({ mode }: { mode: 'login' | 'signup' }) {
  const copy = COPY[mode]
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setNotice('')
    setBusy(true)
    const { data, error } =
      mode === 'signup'
        ? await supabase.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: window.location.origin },
          })
        : await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (error) setError(error.message)
    // With email confirmation on, sign-up returns no session until the link is clicked.
    else if (!data.session) setNotice(`Check ${email} for a link to confirm your account.`)
  }

  async function google() {
    setError('')
    const { error } = await signInWithGoogle()
    if (error) setError(error.message)
  }

  const pitch = seasonPitch()

  return (
    <main className="mx-auto grid min-h-screen max-w-[1040px] items-center gap-x-16 gap-y-12 px-6 py-12 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section>
        <Logo />
        <div className="mt-10">
          <Pitch eyebrow={pitch.eyebrow} slides={pitch.slides} />
        </div>
        <ul className="mt-8 space-y-3">
          {[
            ['Lock in your tracks', 'Pick what you’re working on and the checkpoints you’ll hit. Once it’s set, it’s set.'],
            ['Prove it every day', 'A check-in needs a photo of the work. No photo, no day.'],
            ['No backing off', 'There’s no ending it early. Everyone finishes on 1 January.'],
          ].map(([title, text]) => (
            <li key={title} className="flex gap-3">
              <span className="mt-2 size-2 shrink-0 rounded-full bg-accent" aria-hidden="true" />
              <span>
                <span className="font-medium">{title}.</span> <span className="text-muted">{text}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="h2">{copy.title}</h2>

        <div className="mt-6 space-y-4">
        <form onSubmit={submit} className="space-y-3">
          <label className="block space-y-1.5">
            <span className="label">Email</span>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </label>
          <label className="block space-y-1.5">
            <span className="label">Password</span>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              minLength={mode === 'signup' ? 8 : undefined}
              required
            />
          </label>
          <ErrorNote message={error} />
          {notice && <p className="rounded-[20px] border border-line bg-subtle px-4 py-2.5">{notice}</p>}
          <button className="btn w-full" disabled={busy}>
            {copy.submit}
          </button>
        </form>

        <div className="flex items-center gap-3 font-mono text-xs text-muted">
          <span className="h-px flex-1 bg-line" />
          or
          <span className="h-px flex-1 bg-line" />
        </div>

        <GoogleSignIn onError={setError}>
          <button className="btn-outline w-full gap-2.5" onClick={google}>
            <GoogleMark />
            Continue with Google
          </button>
        </GoogleSignIn>
      </div>

        <p className="mt-6 text-muted">
          {copy.switchText}{' '}
          <Link to={copy.switchTo} className="font-medium text-fg hover:underline">
            {copy.switchLink}
          </Link>
        </p>
        <p className="label mt-6">
          By continuing you agree to the{' '}
          <Link to="/terms" className="underline underline-offset-2 hover:text-fg">
            terms
          </Link>{' '}
          and{' '}
          <Link to="/privacy" className="underline underline-offset-2 hover:text-fg">
            privacy page
          </Link>
          .
        </p>
      </section>
    </main>
  )
}

// Google's own button when this site is set up for it, and otherwise the
// children: our button, which goes the long way round through Supabase.
function GoogleSignIn({ onError, children }: { onError: (message: string) => void; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let live = true
    if (box.current) renderGoogleButton(box.current, onError).then((ok) => live && setReady(ok))
    return () => {
      live = false
    }
  }, [onError])

  return (
    <>
      <div ref={box} className={ready ? 'flex justify-center [color-scheme:light]' : 'hidden'} />
      {!ready && children}
    </>
  )
}

function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  )
}
