import { Link } from 'react-router-dom'
import { Logo } from '../components/ArcParts'
import { useTitle } from '../useTitle'

// Where questions about either page go.
const CONTACT = 'devanshmodi250@gmail.com'
const UPDATED = '9 October 2026'

type Section = { heading: string; body: string[] }

const PRIVACY: Section[] = [
  {
    heading: 'What WintArc is',
    body: ['WintArc is a personal project for running a winter arc: you set tracks and checkpoints, check in each day with a photo, and can follow friends doing the same. This page says what it stores about you and who can see it.'],
  },
  {
    heading: 'What we store',
    body: [
      'Your account: the email address and name from your Google account or the email you sign up with, and the username you pick. If you sign in with Google we never see your Google password.',
      'Your profile, if you fill it in: a photo, a short bio, a location, a link and some tags.',
      'Your arc: its name and dates, your tracks and their schedules, your checkpoints, and each daily check-in with the photo and note you attach to it.',
      'Your daily one-line reflections.',
      'Who you are friends with on WintArc, and friend requests.',
    ],
  },
  {
    heading: 'Who can see it',
    body: [
      'Tracks you mark public, their checkpoints and your streak, level and activity grid can be seen by other signed-in people, and you appear on the board.',
      'Your friends see your check-ins on public tracks in their feed: which checkpoint you worked on and the note you wrote. They never see the photo.',
      'Proof photos are private. Only you can see your own, and the person who runs WintArc can look at uploaded photos to check that nothing inappropriate is being posted. Nobody else can open them.',
      'Tracks you mark private are only ever shown to you.',
      'Your reflections are only ever shown to you.',
      'If you turn on your public page, anyone with its link can see your arc and public tracks without an account. It is off unless you turn it on.',
    ],
  },
  {
    heading: 'Where it lives',
    body: [
      'Sign-in, the database and photo storage run on Supabase. The website is served by Vercel and the server runs on Amazon Web Services. These companies process the data on our behalf to run the app.',
      'We do not sell your data, show ads, or use advertising or analytics trackers. Your browser keeps a sign-in session so you stay logged in.',
    ],
  },
  {
    heading: 'How long we keep it',
    body: [
      'Proof photos are temporary: they may be deleted from storage a few days after they are uploaded, while the check-in they backed up stays. Do not rely on WintArc to keep your photos.',
      'Everything else is kept until you delete your account.',
    ],
  },
  {
    heading: 'Your choices',
    body: [
      'On your profile, under Edit, you can download everything we hold about you as a file, and you can delete your account. Deleting your account removes your profile, arcs, check-ins, reflections and friendships for good.',
      'WintArc is not meant for children under 13.',
    ],
  },
]

const TERMS: Section[] = [
  {
    heading: 'Using WintArc',
    body: [
      'WintArc is a personal project offered as it is, free of charge, with no promise that it will always be available or free of mistakes. Use it at your own risk; do not rely on it for anything important.',
      'You need to be at least 13 to use it, and you are responsible for what happens on your account.',
    ],
  },
  {
    heading: 'How an arc works',
    body: ['Once you create an arc you cannot end it early, and the checkpoints of a track cannot be changed after the track is created. You are told this before you confirm. You can always delete your whole account.'],
  },
  {
    heading: 'What you upload',
    body: [
      'The photos, notes and profile details you add are yours. By adding them you let WintArc store them and show them to the people described in the privacy page. Your photos are only shown to you and to the administrator.',
      'Only upload photos of your own work. Do not upload anything illegal, sexually explicit, violent, hateful or harassing, anything that shows another person without their agreement, or anything you do not have the right to share.',
    ],
  },
  {
    heading: 'What we may do',
    body: [
      'We may remove content, or suspend or delete an account, that breaks these terms or puts other people at risk.',
      'We may change, pause or shut down WintArc, and may update these terms. The date at the top shows when they last changed.',
    ],
  },
]

const DOCS = {
  privacy: { title: 'Privacy', intro: 'What WintArc stores about you and who can see it.', sections: PRIVACY },
  terms: { title: 'Terms of use', intro: 'The short version of what you agree to by using WintArc.', sections: TERMS },
}

// The privacy page and the terms page. Both are open to anyone, signed in or not.
export function Legal({ doc }: { doc: keyof typeof DOCS }) {
  const { title, intro, sections } = DOCS[doc]
  useTitle(title)

  return (
    <main className="mx-auto max-w-[680px] space-y-10 px-6 py-12">
      <Link to="/">
        <Logo />
      </Link>
      <header>
        <div className="eyebrow">Last updated {UPDATED}</div>
        <h1 className="mt-3 text-[40px] leading-none font-medium">{title}</h1>
        <p className="mt-3 text-muted">{intro}</p>
      </header>
      {sections.map((section) => (
        <section key={section.heading} className="space-y-3">
          <h2 className="h2 text-xl">{section.heading}</h2>
          {section.body.map((paragraph) => (
            <p key={paragraph} className="leading-relaxed">
              {paragraph}
            </p>
          ))}
        </section>
      ))}
      <footer className="space-y-3 border-t border-line pt-6 text-muted">
        <p>
          Questions, or want something removed? Write to{' '}
          <a href={`mailto:${CONTACT}`} className="text-fg underline underline-offset-2">
            {CONTACT}
          </a>
          .
        </p>
        <p className="flex gap-4">
          <Link to="/privacy" className="hover:text-fg">
            Privacy
          </Link>
          <Link to="/terms" className="hover:text-fg">
            Terms
          </Link>
          <Link to="/" className="hover:text-fg">
            Back to WintArc
          </Link>
        </p>
      </footer>
    </main>
  )
}
