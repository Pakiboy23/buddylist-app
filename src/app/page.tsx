import { FormEvent, useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Capacitor } from '@capacitor/core';
import { useAppRouter } from '@/lib/appNavigation';
import AppIcon from '@/components/AppIcon';
import HimWordmark from '@/components/HimWordmark';
import RetroWindow from '@/components/RetroWindow';
import { waitForSessionOrNull } from '@/lib/authClient';
import { getSignInAuthEmailCandidates, isInvalidCredentialsError } from '@/lib/authIdentity';
import { navigateAppPath } from '@/lib/appNavigation';
import { initSoundSystem, playUiSound } from '@/lib/sound';
import { supabase } from '@/lib/supabase';

const SIGN_ON_SOUND = '/sounds/aol-welcome.mp3';
const SIGN_ON_FALLBACK_SOUND = '/sounds/aim.mp3';

// Where Supabase should send users after they click the password-reset email.
// Native (iOS/Android via Capacitor) uses the custom URL scheme registered in
// capacitor.config.ts (ios.scheme = 'HIM'). Web uses the canonical app URL
// rather than window.location.origin so reset emails sent from a Vercel
// preview still land users on production.
const APP_WEB_URL = 'https://hiitsme-app.vercel.app';
const NATIVE_RESET_PASSWORD_URL = 'HIM://reset-password';
const WEB_RESET_PASSWORD_URL = `${APP_WEB_URL}/reset-password`;

function getResetPasswordRedirectUrl(): string {
  return Capacitor.isNativePlatform() ? NATIVE_RESET_PASSWORD_URL : WEB_RESET_PASSWORD_URL;
}
type AuthView = 'sign-on' | 'forgot-password';

function subscribeToHydration() {
  return () => {};
}

export default function Home() {
  const [screenname, setScreenname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const isHydrated = useSyncExternalStore(subscribeToHydration, () => true, () => false);
  const [authView, setAuthView] = useState<AuthView>('sign-on');
  const [resetSent, setResetSent] = useState(false);
  const [statusMsg, setStatusMsg] = useState('Welcome back. Enter your screen name and password.');
  const [isLoading, setIsLoading] = useState(false);
  const hasNavigatedRef = useRef(false);
  const isCompletingSignUpProtectionRef = useRef(false);
  const router = useAppRouter();
  const controlsDisabled = isLoading || !isHydrated;

  const playSignOnSound = useCallback(async () => {
    try {
      const played = await playUiSound(SIGN_ON_SOUND, {
        volume: 0.85,
        fallbackSrc: SIGN_ON_FALLBACK_SOUND,
      });
      if (!played) return;
      await new Promise((resolve) => setTimeout(resolve, 220));
    } catch {
      // ignore playback failures
    }
  }, []);

  const routeToHiItsMe = useCallback(
    async (withSound: boolean) => {
      if (hasNavigatedRef.current) return;
      hasNavigatedRef.current = true;
      if (withSound) await playSignOnSound();
      navigateAppPath(router, '/hi-its-me');
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
      if (!isMounted || !session) return;
      await routeToHiItsMe(false);
    };
    void checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session || event !== 'SIGNED_IN') return;
      if (isCompletingSignUpProtectionRef.current) return;
      void routeToHiItsMe(true);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [routeToHiItsMe]);

  const applyViewStatusMessage = (view: AuthView, signUpMode: boolean) => {
    if (view === 'forgot-password') {
      setStatusMsg('Enter the email linked to your account and we\'ll send a reset link.');
      return;
    }
    setStatusMsg(
      signUpMode
        ? 'Choose a screen name, email, and password to create your account.'
        : 'Welcome back. Enter your screen name and password.',
    );
  };

  const switchAuthView = (nextView: AuthView) => {
    setAuthView(nextView);
    if (nextView !== 'sign-on') setIsSignUp(false);
    setResetSent(false);
    applyViewStatusMessage(nextView, isSignUp);
  };

  const openSignUp = () => {
    setAuthView('sign-on');
    setIsSignUp(true);
    setResetSent(false);
    applyViewStatusMessage('sign-on', true);
  };

  const returnToSignIn = () => {
    setAuthView('sign-on');
    setIsSignUp(false);
    setResetSent(false);
    applyViewStatusMessage('sign-on', false);
  };

  const handleSignOn = async () => {
    const trimmedScreenname = screenname.trim();
    if (!trimmedScreenname || !password) {
      setStatusMsg('Please enter your Screen Name and Password.');
      return;
    }

    if (isSignUp) {
      if (trimmedScreenname.length < 3) {
        setStatusMsg('Screen Name must be at least 3 characters.');
        return;
      }
      if (trimmedScreenname.length > 20) {
        setStatusMsg('Screen Name must be 20 characters or fewer.');
        return;
      }
      if (!/^[a-zA-Z0-9_.]+$/.test(trimmedScreenname)) {
        setStatusMsg('Screen Name can only contain letters, numbers, underscores, and dots.');
        return;
      }
      const trimmedEmail = email.trim().toLowerCase();
      if (!trimmedEmail || !trimmedEmail.includes('@')) {
        setStatusMsg('Please enter a valid email address.');
        return;
      }
    }

    setIsLoading(true);
    setStatusMsg(isSignUp ? 'Creating account...' : 'Dialing in...');

    if (isSignUp) {
      const trimmedEmail = email.trim().toLowerCase();
      isCompletingSignUpProtectionRef.current = true;

      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: { data: { screenname: trimmedScreenname } },
      });

      if (error) {
        setStatusMsg(`Connection failed: ${error.message}`);
        isCompletingSignUpProtectionRef.current = false;
        setIsLoading(false);
        return;
      }

      if (data.session) {
        await supabase.from('users').upsert(
          {
            id: data.session.user.id,
            email: trimmedEmail,
            screenname: trimmedScreenname,
            status: 'available',
            is_online: true,
            last_active_at: new Date().toISOString(),
          },
          { onConflict: 'id' },
        );
        isCompletingSignUpProtectionRef.current = false;
        setStatusMsg('Account created. Opening H.I.M....');
        await routeToHiItsMe(true);
      } else {
        isCompletingSignUpProtectionRef.current = false;
        setStatusMsg('Account created. Check your email to confirm, then sign in.');
      }

      setIsLoading(false);
      return;
    }

    // Sign in: look up email by screenname for new-style accounts first
    const { data: userData } = await supabase
      .from('users')
      .select('email')
      .eq('screenname', trimmedScreenname)
      .maybeSingle();

    if (userData?.email) {
      const { error } = await supabase.auth.signInWithPassword({
        email: userData.email,
        password,
      });
      if (!error) {
        setStatusMsg('Success! Opening H.I.M....');
        await routeToHiItsMe(true);
        setIsLoading(false);
        return;
      }
    }

    // Fall back to derived email for legacy accounts
    let signInError: Error | null = null;
    for (const authEmail of getSignInAuthEmailCandidates(trimmedScreenname)) {
      const { error } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password,
      });
      if (!error) {
        setStatusMsg('Success! Opening H.I.M....');
        await routeToHiItsMe(true);
        setIsLoading(false);
        return;
      }
      signInError = error;
      if (!isInvalidCredentialsError(error.message)) break;
    }

    if (signInError) {
      setStatusMsg(
        `Connection failed: ${isInvalidCredentialsError(signInError.message) ? 'Invalid login credentials.' : signInError.message}`,
      );
    }
    setIsLoading(false);
  };

  const handleForgotPassword = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setStatusMsg('Please enter the email address linked to your account.');
      return;
    }

    setIsLoading(true);
    setStatusMsg('Sending reset link...');

    const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
      redirectTo: getResetPasswordRedirectUrl(),
    });

    if (error) {
      setStatusMsg(`Reset failed: ${error.message}`);
      setIsLoading(false);
      return;
    }

    setResetSent(true);
    setStatusMsg('Check your email for a password reset link.');
    setIsLoading(false);
  };

  const handlePrimarySubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (authView === 'forgot-password') {
      await handleForgotPassword();
      return;
    }
    await handleSignOn();
  };

  const normalizedStatusMsg = statusMsg.toLowerCase();
  const isSignOnView = authView === 'sign-on';
  const authTitle =
    authView === 'forgot-password'
      ? 'Reset password'
      : isSignUp
        ? 'Create account'
        : 'Sign in';
  const authDescription =
    authView === 'forgot-password'
      ? 'We\'ll send a reset link to your email.'
      : isSignUp
        ? 'Create your screen name, email, and password.'
        : 'Sign in with your screen name and password.';
  const baselineStatusMsg =
    authView === 'forgot-password'
      ? 'Enter the email linked to your account and we\'ll send a reset link.'
      : isSignUp
        ? 'Choose a screen name, email, and password to create your account.'
        : 'Welcome back. Enter your screen name and password.';
  const statusClass =
    normalizedStatusMsg.includes('failed') || normalizedStatusMsg.includes('invalid') || normalizedStatusMsg.includes('please')
      ? 'border-rose-200/80 bg-rose-50/90 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200'
      : normalizedStatusMsg.includes('success') || normalizedStatusMsg.includes('complete') || normalizedStatusMsg.includes('copied') || normalizedStatusMsg.includes('check your email')
        ? 'border-emerald-200/80 bg-emerald-50/90 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200'
        : 'border-slate-200/80 bg-white/88 text-slate-600 dark:border-slate-700 dark:bg-[#13100E]/70 dark:text-slate-300';
  const fieldClass =
    'ui-focus-ring ui-auth-field min-h-[52px] w-full rounded-2xl px-4 py-3 text-[15px] font-medium';
  const secondaryActionClass =
    'ui-focus-ring ui-auth-secondary inline-flex min-h-[42px] items-center rounded-2xl px-3 text-[13px] font-semibold transition disabled:opacity-50';
  const authModeButtonClass = (active: boolean) =>
    `ui-focus-ring ui-auth-mode flex min-h-[46px] items-center justify-center rounded-[1.1rem] px-3 text-[13px] font-semibold transition ${active ? '' : 'hover:bg-white/5'}`;
  const submitLabel =
    authView === 'forgot-password' ? 'Send reset link' : isSignUp ? 'Create account' : 'Sign in';
  const busySubmitLabel =
    authView === 'forgot-password' ? 'Sending...' : isSignUp ? 'Creating...' : 'Signing in...';
  const shouldShowStatusCard = statusMsg !== baselineStatusMsg;

  return (
    <main className="ui-auth-shell relative h-[100dvh] overflow-hidden">
      <div className="ui-auth-orb--rose pointer-events-none absolute -left-12 top-10 h-44 w-44 rounded-full blur-3xl" />
      <div className="ui-auth-orb--gold pointer-events-none absolute bottom-0 right-0 h-64 w-64 rounded-full blur-3xl" />

      <RetroWindow title="H.I.M.">
        <div className="mx-auto flex min-h-full w-full max-w-md items-center pb-6 pt-2">
          <form onSubmit={handlePrimarySubmit} className="w-full space-y-4">
            <section className="ui-auth-card rounded-[1.9rem] p-5 backdrop-blur-2xl">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <span className="ui-brand-sparkle inline-flex h-11 w-11 items-center justify-center rounded-2xl">
                    <AppIcon kind="sparkle" className="h-5 w-5" />
                  </span>
                  <HimWordmark className="mt-4 text-[13px]" />
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
                    className="ui-focus-ring ui-auth-back inline-flex min-h-[40px] shrink-0 items-center rounded-full px-3 text-[12px] font-semibold transition disabled:opacity-50"
                  >
                    Back
                  </button>
                )}
              </div>

              {isSignOnView ? (
                <div className="mt-5 grid grid-cols-2 gap-2 rounded-[1.4rem] border border-white/8 bg-[rgba(19,16,14,0.72)] p-1">
                  <button
                    type="button"
                    onClick={returnToSignIn}
                    disabled={controlsDisabled}
                    className={authModeButtonClass(!isSignUp)}
                    data-active={!isSignUp ? 'true' : 'false'}
                  >
                    Sign in
                  </button>
                  <button
                    type="button"
                    onClick={openSignUp}
                    disabled={controlsDisabled}
                    className={authModeButtonClass(isSignUp)}
                    data-active={isSignUp ? 'true' : 'false'}
                  >
                    Create account
                  </button>
                </div>
              ) : null}

              <div key={`${authView}-${isSignUp ? 'signup' : 'signin'}`} className="mt-5 space-y-4 ui-fade-in">

                {/* Forgot password: email only */}
                {authView === 'forgot-password' ? (
                  resetSent ? (
                    <div className="flex flex-col items-center gap-3 py-4 text-center">
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/30">
                        <AppIcon kind="mail" className="h-7 w-7 text-emerald-500" />
                      </div>
                      <p className="text-[15px] font-semibold text-slate-800 dark:text-slate-100">Check your email</p>
                      <p className="text-[13px] leading-5 text-slate-500 dark:text-slate-400">
                        We sent a reset link to <strong>{email.trim().toLowerCase()}</strong>. Follow the link to set a new password.
                      </p>
                      <button
                        type="button"
                        onClick={returnToSignIn}
                        className={secondaryActionClass}
                      >
                        Back to sign in
                      </button>
                    </div>
                  ) : (
                    <div>
                      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                        Email address
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        className={fieldClass}
                        placeholder="your@email.com"
                        disabled={isLoading}
                        autoComplete="email"
                        autoCapitalize="none"
                        autoCorrect="off"
                      />
                    </div>
                  )
                ) : (
                  <>
                    {/* Screen name — shown for sign in and sign up */}
                    <div>
                      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                        Screen name
                      </label>
                      <input
                        type="text"
                        value={screenname}
                        onChange={(event) => setScreenname(event.target.value)}
                        className={`${fieldClass} ui-screenname`}
                        placeholder="e.g. sk8erboi99"
                        disabled={isLoading}
                        autoComplete="username"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                      />
                    </div>

                    {/* Email — sign up only */}
                    {isSignUp && (
                      <div>
                        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                          Email address
                        </label>
                        <input
                          type="email"
                          value={email}
                          onChange={(event) => setEmail(event.target.value)}
                          className={fieldClass}
                          placeholder="your@email.com"
                          disabled={isLoading}
                          autoComplete="email"
                          autoCapitalize="none"
                          autoCorrect="off"
                        />
                      </div>
                    )}

                    {/* Password */}
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
                  </>
                )}

                {!resetSent && (
                  <button
                    type="submit"
                    disabled={controlsDisabled}
                    className="ui-focus-ring ui-auth-submit mt-2 min-h-[52px] w-full rounded-2xl px-4 py-3 text-[15px] font-semibold transition active:scale-[0.99] disabled:opacity-50"
                  >
                    {isLoading ? busySubmitLabel : submitLabel}
                  </button>
                )}

                {isSignOnView ? (
                  <div className="flex flex-wrap items-center gap-1">
                    {!isSignUp ? (
                      <button
                        type="button"
                        onClick={() => switchAuthView('forgot-password')}
                        disabled={controlsDisabled}
                        className={secondaryActionClass}
                      >
                        Forgot password?
                      </button>
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

            {shouldShowStatusCard && !resetSent ? (
              <p role="status" aria-live="polite" className={`rounded-[1.4rem] border px-4 py-3 text-[13px] font-medium leading-6 shadow-sm ${statusClass}`}>
                {statusMsg}
              </p>
            ) : null}

          </form>
        </div>
      </RetroWindow>
    </main>
  );
}
