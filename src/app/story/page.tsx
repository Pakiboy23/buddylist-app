import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'The Story Behind H.I.M.',
  description:
    'Why I built H.I.M. — a messenger for people who miss when the internet felt personal.',
  openGraph: {
    title: 'The Story Behind H.I.M.',
    description:
      'Why I built H.I.M. — a messenger for people who miss when the internet felt personal.',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'The Story Behind H.I.M.',
    description:
      'Why I built H.I.M. — a messenger for people who miss when the internet felt personal.',
  },
};

export default function StoryPage() {
  return (
    <main className="relative min-h-[100dvh] overflow-x-hidden bg-[#13100E] text-[#F7F0E8]">
      {/* Ambient orbs */}
      <div className="pointer-events-none fixed -left-24 top-20 h-72 w-72 rounded-full bg-[#E8608A]/10 blur-[120px]" />
      <div className="pointer-events-none fixed -right-24 bottom-20 h-72 w-72 rounded-full bg-[#D4963A]/10 blur-[120px]" />

      <div className="relative mx-auto max-w-2xl px-6 pb-24 pt-16 sm:px-8 sm:pt-24">
        {/* Back to app */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[13px] font-semibold text-[#9C8E82] backdrop-blur-sm transition hover:bg-white/10 hover:text-[#F7F0E8]"
        >
          <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
            <path d="M10 13 5 8l5-5" />
          </svg>
          Back to H.I.M.
        </Link>

        {/* Hero */}
        <header className="mt-12 sm:mt-16">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#D4963A]">
            The story
          </p>
          <h1 className="mt-4 text-[clamp(2rem,6vw,3.2rem)] font-extrabold leading-[1.1] tracking-[-0.04em]">
            I missed when messaging{' '}
            <span className="bg-gradient-to-r from-[#E8608A] to-[#D4963A] bg-clip-text text-transparent">
              felt personal.
            </span>
          </h1>
          <p className="mt-6 text-[17px] leading-8 text-[#9C8E82]">
            So I built what I wished still existed.
          </p>
        </header>

        {/* Body */}
        <article className="mt-16 space-y-14">
          <section>
            <h2 className="text-[13px] font-bold uppercase tracking-[0.16em] text-[#D4963A]">
              The problem
            </h2>
            <div className="mt-4 space-y-5 text-[16px] leading-[1.75] text-[#C4B8AC]">
              <p>
                Every messaging app today is designed to be everything to everyone. Group threads with 47 people. Algorithmic feeds shoved into your DMs. Read receipts that turned conversations into obligations.
              </p>
              <p>
                Somewhere along the way, messaging stopped being about connecting with your people and started being about managing notifications.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-[13px] font-bold uppercase tracking-[0.16em] text-[#D4963A]">
              The feeling I wanted back
            </h2>
            <div className="mt-4 space-y-5 text-[16px] leading-[1.75] text-[#C4B8AC]">
              <p>
                If you grew up with AIM, you remember what it felt like. You&apos;d get home, open your laptop, and see who was online. Your buddy list was your actual friends — not a social graph. You&apos;d set an away message like a tiny broadcast to the people who mattered. The door sound meant someone just showed up.
              </p>
              <p>
                That feeling — of a small, intentional space with your real people — doesn&apos;t exist anymore. I wanted to bring it back, but make it feel like something you&apos;d actually want to use in 2026.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-[13px] font-bold uppercase tracking-[0.16em] text-[#D4963A]">
              What H.I.M. is
            </h2>
            <div className="mt-4 space-y-5 text-[16px] leading-[1.75] text-[#C4B8AC]">
              <p>
                <strong className="text-[#F7F0E8]">H.I.M.</strong> is a messenger for your actual friends. Screen names instead of phone numbers. A buddy list that shows who&apos;s around. Away messages that feel like a vibe, not a status update. Chat rooms with a # prefix and a reason to exist.
              </p>
              <p>
                The design is inspired by Apple&apos;s glass aesthetic — warm, minimal, feels native on your phone — but the soul is AIM. You sign on. You see your buddies. You talk. That&apos;s it.
              </p>
              <p>
                No algorithmic feed. No stories. No &ldquo;suggested friends.&rdquo; No ads. Just messaging that respects your attention.
              </p>
            </div>
          </section>

          {/* Separator */}
          <div className="flex items-center gap-4">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          </div>

          <section>
            <h2 className="text-[13px] font-bold uppercase tracking-[0.16em] text-[#D4963A]">
              About me
            </h2>
            <div className="mt-4 space-y-5 text-[16px] leading-[1.75] text-[#C4B8AC]">
              <p>
                I&apos;m Haaris. I&apos;m building H.I.M. because I believe the best version of social software already happened — it just needs a second chance with better design and modern infrastructure.
              </p>
              <p>
                This isn&apos;t a VC-backed startup chasing scale. It&apos;s a product built by someone who misses the old internet and thinks other people do too. Every feature exists because it makes the experience better for a small group of friends, not because it drives engagement metrics.
              </p>
            </div>
          </section>

          {/* CTA */}
          <section className="rounded-[1.6rem] border border-white/8 bg-white/[0.03] p-8 backdrop-blur-sm">
            <p className="text-[20px] font-bold tracking-[-0.02em] text-[#F7F0E8]">
              Want in?
            </p>
            <p className="mt-3 text-[15px] leading-7 text-[#9C8E82]">
              H.I.M. is live on TestFlight and the web. Create a screen name, add your friends, and see what messaging feels like when it&apos;s built for people, not engagement.
            </p>
            <Link
              href="/"
              className="mt-6 inline-flex min-h-[48px] items-center rounded-2xl bg-gradient-to-r from-[#E8608A] to-[#D4963A] px-6 text-[15px] font-bold text-white shadow-lg shadow-[#E8608A]/20 transition hover:shadow-xl hover:shadow-[#E8608A]/30 active:scale-[0.98]"
            >
              Create your screen name
            </Link>
          </section>
        </article>

        {/* Footer */}
        <footer className="mt-20 border-t border-white/6 pt-8 text-center text-[13px] text-[#6A645C]">
          <p>Built by Haaris &middot; H.I.M. 2026</p>
        </footer>
      </div>
    </main>
  );
}
