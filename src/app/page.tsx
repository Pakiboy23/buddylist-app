'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import RetroWindow from '@/components/RetroWindow';
import { getSessionOrNull } from '@/lib/authClient';
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

export default function Home() {
  const [screenname, setScreenname] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authView, setAuthView] = useState<AuthView>('sign-on');
  const [savePassword, setSavePassword] = useState(true);
  const [autoLogin, setAutoLogin] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState('');
  const [resetTicket, setResetTicket] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [rotatedRecoveryCode, setRotatedRecoveryCode] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState('Welcome to BuddyList. Enter your Screen Name and Password.');
  const [isLoading, setIsLoading] = useState(false);
  const hasNavigatedRef = useRef(false);
  const router = useRouter();

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
      router.push('/buddy-list');
    },
    [playSignOnSound, router],
  );

  useEffect(() => {
    initSoundSystem();
  }, []);

  useEffect(() => {
    let isMounted = true;

    const checkSession = async () => {
      const session = await getSessionOrNull();

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
      setStatusMsg('Forgot your password? Enter your recovery code to reset.');
      return;
    }

    if (view === 'redeem-ticket') {
      setStatusMsg('Have an admin reset ticket? Redeem it here.');
      return;
    }

    setStatusMsg(
      signUpMode
        ? 'Get a Screen Name by choosing one and creating a password.'
        : 'Welcome back. Enter your Screen Name and Password.',
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

  const toggleMode = () => {
    setIsSignUp((previous) => {
      const nextMode = !previous;
      applyViewStatusMessage(authView, nextMode);
      return nextMode;
    });
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

    const response = await fetch('/api/auth/recovery/reset', {
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

    const response = await fetch('/api/auth/recovery/redeem-ticket', {
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

  return (
    <main className="relative h-[100dvh] overflow-hidden bg-[radial-gradient(circle_at_10%_15%,#c5ddff_0%,#eaf2ff_34%,#f6f9ff_62%,#dce9ff_100%)]">
      <div className="pointer-events-none absolute -left-14 top-8 h-44 w-44 rounded-full bg-blue-200/45 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 right-10 h-60 w-60 rounded-full bg-cyan-200/40 blur-3xl" />

      <RetroWindow title="BuddyList — Secure Access">
        <form
          onSubmit={handlePrimarySubmit}
          className="mx-auto flex w-full max-w-3xl flex-col gap-4 pb-6 text-[13px] font-sans text-blue-900"
        >
          <div className="rounded-[1.4rem] border border-white/65 bg-white/75 px-4 py-3 shadow-[0_16px_34px_rgba(15,23,42,0.13)] backdrop-blur-lg">
            <p className="text-[15px] font-semibold tracking-[0.02em] text-slate-800">BuddyList Access</p>
            <p className="mt-1 text-[12px] font-semibold text-blue-700/90">
              Secure sign-on, recovery code reset, and admin ticket redemption in one place.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 rounded-2xl border border-white/60 bg-white/65 p-2 backdrop-blur-md">
            <button
              type="button"
              onClick={() => switchAuthView('sign-on')}
              disabled={isLoading}
              className={`min-h-[42px] cursor-pointer rounded-lg border px-2 py-2 text-[11px] font-black tracking-wide transition disabled:opacity-50 ${
                authView === 'sign-on'
                  ? 'border-blue-700 bg-gradient-to-b from-blue-300 to-blue-700 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]'
                  : 'border-blue-200 bg-white text-blue-700 hover:bg-blue-50'
              }`}
            >
              Sign On
            </button>
            <button
              type="button"
              onClick={() => switchAuthView('forgot-password')}
              disabled={isLoading}
              className={`min-h-[42px] cursor-pointer rounded-lg border px-2 py-2 text-[11px] font-black tracking-wide transition disabled:opacity-50 ${
                authView === 'forgot-password'
                  ? 'border-blue-700 bg-gradient-to-b from-blue-300 to-blue-700 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]'
                  : 'border-blue-200 bg-white text-blue-700 hover:bg-blue-50'
              }`}
            >
              Recovery Code
            </button>
            <button
              type="button"
              onClick={() => switchAuthView('redeem-ticket')}
              disabled={isLoading}
              className={`min-h-[42px] cursor-pointer rounded-lg border px-2 py-2 text-[11px] font-black tracking-wide transition disabled:opacity-50 ${
                authView === 'redeem-ticket'
                  ? 'border-blue-700 bg-gradient-to-b from-blue-300 to-blue-700 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]'
                  : 'border-blue-200 bg-white text-blue-700 hover:bg-blue-50'
              }`}
            >
              Redeem Ticket
            </button>
          </div>

          <div className="grid gap-3 rounded-[1.5rem] border border-white/65 bg-white/72 p-4 shadow-[0_18px_34px_rgba(15,23,42,0.14)] backdrop-blur-xl lg:grid-cols-[170px_1fr]">
            <aside className="flex flex-col justify-between rounded-lg border border-blue-200 bg-white/75 backdrop-blur-sm px-3 py-3">
              <div>
                <span className="text-[35px] leading-none">✦</span>
                <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-700">Premium UI</p>
              </div>
              <div className="mt-5 rounded-md border border-blue-200 bg-white/70 px-2 py-2 text-[11px] font-semibold text-blue-800">
                <p>{authView === 'sign-on' ? (isSignUp ? 'Create mode' : 'Sign-on mode') : 'Recovery mode'}</p>
                <p className="mt-1 text-blue-700/90">{isLoading ? 'Contacting server...' : 'Ready'}</p>
              </div>
            </aside>

            <div className="space-y-2.5">
              <div>
                <label className="mb-1 block text-[11px] font-black uppercase tracking-[0.1em] text-blue-800">
                  Screen Name
                </label>
                <input
                  type="text"
                  value={screenname}
                  onChange={(e) => setScreenname(e.target.value)}
                  className="min-h-[46px] w-full rounded-lg border border-blue-300 bg-white px-3 py-2 text-[14px] font-semibold shadow-[inset_0_1px_3px_rgba(37,99,235,0.16)] focus:outline-none focus:ring-2 focus:ring-blue-300"
                  placeholder="e.g. sk8erboi99"
                  disabled={isLoading}
                  autoComplete="username"
                />
              </div>

              {authView === 'sign-on' && (
                <>
                  <div>
                    <label className="mb-1 block text-[11px] font-black uppercase tracking-[0.1em] text-blue-800">
                      Password
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="min-h-[46px] w-full rounded-lg border border-blue-300 bg-white px-3 py-2 text-[14px] font-semibold shadow-[inset_0_1px_3px_rgba(37,99,235,0.16)] focus:outline-none focus:ring-2 focus:ring-blue-300"
                      placeholder="Enter password"
                      disabled={isLoading}
                      autoComplete={isSignUp ? 'new-password' : 'current-password'}
                    />
                  </div>

                  <div className="grid gap-1.5 rounded-lg border border-blue-100 bg-blue-50/80 px-3 py-2">
                    <label className="flex items-center gap-2 text-[12px] font-bold text-blue-800">
                      <input
                        type="checkbox"
                        checked={savePassword}
                        onChange={(e) => setSavePassword(e.target.checked)}
                        disabled={isLoading}
                        className="h-4 w-4 rounded border border-blue-300 bg-white checked:bg-blue-600 disabled:opacity-60"
                      />
                      Save password
                    </label>
                    <label className="flex items-center gap-2 text-[12px] font-bold text-blue-800">
                      <input
                        type="checkbox"
                        checked={autoLogin}
                        onChange={(e) => setAutoLogin(e.target.checked)}
                        disabled={isLoading}
                        className="h-4 w-4 rounded border border-blue-300 bg-white checked:bg-blue-600 disabled:opacity-60"
                      />
                      Auto-login
                    </label>
                  </div>
                </>
              )}

              {authView === 'forgot-password' && (
                <>
                  <div>
                    <label className="mb-1 block text-[11px] font-black uppercase tracking-[0.1em] text-blue-800">
                      Recovery Code
                    </label>
                    <input
                      type="text"
                      value={recoveryCode}
                      onChange={(e) => setRecoveryCode(e.target.value)}
                      className="min-h-[46px] w-full rounded-lg border border-blue-300 bg-white px-3 py-2 text-[14px] font-semibold shadow-[inset_0_1px_3px_rgba(37,99,235,0.16)] focus:outline-none focus:ring-2 focus:ring-blue-300"
                      placeholder="XXXXXX-XXXXXX-XXXXXX"
                      disabled={isLoading}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-black uppercase tracking-[0.1em] text-blue-800">
                      New Password
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="min-h-[46px] w-full rounded-lg border border-blue-300 bg-white px-3 py-2 text-[14px] font-semibold shadow-[inset_0_1px_3px_rgba(37,99,235,0.16)] focus:outline-none focus:ring-2 focus:ring-blue-300"
                      placeholder="Create new password"
                      disabled={isLoading}
                      autoComplete="new-password"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-black uppercase tracking-[0.1em] text-blue-800">
                      Confirm Password
                    </label>
                    <input
                      type="password"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      className="min-h-[46px] w-full rounded-lg border border-blue-300 bg-white px-3 py-2 text-[14px] font-semibold shadow-[inset_0_1px_3px_rgba(37,99,235,0.16)] focus:outline-none focus:ring-2 focus:ring-blue-300"
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
                    <label className="mb-1 block text-[11px] font-black uppercase tracking-[0.1em] text-blue-800">
                      Admin Ticket
                    </label>
                    <input
                      type="text"
                      value={resetTicket}
                      onChange={(e) => setResetTicket(e.target.value)}
                      className="min-h-[46px] w-full rounded-lg border border-blue-300 bg-white px-3 py-2 text-[14px] font-semibold shadow-[inset_0_1px_3px_rgba(37,99,235,0.16)] focus:outline-none focus:ring-2 focus:ring-blue-300"
                      placeholder="TKT-XXXX-XXXX-XXXX"
                      disabled={isLoading}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-black uppercase tracking-[0.1em] text-blue-800">
                      New Password
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="min-h-[46px] w-full rounded-lg border border-blue-300 bg-white px-3 py-2 text-[14px] font-semibold shadow-[inset_0_1px_3px_rgba(37,99,235,0.16)] focus:outline-none focus:ring-2 focus:ring-blue-300"
                      placeholder="Create new password"
                      disabled={isLoading}
                      autoComplete="new-password"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-black uppercase tracking-[0.1em] text-blue-800">
                      Confirm Password
                    </label>
                    <input
                      type="password"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      className="min-h-[46px] w-full rounded-lg border border-blue-300 bg-white px-3 py-2 text-[14px] font-semibold shadow-[inset_0_1px_3px_rgba(37,99,235,0.16)] focus:outline-none focus:ring-2 focus:ring-blue-300"
                      placeholder="Confirm new password"
                      disabled={isLoading}
                      autoComplete="new-password"
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          <p className="min-h-[48px] rounded-lg border border-blue-200 bg-white/95 px-3 py-2 text-[12px] font-bold leading-snug text-blue-700">
            {statusMsg}
          </p>

          {rotatedRecoveryCode && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
              <p className="font-bold">Your recovery code has been rotated. Save this now:</p>
              <p className="mt-1 break-all font-mono text-[13px] font-bold">{rotatedRecoveryCode}</p>
              <button
                type="button"
                onClick={() => void copyRecoveryCode()}
                className="mt-2 min-h-[38px] rounded-lg border border-amber-500 bg-gradient-to-b from-amber-100 to-amber-300 px-3 py-1 text-xs font-semibold text-amber-900"
              >
                Copy recovery code
              </button>
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-blue-700/80">
              {authView === 'sign-on' ? (isSignUp ? 'Create account flow' : 'Existing account flow') : 'Password recovery flow'}
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="min-h-[46px] min-w-[170px] cursor-pointer rounded-lg border border-blue-600 bg-gradient-to-b from-blue-200 via-blue-300 to-blue-600 px-4 py-2 text-sm font-black text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] transition hover:from-blue-300 hover:to-blue-700 disabled:opacity-50"
            >
              {isLoading
                ? authView === 'forgot-password'
                  ? 'Resetting...'
                  : authView === 'redeem-ticket'
                    ? 'Redeeming...'
                    : isSignUp
                      ? 'Creating...'
                      : 'Signing On...'
                : authView === 'forgot-password'
                  ? 'Reset Password'
                  : authView === 'redeem-ticket'
                    ? 'Redeem Ticket'
                    : isSignUp
                      ? 'Get a Screen Name'
                      : 'Sign On'}
            </button>
          </div>

          {authView === 'sign-on' ? (
            <div className="grid gap-1.5 rounded-lg border border-blue-100 bg-white/65 p-2">
              <button
                type="button"
                onClick={toggleMode}
                disabled={isLoading}
                className="min-h-[40px] cursor-pointer rounded px-2 text-left text-[12px] font-bold text-blue-700 underline underline-offset-2 hover:bg-blue-50 disabled:opacity-50"
              >
                {isSignUp ? 'Already have a screen name? Sign On.' : "Don't have a screen name? Get one here."}
              </button>
              <button
                type="button"
                onClick={() => switchAuthView('forgot-password')}
                disabled={isLoading}
                className="min-h-[40px] cursor-pointer rounded px-2 text-left text-[12px] font-bold text-blue-700 underline underline-offset-2 hover:bg-blue-50 disabled:opacity-50"
              >
                Forgot password? Use Recovery Code.
              </button>
              <button
                type="button"
                onClick={() => switchAuthView('redeem-ticket')}
                disabled={isLoading}
                className="min-h-[40px] cursor-pointer rounded px-2 text-left text-[12px] font-bold text-blue-700 underline underline-offset-2 hover:bg-blue-50 disabled:opacity-50"
              >
                Have an admin reset ticket?
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => switchAuthView('sign-on')}
              disabled={isLoading}
              className="min-h-[42px] w-fit cursor-pointer rounded-lg border border-blue-200 bg-white px-3 text-left text-[12px] font-bold text-blue-700 underline underline-offset-2 hover:bg-blue-50 disabled:opacity-50"
            >
              Back to Sign On
            </button>
          )}
        </form>
      </RetroWindow>
    </main>
  );
}
