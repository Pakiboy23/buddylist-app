'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
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

  const inputClass =
    'w-full rounded-2xl border border-slate-200 bg-white/88 px-4 py-3.5 text-[15px] text-slate-800 placeholder-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:opacity-60';
  const labelClass = 'mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-slate-500';

  return (
    <main className="relative flex h-[100dvh] items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_10%_15%,#c5ddff_0%,#eaf2ff_34%,#f6f9ff_62%,#dce9ff_100%)]">
      <div className="pointer-events-none absolute -left-20 top-10 h-56 w-56 rounded-full bg-blue-200/50 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 right-8 h-72 w-72 rounded-full bg-cyan-200/45 blur-3xl" />

      <form
        onSubmit={handlePrimarySubmit}
        className="relative z-10 mx-4 flex w-full max-w-sm flex-col gap-5"
      >
        {/* Logo + title */}
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-[1.4rem] border border-white/70 bg-white/80 shadow-[0_12px_30px_rgba(15,23,42,0.14)] backdrop-blur-lg">
            <span className="text-[32px] leading-none">✦</span>
          </div>
          <h1 className="text-[28px] font-semibold tracking-tight text-slate-800">BuddyList</h1>
          <p className="mt-1 text-[13px] text-slate-500">
            {authView === 'sign-on'
              ? isSignUp ? 'Create your screen name' : 'Sign on to your account'
              : authView === 'forgot-password' ? 'Reset with recovery code'
              : 'Redeem an admin ticket'}
          </p>
        </div>

        {/* View switcher — only show when not on sign-on */}
        {authView !== 'sign-on' ? (
          <button
            type="button"
            onClick={() => switchAuthView('sign-on')}
            disabled={isLoading}
            className="flex items-center gap-1.5 text-[13px] font-semibold text-blue-600 disabled:opacity-50"
          >
            ← Back to Sign On
          </button>
        ) : null}

        {/* Fields card */}
        <div className="space-y-3 rounded-[1.4rem] border border-white/65 bg-white/75 px-4 py-5 shadow-[0_20px_40px_rgba(15,23,42,0.14)] backdrop-blur-xl">
          <div>
            <label className={labelClass}>Screen Name</label>
            <input
              type="text"
              value={screenname}
              onChange={(e) => setScreenname(e.target.value)}
              className={inputClass}
              placeholder="sk8erboi99"
              disabled={isLoading}
              autoComplete="username"
            />
          </div>

          {authView === 'sign-on' && (
            <div>
              <label className={labelClass}>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
                placeholder="Enter password"
                disabled={isLoading}
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
              />
            </div>
          )}

          {authView === 'forgot-password' && (
            <>
              <div>
                <label className={labelClass}>Recovery Code</label>
                <input type="text" value={recoveryCode} onChange={(e) => setRecoveryCode(e.target.value)} className={inputClass} placeholder="XXXXXX-XXXXXX-XXXXXX" disabled={isLoading} />
              </div>
              <div>
                <label className={labelClass}>New Password</label>
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inputClass} placeholder="Create new password" disabled={isLoading} autoComplete="new-password" />
              </div>
              <div>
                <label className={labelClass}>Confirm Password</label>
                <input type="password" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} className={inputClass} placeholder="Confirm new password" disabled={isLoading} autoComplete="new-password" />
              </div>
            </>
          )}

          {authView === 'redeem-ticket' && (
            <>
              <div>
                <label className={labelClass}>Admin Ticket</label>
                <input type="text" value={resetTicket} onChange={(e) => setResetTicket(e.target.value)} className={inputClass} placeholder="TKT-XXXX-XXXX-XXXX" disabled={isLoading} />
              </div>
              <div>
                <label className={labelClass}>New Password</label>
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inputClass} placeholder="Create new password" disabled={isLoading} autoComplete="new-password" />
              </div>
              <div>
                <label className={labelClass}>Confirm Password</label>
                <input type="password" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} className={inputClass} placeholder="Confirm new password" disabled={isLoading} autoComplete="new-password" />
              </div>
            </>
          )}
        </div>

        {/* Status message */}
        <p className="rounded-2xl border border-blue-100 bg-white/80 px-4 py-2.5 text-[12px] font-medium leading-snug text-blue-700">
          {statusMsg}
        </p>

        {/* Rotated recovery code */}
        {rotatedRecoveryCode && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] text-amber-900">
            <p className="font-semibold">Save your new recovery code:</p>
            <p className="mt-1.5 break-all font-mono text-[13px] font-bold">{rotatedRecoveryCode}</p>
            <button
              type="button"
              onClick={() => void copyRecoveryCode()}
              className="mt-2.5 rounded-xl border border-amber-300 bg-white/80 px-3 py-1.5 text-[11px] font-semibold text-amber-800 hover:bg-white active:scale-95"
            >
              Copy code
            </button>
          </div>
        )}

        {/* Primary CTA */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-2xl bg-blue-500 py-4 text-[16px] font-semibold text-white shadow-[0_8px_20px_rgba(37,99,235,0.38)] transition hover:bg-blue-600 active:scale-[0.98] disabled:opacity-60"
        >
          {isLoading
            ? authView === 'forgot-password' ? 'Resetting…'
              : authView === 'redeem-ticket' ? 'Redeeming…'
              : isSignUp ? 'Creating…' : 'Signing On…'
            : authView === 'forgot-password' ? 'Reset Password'
            : authView === 'redeem-ticket' ? 'Redeem Ticket'
            : isSignUp ? 'Get a Screen Name'
            : 'Sign On'}
        </button>

        {/* Secondary links */}
        {authView === 'sign-on' ? (
          <div className="space-y-1 text-center">
            <button
              type="button"
              onClick={toggleMode}
              disabled={isLoading}
              className="block w-full py-1 text-[13px] font-semibold text-blue-600 hover:text-blue-700 disabled:opacity-50"
            >
              {isSignUp ? 'Already have a screen name? Sign On' : "Don't have a screen name? Get one here"}
            </button>
            <button
              type="button"
              onClick={() => switchAuthView('forgot-password')}
              disabled={isLoading}
              className="block w-full py-1 text-[13px] text-slate-500 hover:text-slate-700 disabled:opacity-50"
            >
              Forgot password?
            </button>
            <button
              type="button"
              onClick={() => switchAuthView('redeem-ticket')}
              disabled={isLoading}
              className="block w-full py-1 text-[12px] text-slate-400 hover:text-slate-600 disabled:opacity-50"
            >
              Have an admin reset ticket?
            </button>
          </div>
        ) : null}
      </form>
    </main>
  );
}
