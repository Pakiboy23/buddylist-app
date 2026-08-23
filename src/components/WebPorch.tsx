import RetroWindow from '@/components/RetroWindow';
import AppIcon from '@/components/AppIcon';

// GH-108: the porch cold web visitors see on hiitsme.app `/`.
// Native `/` never renders this — see resolveAuthLanding().
//
// Copy rules (him-app-expert): no dating vocabulary, no legacy-IM brand
// names in public copy, no member counts or "live now" numbers. The title bar renders
// the shipped wordmark via RetroWindow; body copy uses the press form. The
// canonical public line is "H.I.M. — Friends, Not Dates."

const APP_STORE_URL = 'https://apps.apple.com/us/app/h-i-m-friends-not-dates/id6761863631';

// The seven seeded launch rooms, in display order, blurbs verbatim from
// public.rooms — this is shipped product copy, not new marketing copy.
const LAUNCH_ROOMS: ReadonlyArray<{ name: string; blurb: string }> = [
  { name: 'New York City', blurb: 'The city that never sleeps.' },
  { name: 'Los Angeles', blurb: 'West Coast vibes, sun and screens.' },
  { name: 'Chicago', blurb: 'Chi-town. The Second City. Our kind of town.' },
  { name: 'Atlanta', blurb: 'ATL forever.' },
  { name: 'Everywhere Else', blurb: 'Not NYC, LA, Chicago, or ATL? This is your room.' },
  { name: 'Late Night', blurb: 'For the night owls. No judgment.' },
  { name: 'Sunday Reset', blurb: 'Prep, reflect, recharge. See you Monday.' },
];

interface WebPorchProps {
  onSignIn: () => void;
  onCreateAccount: () => void;
}

export default function WebPorch({ onSignIn, onCreateAccount }: WebPorchProps) {
  return (
    <main className="ui-auth-shell relative h-[100dvh] overflow-hidden">
      <div className="ui-auth-orb--rose pointer-events-none absolute -left-12 top-10 h-44 w-44 rounded-full blur-3xl" />
      <div className="ui-auth-orb--gold pointer-events-none absolute bottom-0 right-0 h-64 w-64 rounded-full blur-3xl" />

      <RetroWindow title="H.I.M.">
        <div className="h-full overflow-y-auto">
          <div className="mx-auto w-full max-w-md space-y-4 px-1 pb-10 pt-2">
            <section className="ui-auth-card rounded-[1.9rem] p-5 backdrop-blur-2xl">
              <span className="ui-brand-sparkle inline-flex h-11 w-11 items-center justify-center rounded-2xl">
                <AppIcon kind="sparkle" className="h-5 w-5" />
              </span>
              <p className="mt-4 text-[13px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                Hi, it&apos;s me.
              </p>
              <h1 className="mt-2 text-[31px] font-semibold leading-tight tracking-[-0.04em] text-slate-900 dark:text-slate-50">
                Friends, not dates.
              </h1>
              <p className="mt-3 text-[14px] leading-6 text-slate-500 dark:text-slate-400">
                H.I.M. is a small, retro messenger for gay men who want more friends.
                Pick a screen name, set an away message, build your buddy list, and hang out in
                seven rooms that feel like the early internet — warm, slow, and actually social.
              </p>

              <div className="mt-5 space-y-2.5">
                <a
                  href={APP_STORE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ui-focus-ring ui-auth-submit inline-flex min-h-[52px] w-full items-center justify-center rounded-2xl px-4 py-3 text-[15px] font-semibold transition active:scale-[0.99]"
                >
                  Download on the App Store
                </a>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={onCreateAccount}
                    className="ui-focus-ring ui-auth-secondary inline-flex min-h-[46px] items-center justify-center rounded-2xl px-3 text-[13px] font-semibold transition"
                  >
                    Create account
                  </button>
                  <button
                    type="button"
                    onClick={onSignIn}
                    className="ui-focus-ring ui-auth-secondary inline-flex min-h-[46px] items-center justify-center rounded-2xl px-3 text-[13px] font-semibold transition"
                  >
                    Sign in
                  </button>
                </div>
              </div>
            </section>

            <section className="ui-auth-card rounded-[1.9rem] p-5 backdrop-blur-2xl">
              <h2 className="text-[15px] font-semibold text-slate-900 dark:text-slate-50">
                Seven rooms. Always open.
              </h2>
              <ul className="mt-3 space-y-2.5">
                {LAUNCH_ROOMS.map((room) => (
                  <li key={room.name} className="flex items-baseline gap-2.5">
                    <span aria-hidden="true" className="text-[12px] text-[var(--color-accent)]">
                      ●
                    </span>
                    <p className="min-w-0 text-[14px] leading-6">
                      <span className="font-semibold text-slate-800 dark:text-slate-100">{room.name}</span>{' '}
                      <span className="text-slate-500 dark:text-slate-400">{room.blurb}</span>
                    </p>
                  </li>
                ))}
              </ul>
            </section>

            <section className="ui-auth-card rounded-[1.9rem] p-5 backdrop-blur-2xl">
              <h2 className="text-[15px] font-semibold text-slate-900 dark:text-slate-50">New here?</h2>
              <p className="mt-2 text-[14px] leading-6 text-slate-500 dark:text-slate-400">
                Add <span className="ui-screenname font-semibold text-slate-800 dark:text-slate-100">Pakiboy24</span> once
                you&apos;re inside — that&apos;s the founder. Say hi, ask anything.
              </p>
            </section>

            <footer className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 pb-2 text-[12px] text-slate-500 dark:text-slate-400">
              <span>For adults 18+</span>
              <span aria-hidden="true">·</span>
              <a className="ui-focus-ring rounded-md underline-offset-2 hover:underline" href="/privacy">
                Privacy
              </a>
              <span aria-hidden="true">·</span>
              <a className="ui-focus-ring rounded-md underline-offset-2 hover:underline" href="/terms">
                Terms
              </a>
              <span aria-hidden="true">·</span>
              <a className="ui-focus-ring rounded-md underline-offset-2 hover:underline" href="/support">
                Support
              </a>
            </footer>
          </div>
        </div>
      </RetroWindow>
    </main>
  );
}
