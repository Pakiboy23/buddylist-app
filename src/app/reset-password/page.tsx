import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppIcon from '@/components/AppIcon';
import HimWordmark from '@/components/HimWordmark';
import RetroWindow from '@/components/RetroWindow';
import { supabase } from '@/lib/supabase';

type Phase = 'loading' | 'ready' | 'updating' | 'success' | 'invalid' | 'error';

interface RecoveryTokens {
  accessToken: string;
  refreshToken: string;
}

function parseRecoveryTokensFromHash(hash: string): RecoveryTokens | null {
  if (!hash) return null;
  const trimmed = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!trimmed) return null;

  const params = new URLSearchParams(trimmed);
  const type = params.get('type');
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');

  if (type !== 'recovery' || !accessToken || !refreshToken) {
    return null;
  }

  return { accessToken, refreshToken };
}

function isStrongEnoughPassword(password: string) {
  return password.length >= 8;
}

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>('loading');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [statusMsg, setStatusMsg] = useState('Validating reset link...');

  const fieldClass = useMemo(
    () => 'ui-focus-ring ui-auth-field min-h-[52px] w-full rounded-2xl px-4 py-3 text-[15px] font-medium',
    [],
  );

  useEffect(() => {
    let isCancelled = false;

    const exchangeTokens = async () => {
      const tokens = parseRecoveryTokensFromHash(window.location.hash);
      if (!tokens) {
        if (isCancelled) return;
        setPhase('invalid');
        setStatusMsg('This reset link is invalid or has expired. Request a new one from the sign-in screen.');
        return;
      }

      const { error } = await supabase.auth.setSession({
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
      });

      if (isCancelled) return;

      if (error) {
        setPhase('invalid');
        setStatusMsg(`Reset link could not be verified: ${error.message}`);
        return;
      }

      // Clear the tokens from the URL so they don't linger in history.
      try {
        window.history.replaceState(null, '', window.location.pathname);
      } catch {
        // ignore — non-critical
      }

      setPhase('ready');
      setStatusMsg('Choose a new password for your account.');
    };

    void exchangeTokens();

    return () => {
      isCancelled = true;
    };
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isStrongEnoughPassword(password)) {
      setStatusMsg('Password must be at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setStatusMsg('Passwords do not match.');
      return;
    }

    setPhase('updating');
    setStatusMsg('Updating password...');

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setPhase('error');
      setStatusMsg(`Reset failed: ${error.message}`);
      return;
    }

    // Sign out so the user signs in fresh with the new password.
    await supabase.auth.signOut({ scope: 'local' });

    setPhase('success');
    setStatusMsg('Password updated. Sign in with your new password.');
  };

  const handleReturnToSignIn = () => {
    navigate('/', { replace: true });
  };

  const isBusy = phase === 'loading' || phase === 'updating';

  const normalizedStatus = statusMsg.toLowerCase();
  const statusClass =
    normalizedStatus.includes('failed') || normalizedStatus.includes('invalid') || normalizedStatus.includes('do not match') || normalizedStatus.includes('must be')
      ? 'border-rose-200/80 bg-rose-50/90 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200'
      : normalizedStatus.includes('updated') || normalizedStatus.includes('success')
        ? 'border-emerald-200/80 bg-emerald-50/90 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200'
        : 'border-slate-200/80 bg-white/88 text-slate-600 dark:border-slate-700 dark:bg-[#13100E]/70 dark:text-slate-300';

  return (
    <main className="ui-auth-shell relative h-[100dvh] overflow-hidden">
      <div className="ui-auth-orb--rose pointer-events-none absolute -left-12 top-10 h-44 w-44 rounded-full blur-3xl" />
      <div className="ui-auth-orb--gold pointer-events-none absolute bottom-0 right-0 h-64 w-64 rounded-full blur-3xl" />

      <RetroWindow title="H.I.M.">
        <div className="mx-auto flex min-h-full w-full max-w-md items-center pb-6 pt-2">
          <form onSubmit={handleSubmit} className="w-full space-y-4">
            <section className="ui-auth-card rounded-[1.9rem] p-5 backdrop-blur-2xl">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <span className="ui-brand-sparkle inline-flex h-11 w-11 items-center justify-center rounded-2xl">
                    <AppIcon kind="sparkle" className="h-5 w-5" />
                  </span>
                  <HimWordmark className="mt-4 text-[13px]" />
                  <h1 className="mt-2 text-[31px] font-semibold tracking-[-0.04em] text-slate-900 dark:text-slate-50">
                    Reset password
                  </h1>
                  <p className="mt-2 max-w-[22rem] text-[14px] leading-6 text-slate-500 dark:text-slate-400">
                    Set a new password to finish signing in.
                  </p>
                </div>
              </div>

              {phase === 'success' ? (
                <div className="mt-5 flex flex-col items-center gap-3 py-4 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/30">
                    <AppIcon kind="check" className="h-7 w-7 text-emerald-500" />
                  </div>
                  <p className="text-[15px] font-semibold text-slate-800 dark:text-slate-100">Password updated</p>
                  <p className="text-[13px] leading-5 text-slate-500 dark:text-slate-400">
                    Your password has been changed. Sign in with your new credentials.
                  </p>
                  <button
                    type="button"
                    onClick={handleReturnToSignIn}
                    className="ui-focus-ring ui-auth-submit mt-2 min-h-[48px] rounded-2xl px-6 text-[14px] font-semibold transition active:scale-[0.99]"
                  >
                    Back to sign in
                  </button>
                </div>
              ) : phase === 'invalid' ? (
                <div className="mt-5 flex flex-col items-center gap-3 py-4 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 dark:bg-rose-950/30">
                    <AppIcon kind="shield" className="h-7 w-7 text-rose-500" />
                  </div>
                  <p className="text-[15px] font-semibold text-slate-800 dark:text-slate-100">Link not valid</p>
                  <p className="text-[13px] leading-5 text-slate-500 dark:text-slate-400">{statusMsg}</p>
                  <button
                    type="button"
                    onClick={handleReturnToSignIn}
                    className="ui-focus-ring ui-auth-submit mt-2 min-h-[48px] rounded-2xl px-6 text-[14px] font-semibold transition active:scale-[0.99]"
                  >
                    Back to sign in
                  </button>
                </div>
              ) : (
                <div className="mt-5 space-y-4 ui-fade-in">
                  <div>
                    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                      New password
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className={fieldClass}
                      placeholder="At least 8 characters"
                      disabled={isBusy || phase !== 'ready' && phase !== 'error' && phase !== 'updating'}
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
                      disabled={isBusy || phase !== 'ready' && phase !== 'error' && phase !== 'updating'}
                      autoComplete="new-password"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isBusy}
                    className="ui-focus-ring ui-auth-submit mt-2 min-h-[52px] w-full rounded-2xl px-4 py-3 text-[15px] font-semibold transition active:scale-[0.99] disabled:opacity-50"
                  >
                    {phase === 'updating' ? 'Updating...' : phase === 'loading' ? 'Verifying...' : 'Update password'}
                  </button>
                </div>
              )}
            </section>

            {statusMsg && phase !== 'success' && phase !== 'invalid' ? (
              <p
                role="status"
                aria-live="polite"
                className={`rounded-[1.4rem] border px-4 py-3 text-[13px] font-medium leading-6 shadow-sm ${statusClass}`}
              >
                {statusMsg}
              </p>
            ) : null}
          </form>
        </div>
      </RetroWindow>
    </main>
  );
}
