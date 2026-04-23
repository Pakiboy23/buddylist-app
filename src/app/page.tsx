import { FormEvent, useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useAppRouter } from '@/lib/appNavigation';
import AppIcon from '@/components/AppIcon';
import HimWordmark from '@/components/HimWordmark';
import RetroWindow from '@/components/RetroWindow';
import { waitForSessionOrNull } from '@/lib/authClient';
import { getPrimaryAuthEmail, getSignInAuthEmailCandidates, isInvalidCredentialsError } from '@/lib/authIdentity';
import { getAppApiUrl } from '@/lib/appApi';
import { navigateAppPath } from '@/lib/appNavigation';
import { generateClientRecoveryCode, RECOVERY_CODE_MIN_LENGTH } from '@/lib/recoveryCode';
import {
  clearPendingSignupRecoveryDraft,
  savePendingSignupRecoveryDraft,
} from '@/lib/signupRecoveryDraft';
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
  const [signUpRecoveryCode, setSignUpRecoveryCode] = useState('');
  const [signUpRecoveryCodeConfirm, setSignUpRecoveryCodeConfirm] = useState('');
  const [resetTicket, setResetTicket] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [rotatedRecoveryCode, setRotatedRecoveryCode] = useState<string | null>(null);
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
      if (!played) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 220));
    } catch {
      // Ignore playback failures.
    }
  }, []);

  const routeToHiItsMe = useCallback(
    async (withSound: boolean) => {
      if (hasNavigatedRef.current) {
        return;
      }

      hasNavigatedRef.current = true;
      if (withSound) {
        await playSignOnSound();
      }
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

      if (!isMounted || !session) {
        return;
      }

      await routeToHiItsMe(false);
    };
    void checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session || event !== 'SIGNED_IN') {
        return;
      }

      if (isCompletingSignUpProtectionRef.current) {
        return;
      }

      void routeToHiItsMe(true);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [routeToHiItsMe]);

  const applyViewStatusMessage = (view: AuthView, signUpMode: boolean) => {
    if (view === 'forgot-password') {
      setStatusMsg('Enter your recovery code and choose a new password.');
      return;
    }

    if (view === 'redeem-ticket') {
      setStatusMsg('Use your admin ticket to set a fresh password.');
      return;
    }

    setStatusMsg(
      signUpMode
        ? 'Choose a screen name, password, and secret recovery code to create your account.'
        : 'Welcome back. Enter your screen name and password.',
    );
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

  const resetSignUpRecoveryFields = () => {
    setSignUpRecoveryCode('');
    setSignUpRecoveryCodeConfirm('');
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
    resetSignUpRecoveryFields();
    applyViewStatusMessage('sign-on', false);
  };

  const readApiError = async (response: Response) => {
    try {
      const data = (await response.json()) as ApiErrorResponse;
      return data.error ?? 'Request failed.';
    } catch {
      return 'Request failed.';
    }
  };

  const saveRecoveryCodeWithToken = async (accessToken: string, recoverySecret: string) => {
    const response = await fetch(getAppApiUrl('/api/auth/recovery/setup'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ recoveryCode: recoverySecret }),
    });

    if (!response.ok) {
      throw new Error(await readApiError(response));
    }
  };

  const validateSignUpRecoveryCode = () => {
    const trimmed = signUpRecoveryCode.trim();
    const confirm = signUpRecoveryCodeConfirm.trim();

    if (!trimmed || !confirm) {
      return 'Create and confirm your secret recovery code.';
    }

    if (trimmed !== confirm) {
      return 'Recovery code entries do not match.';
    }

    if (trimmed.length < RECOVERY_CODE_MIN_LENGTH) {
      return `Recovery code must be at least ${RECOVERY_CODE_MIN_LENGTH} characters.`;
    }

    return null;
  };

  const handleGenerateSignUpRecoveryCode = async () => {
    const generated = generateClientRecoveryCode();
    setSignUpRecoveryCode(generated);
    setSignUpRecoveryCodeConfirm(generated);

    try {
      await navigator.clipboard.writeText(generated);
      setStatusMsg('Secure recovery code generated and copied. Save it somewhere safe.');
    } catch {
      setStatusMsg('Secure recovery code generated. Save it somewhere safe.');
    }
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
      const recoveryValidationError = validateSignUpRecoveryCode();
      if (recoveryValidationError) {
        setStatusMsg(recoveryValidationError);
        return;
      }
    }

    const authEmail = getPrimaryAuthEmail(trimmedScreenname);
    setIsLoading(true);
    setStatusMsg(isSignUp ? 'Creating account...' : 'Dialing in...');

    if (isSignUp) {
      isCompletingSignUpProtectionRef.current = true;
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
        isCompletingSignUpProtectionRef.current = false;
        setIsLoading(false);
        return;
      }

      if (data.session) {
        setStatusMsg('Account created. Securing your account...');
        try {
          // Seed public.users before saving the recovery code — the FK on
          // account_recovery_codes requires this row to exist first.
          await supabase.from('users').upsert(
            {
              id: data.session.user.id,
              email: data.session.user.email ?? '',
              screenname: trimmedScreenname,
              status: 'available',
              is_online: true,
              last_active_at: new Date().toISOString(),
            },
            { onConflict: 'id' },
          );
          await saveRecoveryCodeWithToken(data.session.access_token, signUpRecoveryCode.trim());
          clearPendingSignupRecoveryDraft(trimmedScreenname);
        } catch (error) {
          await supabase.auth.signOut();
          isCompletingSignUpProtectionRef.current = false;
          setIsSignUp(false);
          setPassword('');
          setStatusMsg(
            `Account created, but protection setup needs one more try: ${error instanceof Error ? error.message : 'Save failed.'}`,
          );
          setIsLoading(false);
          return;
        }

        resetSignUpRecoveryFields();
        isCompletingSignUpProtectionRef.current = false;
        setStatusMsg('Account created. Opening H.I.M....');
        await routeToHiItsMe(true);
      } else {
        savePendingSignupRecoveryDraft(trimmedScreenname, signUpRecoveryCode.trim());
        isCompletingSignUpProtectionRef.current = false;
        setStatusMsg('Account created. Check your email to confirm, then sign in here to finish saving your recovery code.');
      }

      setIsLoading(false);
      return;
    }

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
      if (!isInvalidCredentialsError(error.message)) {
        break;
      }
    }

    if (signInError) {
      setStatusMsg(`Connection failed: ${isInvalidCredentialsError(signInError.message) ? 'Invalid login credentials.' : signInError.message}`);
      setIsLoading(false);
      return;
    }
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
          ? 'Create your screen name, password, and private recovery code.'
          : 'Sign in with your screen name and password.';
  const baselineStatusMsg =
    authView === 'forgot-password'
      ? 'Enter your recovery code and choose a new password.'
      : authView === 'redeem-ticket'
        ? 'Use your admin ticket to set a fresh password.'
        : isSignUp
          ? 'Choose a screen name, password, and secret recovery code to create your account.'
          : 'Welcome back. Enter your screen name and password.';
  const statusClass = normalizedStatusMsg.includes('failed') || normalizedStatusMsg.includes('invalid') || normalizedStatusMsg.includes('please')
    ? 'border-rose-200/80 bg-rose-50/90 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200'
    : normalizedStatusMsg.includes('success') || normalizedStatusMsg.includes('complete') || normalizedStatusMsg.includes('copied')
      ? 'border-emerald-200/80 bg-emerald-50/90 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200'
      : 'border-slate-200/80 bg-white/88 text-slate-600 dark:border-slate-700 dark:bg-[#13100E]/70 dark:text-slate-300';
  const fieldClass =
    'ui-focus-ring ui-auth-field min-h-[52px] w-full rounded-2xl px-4 py-3 text-[15px] font-medium';
  const secondaryActionClass =
    'ui-focus-ring ui-auth-secondary inline-flex min-h-[42px] items-center rounded-2xl px-3 text-[13px] font-semibold transition disabled:opacity-50';
  const authModeButtonClass = (active: boolean) =>
    `ui-focus-ring ui-auth-mode flex min-h-[46px] items-center justify-center rounded-[1.1rem] px-3 text-[13px] font-semibold transition ${active ? '' : 'hover:bg-white/5'}`;
  const submitLabel = authView === 'forgot-password' ? 'Reset password' : authView === 'redeem-ticket' ? 'Redeem ticket' : isSignUp ? 'Create account' : 'Sign in';
  const busySubmitLabel =
    authView === 'forgot-password' ? 'Resetting...' : authView === 'redeem-ticket' ? 'Redeeming...' : isSignUp ? 'Creating...' : 'Signing in...';
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

                {isSignOnView && isSignUp && (
                  <div className="ui-auth-recovery rounded-[1.55rem] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--gold)]">
                          Account Protection
                        </p>
                        <p className="mt-2 text-[13px] leading-5 text-slate-600 dark:text-slate-300">
                          Create a secret recovery code now so you can reset your password later without admin help.
                        </p>
                      </div>
                        <button
                          type="button"
                          onClick={() => void handleGenerateSignUpRecoveryCode()}
                          disabled={controlsDisabled}
                          className="ui-focus-ring ui-auth-back inline-flex min-h-[38px] shrink-0 items-center rounded-full px-3 text-[12px] font-semibold transition disabled:opacity-50"
                        >
                          Generate
                      </button>
                    </div>

                    <div className="mt-4 space-y-4">
                      <div>
                        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                          Secret recovery code
                        </label>
                        <input
                          type="text"
                          value={signUpRecoveryCode}
                          onChange={(event) => setSignUpRecoveryCode(event.target.value)}
                          className={fieldClass}
                          placeholder="MY-PRIVATE-CODE-2026"
                          disabled={isLoading}
                          autoCapitalize="characters"
                          autoCorrect="off"
                          spellCheck={false}
                          minLength={RECOVERY_CODE_MIN_LENGTH}
                        />
                      </div>

                      <div>
                        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                          Confirm recovery code
                        </label>
                        <input
                          type="text"
                          value={signUpRecoveryCodeConfirm}
                          onChange={(event) => setSignUpRecoveryCodeConfirm(event.target.value)}
                          className={fieldClass}
                          placeholder="Repeat your code"
                          disabled={isLoading}
                          autoCapitalize="characters"
                          autoCorrect="off"
                          spellCheck={false}
                          minLength={RECOVERY_CODE_MIN_LENGTH}
                        />
                      </div>
                    </div>

                    <p className="mt-3 text-[12px] leading-5 text-slate-500 dark:text-slate-400">
                      Only a secure hash is stored. If you generate one here, copy it somewhere safe before continuing.
                    </p>
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
                  className="ui-focus-ring ui-auth-submit mt-2 min-h-[52px] w-full rounded-2xl px-4 py-3 text-[15px] font-semibold transition active:scale-[0.99] disabled:opacity-50"
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
                <p className="mt-2 break-all rounded-2xl bg-white/70 px-3 py-2 font-mono text-[14px] font-bold dark:bg-[#13100E]/60">
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
