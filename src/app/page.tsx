'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import RetroWindow from '@/components/RetroWindow';
import { supabase } from '@/lib/supabase';

const SIGN_ON_SOUND = '/signon.wav';

export default function Home() {
  const [screenname, setScreenname] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [savePassword, setSavePassword] = useState(true);
  const [autoLogin, setAutoLogin] = useState(false);
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
      const {
        data: { session },
      } = await supabase.auth.getSession();

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

  const toggleMode = () => {
    setIsSignUp((previous) => {
      const nextMode = !previous;
      setStatusMsg(
        nextMode
          ? 'Get a Screen Name by choosing one and creating a password.'
          : 'Welcome back. Enter your Screen Name and Password.',
      );
      return nextMode;
    });
  };

  const handleSignOn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedScreenname = screenname.trim();
    if (!trimmedScreenname || !password) {
      setStatusMsg('Please enter your Screen Name and Password.');
      return;
    }

    const authEmail = `${trimmedScreenname.toLowerCase()}@buddylist.com`;
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

  return (
    <main className="h-[100dvh] overflow-hidden">
      <RetroWindow title="AOL Instant Messenger - Sign On">
        <form onSubmit={handleSignOn} className="mx-auto w-full max-w-md space-y-4 pb-6 text-[13px] font-sans">
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
            </div>
          </div>

          <p className="min-h-[44px] rounded-md border border-blue-200 bg-white px-3 py-2 text-[12px] font-bold leading-snug text-blue-700">
            {statusMsg}
          </p>

          <div className="flex items-center justify-end">
            <button
              type="submit"
              disabled={isLoading}
              className="min-h-[44px] min-w-[148px] cursor-pointer rounded-md border border-blue-500 bg-gradient-to-b from-blue-200 via-blue-300 to-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:from-blue-300 hover:to-blue-600 disabled:opacity-50"
            >
              {isLoading ? (isSignUp ? 'Creating...' : 'Signing On...') : isSignUp ? 'Get a Screen Name' : 'Sign On'}
            </button>
          </div>

          <button
            type="button"
            onClick={toggleMode}
            disabled={isLoading}
            className="min-h-[44px] cursor-pointer text-left text-[12px] font-bold text-blue-700 underline underline-offset-2 disabled:opacity-50"
          >
            {isSignUp ? 'Already have a screen name? Sign On.' : "Don't have a screen name? Get one here."}
          </button>
        </form>
      </RetroWindow>
    </main>
  );
}
