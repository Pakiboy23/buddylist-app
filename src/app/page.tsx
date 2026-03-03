'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import RetroWindow from '@/components/RetroWindow';
import { getSessionOrNull } from '@/lib/authClient';
import { supabase } from '@/lib/supabase';

const SIGN_ON_SOUND = '/signon.wav';
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
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const audio = new Audio(SIGN_ON_SOUND);
      audio.preload = 'auto';
      await audio.play();
      await new Promise((resolve) => setTimeout(resolve, 220));
    } catch {
      // Ignore playback failures (missing file, autoplay rules, etc.).
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
    <main className="h-[100dvh] overflow-hidden">
      <RetroWindow title="AOL Instant Messenger - Sign On">
        <form onSubmit={handlePrimarySubmit} className="mx-auto w-full max-w-md space-y-4 pb-6 text-[13px] font-sans">
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => switchAuthView('sign-on')}
              disabled={isLoading}
              className={`min-h-[40px] cursor-pointer rounded-md border px-2 py-2 text-[11px] font-bold transition disabled:opacity-50 ${
                authView === 'sign-on'
                  ? 'border-blue-600 bg-gradient-to-b from-blue-300 to-blue-600 text-white'
                  : 'border-blue-300 bg-white text-blue-700 hover:bg-blue-50'
              }`}
            >
              Sign On
            </button>
            <button
              type="button"
              onClick={() => switchAuthView('forgot-password')}
              disabled={isLoading}
              className={`min-h-[40px] cursor-pointer rounded-md border px-2 py-2 text-[11px] font-bold transition disabled:opacity-50 ${
                authView === 'forgot-password'
                  ? 'border-blue-600 bg-gradient-to-b from-blue-300 to-blue-600 text-white'
                  : 'border-blue-300 bg-white text-blue-700 hover:bg-blue-50'
              }`}
            >
              Recovery Code
            </button>
            <button
              type="button"
              onClick={() => switchAuthView('redeem-ticket')}
              disabled={isLoading}
              className={`min-h-[40px] cursor-pointer rounded-md border px-2 py-2 text-[11px] font-bold transition disabled:opacity-50 ${
                authView === 'redeem-ticket'
                  ? 'border-blue-600 bg-gradient-to-b from-blue-300 to-blue-600 text-white'
                  : 'border-blue-300 bg-white text-blue-700 hover:bg-blue-50'
              }`}
            >
              Redeem Ticket
            </button>
          </div>

          <div className="grid grid-cols-[92px_1fr] gap-3">
            <div className="flex flex-col items-center justify-between rounded-md border border-blue-200 bg-[#f2e7ab] px-2 py-2">
              <span className="text-[34px] leading-none">🏃</span>
              <p className="text-[11px] font-bold tracking-wide text-[#0d4da3]">AIM</p>
            </div>

            <div className="space-y-2">
              <div>
                <label className="mb-1 block text-[12px] font-bold uppercase tracking-wide">Screen Name</label>
                <input
                  type="text"
                  value={screenname}
                  onChange={(e) => setScreenname(e.target.value)}
                  className="min-h-[44px] w-full rounded-md border border-blue-300 bg-white px-3 py-2 text-sm shadow-[inset_0_1px_3px_rgba(37,99,235,0.18)] focus:outline-none"
                  placeholder="e.g. sk8erboi99"
                  disabled={isLoading}
                  autoComplete="username"
                />
              </div>

              {authView === 'sign-on' && (
                <>
                  <div>
                    <label className="mb-1 block text-[12px] font-bold uppercase tracking-wide">Password</label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="min-h-[44px] w-full rounded-md border border-blue-300 bg-white px-3 py-2 text-sm shadow-[inset_0_1px_3px_rgba(37,99,235,0.18)] focus:outline-none"
                      placeholder="Enter password"
                      disabled={isLoading}
                      autoComplete={isSignUp ? 'new-password' : 'current-password'}
                    />
                  </div>

                  <div className="space-y-1 pt-1">
                    <label className="flex items-center gap-2 text-[12px] font-semibold">
                      <input
                        type="checkbox"
                        checked={savePassword}
                        onChange={(e) => setSavePassword(e.target.checked)}
                        disabled={isLoading}
                        className="h-5 w-5 rounded border border-blue-300 bg-white checked:bg-blue-600 disabled:opacity-60"
                      />
                      Save password
                    </label>
                    <label className="flex items-center gap-2 text-[12px] font-semibold">
                      <input
                        type="checkbox"
                        checked={autoLogin}
                        onChange={(e) => setAutoLogin(e.target.checked)}
                        disabled={isLoading}
                        className="h-5 w-5 rounded border border-blue-300 bg-white checked:bg-blue-600 disabled:opacity-60"
                      />
                      Auto-login
                    </label>
                  </div>
                </>
              )}

              {authView === 'forgot-password' && (
                <>
                  <div>
                    <label className="mb-1 block text-[12px] font-bold uppercase tracking-wide">Recovery Code</label>
                    <input
                      type="text"
                      value={recoveryCode}
                      onChange={(e) => setRecoveryCode(e.target.value)}
                      className="min-h-[44px] w-full rounded-md border border-blue-300 bg-white px-3 py-2 text-sm shadow-[inset_0_1px_3px_rgba(37,99,235,0.18)] focus:outline-none"
                      placeholder="XXXXXX-XXXXXX-XXXXXX"
                      disabled={isLoading}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[12px] font-bold uppercase tracking-wide">New Password</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="min-h-[44px] w-full rounded-md border border-blue-300 bg-white px-3 py-2 text-sm shadow-[inset_0_1px_3px_rgba(37,99,235,0.18)] focus:outline-none"
                      placeholder="Create new password"
                      disabled={isLoading}
                      autoComplete="new-password"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[12px] font-bold uppercase tracking-wide">Confirm Password</label>
                    <input
                      type="password"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      className="min-h-[44px] w-full rounded-md border border-blue-300 bg-white px-3 py-2 text-sm shadow-[inset_0_1px_3px_rgba(37,99,235,0.18)] focus:outline-none"
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
                    <label className="mb-1 block text-[12px] font-bold uppercase tracking-wide">Admin Ticket</label>
                    <input
                      type="text"
                      value={resetTicket}
                      onChange={(e) => setResetTicket(e.target.value)}
                      className="min-h-[44px] w-full rounded-md border border-blue-300 bg-white px-3 py-2 text-sm shadow-[inset_0_1px_3px_rgba(37,99,235,0.18)] focus:outline-none"
                      placeholder="TKT-XXXX-XXXX-XXXX"
                      disabled={isLoading}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[12px] font-bold uppercase tracking-wide">New Password</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="min-h-[44px] w-full rounded-md border border-blue-300 bg-white px-3 py-2 text-sm shadow-[inset_0_1px_3px_rgba(37,99,235,0.18)] focus:outline-none"
                      placeholder="Create new password"
                      disabled={isLoading}
                      autoComplete="new-password"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[12px] font-bold uppercase tracking-wide">Confirm Password</label>
                    <input
                      type="password"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      className="min-h-[44px] w-full rounded-md border border-blue-300 bg-white px-3 py-2 text-sm shadow-[inset_0_1px_3px_rgba(37,99,235,0.18)] focus:outline-none"
                      placeholder="Confirm new password"
                      disabled={isLoading}
                      autoComplete="new-password"
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          <p className="min-h-[44px] rounded-md border border-blue-200 bg-white px-3 py-2 text-[12px] font-bold leading-snug text-blue-700">
            {statusMsg}
          </p>

          {rotatedRecoveryCode && (
            <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
              <p className="font-bold">Your recovery code has been rotated. Save this now:</p>
              <p className="mt-1 break-all font-mono text-[13px] font-bold">{rotatedRecoveryCode}</p>
              <button
                type="button"
                onClick={() => void copyRecoveryCode()}
                className="mt-2 min-h-[36px] rounded-md border border-amber-500 bg-gradient-to-b from-amber-100 to-amber-300 px-3 py-1 text-xs font-semibold text-amber-900"
              >
                Copy recovery code
              </button>
            </div>
          )}

          <div className="flex items-center justify-end">
            <button
              type="submit"
              disabled={isLoading}
              className="min-h-[44px] min-w-[148px] cursor-pointer rounded-md border border-blue-500 bg-gradient-to-b from-blue-200 via-blue-300 to-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:from-blue-300 hover:to-blue-600 disabled:opacity-50"
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
            <div className="space-y-1">
              <button
                type="button"
                onClick={toggleMode}
                disabled={isLoading}
                className="min-h-[44px] cursor-pointer text-left text-[12px] font-bold text-blue-700 underline underline-offset-2 disabled:opacity-50"
              >
                {isSignUp ? 'Already have a screen name? Sign On.' : "Don't have a screen name? Get one here."}
              </button>
              <button
                type="button"
                onClick={() => switchAuthView('forgot-password')}
                disabled={isLoading}
                className="min-h-[44px] cursor-pointer text-left text-[12px] font-bold text-blue-700 underline underline-offset-2 disabled:opacity-50"
              >
                Forgot password? Use Recovery Code.
              </button>
              <button
                type="button"
                onClick={() => switchAuthView('redeem-ticket')}
                disabled={isLoading}
                className="min-h-[44px] cursor-pointer text-left text-[12px] font-bold text-blue-700 underline underline-offset-2 disabled:opacity-50"
              >
                Have an admin reset ticket?
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => switchAuthView('sign-on')}
              disabled={isLoading}
              className="min-h-[44px] cursor-pointer text-left text-[12px] font-bold text-blue-700 underline underline-offset-2 disabled:opacity-50"
            >
              Back to Sign On
            </button>
          )}
        </form>
      </RetroWindow>
    </main>
  );
}
