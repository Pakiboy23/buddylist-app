import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import AppIcon from '@/components/AppIcon';
import HimWordmark from '@/components/HimWordmark';
import RetroWindow from '@/components/RetroWindow';
import { useAppRouter, navigateAppPath } from '@/lib/appNavigation';
import { waitForSessionOrNull } from '@/lib/authClient';
import {
  checkPushPermission,
  requestAndRegisterPush,
  type PushPermissionStatus,
} from '@/lib/nativePush';
import { supabase } from '@/lib/supabase';

const SUPABASE_FUNCTIONS_URL = `${(import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? ''}/functions/v1`;

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

function openExternalUrl(url: string) {
  window.open(url, Capacitor.isNativePlatform() ? '_system' : '_blank');
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

  const [pushStatus, setPushStatus] = useState<PushPermissionStatus>('not-native');
  const [pushRequesting, setPushRequesting] = useState(false);

  const [exportPhase, setExportPhase] = useState<'idle' | 'loading' | 'error'>('idle');
  const [exportMessage, setExportMessage] = useState('');
  const exportLinkRef = useRef<HTMLAnchorElement | null>(null);

  const showLegacyNotice = useMemo(() => isLegacyDerivedEmail(currentEmail), [currentEmail]);

  useEffect(() => {
    void checkPushPermission().then(setPushStatus);
  }, []);

  const handleEnableNotifications = useCallback(async () => {
    setPushRequesting(true);
    const result = await requestAndRegisterPush();
    setPushStatus(result);
    setPushRequesting(false);
  }, []);

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

  const handleExport = useCallback(async () => {
    setExportPhase('loading');
    setExportMessage('');
    try {
      const session = await waitForSessionOrNull();
      if (!session) throw new Error('Not signed in.');

      const resp = await fetch(`${SUPABASE_FUNCTIONS_URL}/export-account`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (resp.status === 429) {
        const body = await resp.json() as { retry_after_seconds?: number };
        const hours = body.retry_after_seconds ? Math.ceil(body.retry_after_seconds / 3600) : 24;
        setExportPhase('error');
        setExportMessage(`You can only export once every 24 hours. Try again in ~${hours}h.`);
        return;
      }
      if (!resp.ok) {
        const body = await resp.json() as { error?: string };
        throw new Error(body.error ?? `Export failed (${resp.status})`);
      }

      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const filename = `hiitsme-export-${new Date().toISOString().slice(0, 10)}.json`;

      // Re-use or create a hidden anchor so we can clean up the object URL.
      let a = exportLinkRef.current;
      if (!a) {
        a = document.createElement('a');
        a.style.display = 'none';
        document.body.appendChild(a);
        exportLinkRef.current = a;
      }
      a.href = url;
      a.download = filename;
      a.click();
      // Revoke after a tick so the browser has time to start the download.
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      setExportPhase('idle');
    } catch (err) {
      setExportPhase('error');
      setExportMessage(err instanceof Error ? err.message : 'Export failed. Please try again.');
    }
  }, []);

  const handleDeleteAccount = useCallback(() => {
    navigateAppPath(router, '/account/delete');
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
                    ? 'border-amber-200/80 bg-amber-50/90 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200'
                    : emailPhase === 'sent'
                      ? 'border-emerald-200/80 bg-emerald-50/90 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200'
                      : 'border-slate-200/80 bg-white/88 text-slate-600 dark:border-slate-700 dark:bg-[#0F1424]/70 dark:text-slate-300'
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
                    ? 'border-amber-200/80 bg-amber-50/90 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200'
                    : passwordPhase === 'success'
                      ? 'border-emerald-200/80 bg-emerald-50/90 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200'
                      : 'border-slate-200/80 bg-white/88 text-slate-600 dark:border-slate-700 dark:bg-[#0F1424]/70 dark:text-slate-300'
                }`}
              >
                {passwordMessage}
              </p>
            ) : null}
          </form>

          <div className={`${sectionClass} space-y-3 border border-red-200/60 dark:border-red-500/30`}>
            <div>
              <h2 className="text-[16px] font-semibold text-red-700 dark:text-red-300">
                Delete account
              </h2>
              <p className="mt-1 text-[13px] leading-5 text-slate-500 dark:text-slate-400">
                Permanently erase your profile, messages, buddies, and sign-in. This cannot be undone.
              </p>
            </div>
            <button
              type="button"
              onClick={handleDeleteAccount}
              className="ui-focus-ring min-h-[48px] w-full rounded-2xl bg-red-600 px-4 py-2.5 text-[14px] font-semibold text-white transition active:scale-[0.99] hover:bg-red-700"
              data-testid="account-delete-cta"
            >
              Delete account
            </button>
          </div>

          {pushStatus !== 'not-native' && (
            <div className={`${sectionClass} space-y-3`}>
              <div>
                <h2 className="text-[16px] font-semibold text-slate-900 dark:text-slate-50">
                  Notifications
                </h2>
                {pushStatus === 'granted' && (
                  <p className="mt-1 text-[13px] leading-5 text-emerald-600 dark:text-emerald-400">
                    Push notifications are enabled.
                  </p>
                )}
                {pushStatus === 'prompt' && (
                  <p className="mt-1 text-[13px] leading-5 text-slate-500 dark:text-slate-400">
                    Get alerted when buddies send you a message.
                  </p>
                )}
                {pushStatus === 'denied' && (
                  <p className="mt-1 text-[13px] leading-5 text-slate-500 dark:text-slate-400">
                    Notifications are off. Go to Settings → H.I.M. → Notifications to re-enable.
                  </p>
                )}
              </div>
              {pushStatus === 'prompt' && (
                <button
                  type="button"
                  onClick={() => { void handleEnableNotifications(); }}
                  disabled={pushRequesting}
                  className={submitClass}
                >
                  {pushRequesting ? 'Requesting...' : 'Enable notifications'}
                </button>
              )}
            </div>
          )}

          <div className={`${sectionClass} space-y-3`}>
            <div>
              <h2 className="text-[16px] font-semibold text-slate-900 dark:text-slate-50">
                Your data
              </h2>
              <p className="mt-1 text-[13px] leading-5 text-slate-500 dark:text-slate-400">
                Download a copy of your profile, messages, room history, and settings. One export per 24 hours.
              </p>
            </div>
            <button
              type="button"
              data-testid="account-export-btn"
              onClick={() => { void handleExport(); }}
              disabled={exportPhase === 'loading'}
              className="ui-focus-ring min-h-[48px] w-full rounded-2xl bg-[#E8A23A] px-4 py-2.5 text-[14px] font-semibold text-[#13100E] transition active:scale-[0.99] hover:bg-[#D4912E] disabled:opacity-50"
            >
              {exportPhase === 'loading' ? 'Preparing export…' : 'Download your data'}
            </button>
            {exportPhase === 'error' && exportMessage ? (
              <p role="status" aria-live="polite" className="rounded-[1.2rem] border border-amber-200/80 bg-amber-50/90 px-4 py-2.5 text-[13px] leading-5 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                {exportMessage}
              </p>
            ) : null}
          </div>

          <div className={`${sectionClass} space-y-0.5`}>
            <h2 className="mb-2 text-[16px] font-semibold text-slate-900 dark:text-slate-50">
              Legal
            </h2>
            {(
              [
                { label: 'Privacy Policy', href: 'https://hiitsme.app/privacy' },
                { label: 'Terms of Service', href: 'https://hiitsme.app/terms' },
                { label: 'Contact Support', href: 'mailto:support@hiitsme.app' },
              ] as const
            ).map(({ label, href }) => (
              <button
                key={href}
                type="button"
                onClick={() => openExternalUrl(href)}
                className="ui-focus-ring flex min-h-[44px] w-full items-center justify-between rounded-xl px-1 py-2 text-[14px] text-slate-700 transition hover:bg-black/5 dark:text-slate-300 dark:hover:bg-white/5"
              >
                {label}
                <span className="text-slate-400" aria-hidden>›</span>
              </button>
            ))}
          </div>
        </div>
      </RetroWindow>
    </main>
  );
}
