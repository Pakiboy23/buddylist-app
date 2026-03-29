'use client';

import { FormEvent, useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import AppIcon from '@/components/AppIcon';
import RetroWindow from '@/components/RetroWindow';
import { waitForSessionOrNull } from '@/lib/authClient';
import { getAppApiUrl } from '@/lib/appApi';
import { navigateAppPath } from '@/lib/appNavigation';
import { initSoundSystem, playUiSound } from '@/lib/sound';
import { supabase } from '@/lib/supabase';

const SIGN_ON_SOUND = '/sounds/aol-welcome.mp3';
const SIGN_ON_FALLBACK_SOUND = '/sounds/aim.mp3';
type AuthView = 'sign-on' | 'forgot-password' | 'redeem-ticket';

interface ResetApiSuccess {
  ok: boolean;
  nextRecoveryCode?: string;
}

interface ApiErrorResponse {
  error?: string;
}

function subscribeToHydration() {
  return () => {};
}

export default function Home() {
  const [screenname, setScreenname] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const isHydrated = useSyncExternalStore(subscribeToHydration, () => true, () => false);
  const [authView, setAuthView] = useState<AuthView>('sign-on');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [resetTicket, setResetTicket] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [rotatedRecoveryCode, setRotatedRecoveryCode] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState('Welcome back. Enter your screen name and password.');
  const [isLoading, setIsLoading] = useState(false);
  const hasNavigatedRef = useRef(false);
  const router = useRouter();
  const controlsDisabled = isLoading || !isHydrated;

  const playSignOnSound = useCallback(async () => {
    try {
      const played = await playUiSound(SIGN_ON_SOUND, {
        volume: 0.85,
        fallbackSrc: SIGN_ON_FALLBACK_SOUND,
      });
      if (!played) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 220));
    } catch {
      // Ignore playback failures.
    }
  }, []);

  const routeToBuddyList = useCallback(
    async (withSound: boolean) => {
      if (hasNavigatedRef.current) {
        return;
      }

      hasNavigatedRef.current = true;
      if (withSound) {
        await playSignOnSound();
      }
      navigateAppPath(router, '/buddy-list');
    },
    [playSignOnSound, router],
  );

  useEffect(() => {
    initSoundSystem();
  }, []);

  useEffect(() => {
    let isMounted = true;

    const checkSession = async () => {
      const session = await waitForSessionOrNull();

      if (!isMounted || !session) {
        return;
      }

      await routeToBuddyList(false);
    };
    void checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session || event !== 'SIGNED_IN') {
        return;
      }

      void routeToBuddyList(true);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [routeToBuddyList]);

  const applyViewStatusMessage = (view: AuthView, signUpMode: boolean) => {
    if (view === 'forgot-password') {
      setStatusMsg('Enter your recovery code and choose a new password.');
      return;
    }

    if (view === 'redeem-ticket') {
      setStatusMsg('Use your admin ticket to set a fresh password.');
      return;
    }

    setStatusMsg(signUpMode ? 'Choose a screen name and password to create your account.' : 'Welcome back. Enter your screen name and password.');
  };

  const switchAuthView = (nextView: AuthView) => {
    setAuthView(nextView);
    if (nextView !== 'sign-on') {
      setIsSignUp(false);
    }
    setRotatedRecoveryCode(null);
    applyViewStatusMessage(nextView, isSignUp);
  };

  const resetRecoveryFields = () => {
    setRecoveryCode('');
    setResetTicket('');
    setNewPassword('');
    setConfirmNewPassword('');
  };

  const openSignUp = () => {
    setAuthView('sign-on');
    setIsSignUp(true);
    setRotatedRecoveryCode(null);
    applyViewStatusMessage('sign-on', true);
  };

  const returnToSignIn = () => {
    setAuthView('sign-on');
    setIsSignUp(false);
    setRotatedRecoveryCode(null);
    applyViewStatusMessage('sign-on', false);
  };

  const getAuthEmail = () => {
    const trimmedScreenname = screenname.trim();
    return `${trimmedScreenname.toLowerCase()}@buddylist.com`;
  };

  const readApiError = async (response: Response) => {
    try {
      const data = (await response.json()) as ApiErrorResponse;
      return data.error ?? 'Request failed.';
    } catch {
      return 'Request failed.';
    }
  };

  const handleSignOn = async () => {
    const trimmedScreenname = screenname.trim();
    if (!trimmedScreenname || !password) {
      setStatusMsg('Please enter your Screen Name and Password.');
      return;
    }

    const authEmail = getAuthEmail();
    setIsLoading(true);
    setStatusMsg(isSignUp ? 'Creating account...' : 'Dialing in...');

    if (isSignUp) {
      const { data, error } = await supabase.auth.signUp({
        email: authEmail,
        password,
        options: {
          data: {
            screenname: trimmedScreenname,
          },
        },
      });

      if (error) {
        setStatusMsg(`Connection failed: ${error.message}`);
        setIsLoading(false);
        return;
      }

      if (data.session) {
        setStatusMsg('Account created. Signing you on...');
        await routeToBuddyList(true);
      } else {
        setStatusMsg('Account created. Check your email to confirm, then sign on.');
      }

      setIsLoading(false);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: authEmail,
      password,
    });

    if (error) {
      const isInvalidCredentials = error.message.toLowerCase().includes('invalid login credentials');
      setStatusMsg(`Connection failed: ${isInvalidCredentials ? 'Invalid login credentials.' : error.message}`);
      setIsLoading(false);
      return;
    }

    setStatusMsg('Success! Opening your Buddy List...');
    await routeToBuddyList(true);
    setIsLoading(false);
  };

  const handleRecoveryReset = async () => {
    const trimmedScreenname = screenname.trim();
    if (!trimmedScreenname || !recoveryCode || !newPassword || !confirmNewPassword) {
      setStatusMsg('Please fill in Screen Name, Recovery Code, and New Password.');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setStatusMsg('New password and confirmation do not match.');
      return;
    }

    setIsLoading(true);
    setStatusMsg('Verifying recovery code...');

    let response: Response;
    try {
      response = await fetch(getAppApiUrl('/api/auth/recovery/reset'), {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          screenname: trimmedScreenname,
          recoveryCode,
          newPassword,
        }),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Load failed';
      setStatusMsg(`Reset failed: ${message}`);
      setIsLoading(false);
      return;
    }

    if (!response.ok) {
      const errorMessage = await readApiError(response);
      setStatusMsg(`Reset failed: ${errorMessage}`);
      setIsLoading(false);
      return;
    }

    const payload = (await response.json()) as ResetApiSuccess;
    setRotatedRecoveryCode(payload.nextRecoveryCode ?? null);
    setPassword('');
    setIsSignUp(false);
    setAuthView('sign-on');
    resetRecoveryFields();
    setStatusMsg('Password reset complete. Save your new recovery code, then sign on.');
    setIsLoading(false);
  };

  const handleTicketRedemption = async () => {
    const trimmedScreenname = screenname.trim();
    if (!trimmedScreenname || !resetTicket || !newPassword || !confirmNewPassword) {
      setStatusMsg('Please fill in Screen Name, Ticket, and New Password.');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setStatusMsg('New password and confirmation do not match.');
      return;
    }

    setIsLoading(true);
    setStatusMsg('Redeeming reset ticket...');

    let response: Response;
    try {
      response = await fetch(getAppApiUrl('/api/auth/recovery/redeem-ticket'), {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          screenname: trimmedScreenname,
          ticket: resetTicket,
          newPassword,
        }),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Load failed';
      setStatusMsg(`Ticket failed: ${message}`);
      setIsLoading(false);
      return;
    }

    if (!response.ok) {
      const errorMessage = await readApiError(response);
      setStatusMsg(`Ticket failed: ${errorMessage}`);
      setIsLoading(false);
      return;
    }

    const payload = (await response.json()) as ResetApiSuccess;
    setRotatedRecoveryCode(payload.nextRecoveryCode ?? null);
    setPassword('');
    setIsSignUp(false);
    setAuthView('sign-on');
    resetRecoveryFields();
    setStatusMsg('Ticket redeemed. Save your new recovery code, then sign on.');
    setIsLoading(false);
  };

  const handlePrimarySubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setRotatedRecoveryCode(null);

    if (authView === 'forgot-password') {
      await handleRecoveryReset();
      return;
    }

    if (authView === 'redeem-ticket') {
      await handleTicketRedemption();
      return;
    }

    await handleSignOn();
  };

  const copyRecoveryCode = async () => {
    if (!rotatedRecoveryCode) {
      return;
    }

    try {
      await navigator.clipboard.writeText(rotatedRecoveryCode);
      setStatusMsg('Recovery code copied.');
    } catch {
      setStatusMsg('Could not copy automatically. Please copy it manually.');
    }
  };

  const normalizedStatusMsg = statusMsg.toLowerCase();
  const isSignOnView = authView === 'sign-on';
  const authTitle =
    authView === 'forgot-password'
      ? 'Reset password'
      : authView === 'redeem-ticket'
        ? 'Redeem ticket'
        : isSignUp
          ? 'Create account'
          : 'Sign in';
  const authDescription =
    authView === 'forgot-password'
      ? 'Reset your password with your recovery code.'
      : authView === 'redeem-ticket'
        ? 'Use an admin-issued ticket to get back in.'
        : isSignUp
          ? 'Create your screen name and start chatting.'
          : 'Sign in with your screen name and password.';
  const baselineStatusMsg =
    authView === 'forgot-password'
      ? 'Enter your recovery code and choose a new password.'
      : authView === 'redeem-ticket'
        ? 'Use your admin ticket to set a fresh password.'
        : isSignUp
          ? 'Choose a screen name and password to create your account.'
          : 'Welcome back. Enter your screen name and password.';
  const statusClass = normalizedStatusMsg.includes('failed') || normalizedStatusMsg.includes('invalid') || normalizedStatusMsg.includes('please')
    ? 'border-rose-200/80 bg-rose-50/90 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200'
    : normalizedStatusMsg.includes('success') || normalizedStatusMsg.includes('complete') || normalizedStatusMsg.includes('copied')
      ? 'border-emerald-200/80 bg-emerald-50/90 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200'
      : 'border-slate-200/80 bg-white/88 text-slate-600 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300';
  const fieldClass =
    'ui-focus-ring min-h-[52px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[15px] font-medium text-slate-900 shadow-[inset_0_1px_2px_rgba(15,23,42,0.05)] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-300 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-100 dark:placeholder:text-slate-500';
  const secondaryActionClass =
    'ui-focus-ring inline-flex min-h-[42px] items-center rounded-2xl px-3 text-[13px] font-semibold text-blue-700 transition hover:bg-blue-50/80 hover:text-blue-800 disabled:opacity-50 dark:text-blue-300 dark:hover:bg-slate-800 dark:hover:text-blue-200';
  const authModeButtonClass = (active: boolean) =>
    `ui-focus-ring flex min-h-[46px] items-center justify-center rounded-[1.1rem] px-3 text-[13px] font-semibold transition ${
      active
        ? 'bg-blue-500 text-white shadow-[0_12px_22px_rgba(37,99,235,0.24)]'
        : 'text-slate-600 hover:bg-white/75 dark:text-slate-300 dark:hover:bg-slate-950/55'
    }`;
  const submitLabel = authView === 'forgot-password' ? 'Reset password' : authView === 'redeem-ticket' ? 'Redeem ticket' : isSignUp ? 'Create account' : 'Sign in';
  const busySubmitLabel =
    authView === 'forgot-password' ? 'Resetting...' : authView === 'redeem-ticket' ? 'Redeeming...' : isSignUp ? 'Creating...' : 'Signing in...';
  const shouldShowStatusCard = statusMsg !== baselineStatusMsg;

  return (
    <main className="relative h-[100dvh] overflow-hidden bg-[radial-gradient(circle_at_14%_14%,#dbeafe_0%,#eef5ff_34%,#f8fbff_64%,#e1ecff_100%)] dark:bg-[radial-gradient(circle_at_16%_12%,#172554_0%,#0f172a_34%,#020617_100%)]">
      <div className="pointer-events-none absolute -left-12 top-10 h-44 w-44 rounded-full bg-blue-200/45 blur-3xl dark:bg-blue-500/20" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-64 w-64 rounded-full bg-cyan-200/25 blur-3xl dark:bg-cyan-400/10" />

      <RetroWindow title="BuddyList">
        <div className="mx-auto flex min-h-full w-full max-w-md items-center pb-6 pt-2">
          <form onSubmit={handlePrimarySubmit} className="w-full space-y-4">
            <section className="rounded-[1.9rem] border border-white/65 bg-white/82 p-5 text-slate-800 shadow-[0_20px_40px_rgba(15,23,42,0.14)] backdrop-blur-2xl dark:border-slate-700/70 dark:bg-slate-900/78 dark:text-slate-100">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300">
                    <AppIcon kind="sparkle" className="h-5 w-5" />
                  </span>
                  <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-700/80 dark:text-blue-300/80">
                    BuddyList
                  </p>
                  <h1 className="mt-2 text-[31px] font-semibold tracking-[-0.04em] text-slate-900 dark:text-slate-50">
                    {authTitle}
                  </h1>
                  <p className="mt-2 max-w-[22rem] text-[14px] leading-6 text-slate-500 dark:text-slate-400">
                    {authDescription}
                  </p>
                </div>

                {(!isSignOnView || isSignUp) && (
                  <button
                    type="button"
                    onClick={returnToSignIn}
                    disabled={controlsDisabled}
                    className="ui-focus-ring inline-flex min-h-[40px] shrink-0 items-center rounded-full border border-slate-200 bg-white/85 px-3 text-[12px] font-semibold text-slate-600 transition hover:bg-white disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950/65 dark:text-slate-300 dark:hover:bg-slate-900"
                  >
                    Back
                  </button>
                )}
              </div>

              {isSignOnView ? (
                <div className="mt-5 grid grid-cols-2 gap-2 rounded-[1.4rem] border border-slate-200 bg-slate-100/85 p-1 dark:border-slate-700 dark:bg-slate-950/55">
                  <button
                    type="button"
                    onClick={returnToSignIn}
                    disabled={controlsDisabled}
                    className={authModeButtonClass(!isSignUp)}
                  >
                    Sign in
                  </button>
                  <button
                    type="button"
                    onClick={openSignUp}
                    disabled={controlsDisabled}
                    className={authModeButtonClass(isSignUp)}
                  >
                    Create account
                  </button>
                </div>
              ) : null}

              <div key={`${authView}-${isSignUp ? 'signup' : 'signin'}`} className="mt-5 space-y-4 ui-fade-in">
                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                    Screen name
                  </label>
                  <input
                    type="text"
                    value={screenname}
                    onChange={(event) => setScreenname(event.target.value)}
                    className={fieldClass}
                    placeholder="e.g. sk8erboi99"
                    disabled={isLoading}
                    autoComplete="username"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                </div>

                {isSignOnView && (
                  <div>
                    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                      Password
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className={fieldClass}
                      placeholder={isSignUp ? 'Create a password' : 'Enter password'}
                      disabled={isLoading}
                      autoComplete={isSignUp ? 'new-password' : 'current-password'}
                    />
                  </div>
                )}

                {authView === 'forgot-password' && (
                  <>
                    <div>
                      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                        Recovery code
                      </label>
                      <input
                        type="text"
                        value={recoveryCode}
                        onChange={(event) => setRecoveryCode(event.target.value)}
                        className={fieldClass}
                        placeholder="XXXXXX-XXXXXX-XXXXXX"
                        disabled={isLoading}
                        autoCapitalize="characters"
                        autoCorrect="off"
                        spellCheck={false}
                      />
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
                        placeholder="Create new password"
                        disabled={isLoading}
                        autoComplete="new-password"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                        Confirm password
                      </label>
                      <input
                        type="password"
                        value={confirmNewPassword}
                        onChange={(event) => setConfirmNewPassword(event.target.value)}
                        className={fieldClass}
                        placeholder="Confirm new password"
                        disabled={isLoading}
                        autoComplete="new-password"
                      />
                    </div>
                  </>
                )}

                {authView === 'redeem-ticket' && (
                  <>
                    <div>
                      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                        Admin ticket
                      </label>
                      <input
                        type="text"
                        value={resetTicket}
                        onChange={(event) => setResetTicket(event.target.value)}
                        className={fieldClass}
                        placeholder="TKT-XXXX-XXXX-XXXX"
                        disabled={isLoading}
                        autoCapitalize="characters"
                        autoCorrect="off"
                        spellCheck={false}
                      />
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
                        placeholder="Create new password"
                        disabled={isLoading}
                        autoComplete="new-password"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                        Confirm password
                      </label>
                      <input
                        type="password"
                        value={confirmNewPassword}
                        onChange={(event) => setConfirmNewPassword(event.target.value)}
                        className={fieldClass}
                        placeholder="Confirm new password"
                        disabled={isLoading}
                        autoComplete="new-password"
                      />
                    </div>
                  </>
                )}

                <button
                  type="submit"
                  disabled={controlsDisabled}
                  className="ui-focus-ring mt-2 min-h-[52px] w-full rounded-2xl border border-blue-500/60 bg-blue-500 px-4 py-3 text-[15px] font-semibold text-white shadow-[0_12px_24px_rgba(37,99,235,0.28)] transition hover:bg-blue-600 active:scale-[0.99] disabled:opacity-50"
                >
                  {isLoading ? busySubmitLabel : submitLabel}
                </button>

                {isSignOnView ? (
                  <div className="flex flex-wrap items-center gap-1">
                    {!isSignUp ? (
                      <>
                        <button
                          type="button"
                          onClick={() => switchAuthView('forgot-password')}
                          disabled={controlsDisabled}
                          className={secondaryActionClass}
                        >
                          Forgot password?
                        </button>
                        <button
                          type="button"
                          onClick={() => switchAuthView('redeem-ticket')}
                          disabled={controlsDisabled}
                          className={secondaryActionClass}
                        >
                          Use reset ticket
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={returnToSignIn}
                        disabled={controlsDisabled}
                        className={secondaryActionClass}
                      >
                        Already have an account?
                      </button>
                    )}
                  </div>
                ) : null}
              </div>
            </section>

            {shouldShowStatusCard ? (
              <p role="status" aria-live="polite" className={`rounded-[1.4rem] border px-4 py-3 text-[13px] font-medium leading-6 shadow-sm ${statusClass}`}>
                {statusMsg}
              </p>
            ) : null}

            {rotatedRecoveryCode && (
              <div className="rounded-[1.5rem] border border-amber-300 bg-amber-50 px-4 py-4 text-[13px] text-amber-900 shadow-sm dark:border-amber-500/35 dark:bg-amber-500/12 dark:text-amber-100">
                <p className="font-semibold">Your recovery code was rotated. Save this before you continue.</p>
                <p className="mt-2 break-all rounded-2xl bg-white/70 px-3 py-2 font-mono text-[14px] font-bold dark:bg-slate-950/60">
                  {rotatedRecoveryCode}
                </p>
                <button
                  type="button"
                  onClick={() => void copyRecoveryCode()}
                  className="ui-focus-ring mt-3 inline-flex min-h-[42px] items-center rounded-2xl border border-amber-400 bg-amber-100 px-3.5 text-[13px] font-semibold text-amber-900 transition hover:bg-amber-200 dark:border-amber-400/40 dark:bg-amber-400/20 dark:text-amber-100 dark:hover:bg-amber-400/28"
                >
                  Copy recovery code
                </button>
              </div>
            )}

          </form>
        </div>
      </RetroWindow>
    </main>
  );
}
