import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import AppIcon from '@/components/AppIcon';
import HimWordmark from '@/components/HimWordmark';
import RetroWindow from '@/components/RetroWindow';
import { useAppRouter, navigateAppPath } from '@/lib/appNavigation';
import { waitForSessionOrNull } from '@/lib/authClient';
import { supabase } from '@/lib/supabase';

// Legacy accounts were created with derived emails like `<screenname>@hiitsme.app`
// or `<screenname>@buddylist.com`. These addresses don't exist in the real world,
// so password-reset emails sent to them go nowhere. Surface a notice when the
// signed-in user has one.
const LEGACY_AUTH_DOMAINS = ['hiitsme.app', 'buddylist.com'];

function isLegacyDerivedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return false;
  return LEGACY_AUTH_DOMAINS.includes(domain);
}

function isStrongEnoughPassword(password: string) {
  return password.length >= 8;
}

type EmailPhase = 'idle' | 'submitting' | 'sent' | 'error';
type PasswordPhase = 'idle' | 'submitting' | 'success' | 'error';
type LoadPhase = 'loading' | 'ready' | 'unauthorized';

export default function AccountPage() {
  const router = useAppRouter();

  const [loadPhase, setLoadPhase] = useState<LoadPhase>('loading');
  const [currentEmail, setCurrentEmail] = useState<string>('');
  const [screenname, setScreenname] = useState<string>('');

  const [newEmail, setNewEmail] = useState('');
  const [emailPhase, setEmailPhase] = useState<EmailPhase>('idle');
  const [emailMessage, setEmailMessage] = useState<string>('');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordPhase, setPasswordPhase] = useState<PasswordPhase>('idle');
  const [passwordMessage, setPasswordMessage] = useState<string>('');

  const showLegacyNotice = useMemo(() => isLegacyDerivedEmail(currentEmail), [currentEmail]);

  const fieldClass = useMemo(
    () => 'ui-focus-ring ui-auth-field min-h-[52px] w-full rounded-2xl px-4 py-3 text-[15px] font-medium',
    [],
  );
  const submitClass =
    'ui-focus-ring ui-auth-submit min-h-[48px] w-full rounded-2xl px-4 py-2.5 text-[14px] font-semibold transition active:scale-[0.99] disabled:opacity-50';
  const sectionClass = 'ui-auth-card rounded-[1.6rem] p-5 backdrop-blur-2xl';

  useEffect(() => {
    let isCancelled = false;

    const bootstrap = async () => {
      const session = await waitForSessionOrNull();
      if (isCancelled) return;
      if (!session) {
        setLoadPhase('unauthorized');
        navigateAppPath(router, '/', { replace: true });
        return;
      }

      setCurrentEmail(session.user.email ?? '');
      const meta = session.user.user_metadata as Record<string, unknown> | undefined;
      const metaScreenname = typeof meta?.screenname === 'string' ? meta.screenname : '';
      setScreenname(metaScreenname);
      setLoadPhase('ready');
    };

    void bootstrap();

    return () => {
      isCancelled = true;
    };
  }, [router]);

  const handleBack = useCallback(() => {
    navigateAppPath(router, '/hi-its-me');
  }, [router]);

  const handleEmailSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = newEmail.trim().toLowerCase();
    if (!trimmed.includes('@')) {
      setEmailPhase('error');
      setEmailMessage('Please enter a valid email address.');
      return;
    }
    if (trimmed === currentEmail.toLowerCase()) {
      setEmailPhase('error');
      setEmailMessage('That is already your email address.');
      return;
    }

    setEmailPhase('submitting');
    setEmailMessage('Sending confirmation link...');

    const { error } = await supabase.auth.updateUser({ email: trimmed });

    if (error) {
      setEmailPhase('error');
      setEmailMessage(`Update failed: ${error.message}`);
      return;
    }

    setEmailPhase('sent');
    setEmailMessage(
      `Confirmation link sent to ${trimmed}. Open the link to finish the change. Until you do, sign-in still uses your current email.`,
    );
    setNewEmail('');
  };

  const handlePasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isStrongEnoughPassword(newPassword)) {
      setPasswordPhase('error');
      setPasswordMessage('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordPhase('error');
      setPasswordMessage('Passwords do not match.');
      return;
    }

    setPasswordPhase('submitting');
    setPasswordMessage('Updating password...');

    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      setPasswordPhase('error');
      setPasswordMessage(`Update failed: ${error.message}`);
      return;
    }

    setPasswordPhase('success');
    setPasswordMessage('Password updated.');
    setNewPassword('');
    setConfirmPassword('');
  };

  if (loadPhase === 'loading' || loadPhase === 'unauthorized') {
    return null;
  }

  return (
    <main className="ui-auth-shell relative min-h-[100dvh] overflow-y-auto pb-12">
      <div className="ui-auth-orb--rose pointer-events-none absolute -left-12 top-10 h-44 w-44 rounded-full blur-3xl" />
      <div className="ui-auth-orb--gold pointer-events-none absolute bottom-0 right-0 h-64 w-64 rounded-full blur-3xl" />

      <RetroWindow title="H.I.M.">
        <div className="mx-auto flex w-full max-w-md flex-col gap-4 pb-8 pt-2">
          <header className="flex items-start justify-between gap-4 px-1">
            <div className="min-w-0">
              <span className="ui-brand-sparkle inline-flex h-11 w-11 items-center justify-center rounded-2xl">
                <AppIcon kind="sparkle" className="h-5 w-5" />
              </span>
              <HimWordmark className="mt-4 text-[13px]" />
              <h1 className="mt-2 text-[31px] font-semibold tracking-[-0.04em] text-slate-900 dark:text-slate-50">
                Account
              </h1>
              {screenname ? (
                <p className="mt-2 text-[14px] leading-6 text-slate-500 dark:text-slate-400">
                  Signed in as <strong>{screenname}</strong>
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={handleBack}
              className="ui-focus-ring ui-auth-back inline-flex min-h-[40px] shrink-0 items-center rounded-full px-3 text-[12px] font-semibold transition"
            >
              Back
            </button>
          </header>

          {showLegacyNotice ? (
            <div className="ui-note-info rounded-[1.4rem] border border-amber-300/50 bg-amber-50/80 px-4 py-3 text-[13px] leading-5 text-amber-800 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-200">
              Your account is using a placeholder email <strong>({currentEmail})</strong>. Add a real email address below so password reset works for you.
            </div>
          ) : null}

          <form onSubmit={handleEmailSubmit} className={`${sectionClass} space-y-4`}>
            <div>
              <h2 className="text-[16px] font-semibold text-slate-900 dark:text-slate-50">Email address</h2>
              <p className="mt-1 text-[13px] leading-5 text-slate-500 dark:text-slate-400">
                Used for password reset. Current address: <strong>{currentEmail || 'none'}</strong>
              </p>
            </div>

            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                New email
              </label>
              <input
                type="email"
                value={newEmail}
                onChange={(event) => setNewEmail(event.target.value)}
                className={fieldClass}
                placeholder="your@email.com"
                disabled={emailPhase === 'submitting'}
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect="off"
              />
            </div>

            <button
              type="submit"
              disabled={emailPhase === 'submitting' || !newEmail.trim()}
              className={submitClass}
            >
              {emailPhase === 'submitting' ? 'Sending...' : 'Send confirmation link'}
            </button>

            {emailMessage ? (
              <p
                role="status"
                aria-live="polite"
                className={`rounded-[1.2rem] border px-4 py-2.5 text-[13px] leading-5 ${
                  emailPhase === 'error'
                    ? 'border-rose-200/80 bg-rose-50/90 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200'
                    : emailPhase === 'sent'
                      ? 'border-emerald-200/80 bg-emerald-50/90 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200'
                      : 'border-slate-200/80 bg-white/88 text-slate-600 dark:border-slate-700 dark:bg-[#13100E]/70 dark:text-slate-300'
                }`}
              >
                {emailMessage}
              </p>
            ) : null}
          </form>

          <form onSubmit={handlePasswordSubmit} className={`${sectionClass} space-y-4`}>
            <div>
              <h2 className="text-[16px] font-semibold text-slate-900 dark:text-slate-50">Password</h2>
              <p className="mt-1 text-[13px] leading-5 text-slate-500 dark:text-slate-400">
                Set a new password while you&apos;re signed in.
              </p>
            </div>

            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                New password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                className={fieldClass}
                placeholder="At least 8 characters"
                disabled={passwordPhase === 'submitting'}
                autoComplete="new-password"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                Confirm new password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className={fieldClass}
                placeholder="Re-enter new password"
                disabled={passwordPhase === 'submitting'}
                autoComplete="new-password"
              />
            </div>

            <button
              type="submit"
              disabled={passwordPhase === 'submitting' || !newPassword || !confirmPassword}
              className={submitClass}
            >
              {passwordPhase === 'submitting' ? 'Updating...' : 'Update password'}
            </button>

            {passwordMessage ? (
              <p
                role="status"
                aria-live="polite"
                className={`rounded-[1.2rem] border px-4 py-2.5 text-[13px] leading-5 ${
                  passwordPhase === 'error'
                    ? 'border-rose-200/80 bg-rose-50/90 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200'
                    : passwordPhase === 'success'
                      ? 'border-emerald-200/80 bg-emerald-50/90 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200'
                      : 'border-slate-200/80 bg-white/88 text-slate-600 dark:border-slate-700 dark:bg-[#13100E]/70 dark:text-slate-300'
                }`}
              >
                {passwordMessage}
              </p>
            ) : null}
          </form>
        </div>
      </RetroWindow>
    </main>
  );
}
