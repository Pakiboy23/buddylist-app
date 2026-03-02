'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import RetroWindow from '@/components/RetroWindow';
import { supabase } from '@/lib/supabase';

const SIGN_ON_SOUND = '/signon.wav';

export default function Home() {
  const [screenname, setScreenname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [savePassword, setSavePassword] = useState(true);
  const [autoLogin, setAutoLogin] = useState(false);
  const [statusMsg, setStatusMsg] = useState('Welcome to BuddyList. Enter your account details to sign on.');
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
          ? 'Create your account and pick a Screen Name to get started.'
          : 'Welcome back. Enter your email and password to sign on.',
      );
      return nextMode;
    });
  };

  const handleSignOn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!email.trim() || !password) {
      setStatusMsg('Please enter your Email Address and Password.');
      return;
    }

    if (isSignUp && !screenname.trim()) {
      setStatusMsg('Please choose a Screen Name.');
      return;
    }

    setIsLoading(true);
    setStatusMsg(isSignUp ? 'Creating account...' : 'Dialing in...');

    if (isSignUp) {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            screenname: screenname.trim(),
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
      email: email.trim(),
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
    <main className="min-h-[100dvh] flex items-center justify-center p-4">
      <div className="w-full max-w-[420px]">
        <RetroWindow title="AOL Instant Messenger - Sign On" className="mx-auto">
          <form onSubmit={handleSignOn} className="space-y-3 p-1 text-[13px] font-sans">
            <div className="grid grid-cols-[92px_1fr] gap-3">
              <div className="flex flex-col items-center justify-between border border-os-dark-grey bg-[#f2e7ab] px-2 py-2 shadow-window-in">
                <span className="text-[34px] leading-none">🏃</span>
                <p className="text-[11px] font-bold tracking-wide text-[#0d4da3]">AIM</p>
              </div>

              <div className="space-y-2">
                {isSignUp ? (
                  <div>
                    <label className="mb-1 block text-[12px] font-bold uppercase tracking-wide">Screen Name</label>
                    <input
                      type="text"
                      value={screenname}
                      onChange={(e) => setScreenname(e.target.value)}
                      className="w-full border-2 border-[#0a0a0a] border-b-white border-r-white bg-white px-2 py-1 focus:outline-none shadow-window-in"
                      placeholder="Choose a screen name"
                      disabled={isLoading}
                      autoComplete="nickname"
                    />
                  </div>
                ) : null}

                <div>
                  <label className="mb-1 block text-[12px] font-bold uppercase tracking-wide">Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full border-2 border-[#0a0a0a] border-b-white border-r-white bg-white px-2 py-1 focus:outline-none shadow-window-in"
                    placeholder="you@email.com"
                    disabled={isLoading}
                    autoComplete="email"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[12px] font-bold uppercase tracking-wide">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full border-2 border-[#0a0a0a] border-b-white border-r-white bg-white px-2 py-1 focus:outline-none shadow-window-in"
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
                      className="h-4 w-4 appearance-none border-2 border-[#0a0a0a] border-b-white border-r-white bg-white checked:bg-os-blue checked:[box-shadow:inset_0_0_0_2px_#fff] disabled:opacity-60"
                    />
                    Save password
                  </label>
                  <label className="flex items-center gap-2 text-[12px] font-semibold">
                    <input
                      type="checkbox"
                      checked={autoLogin}
                      onChange={(e) => setAutoLogin(e.target.checked)}
                      disabled={isLoading}
                      className="h-4 w-4 appearance-none border-2 border-[#0a0a0a] border-b-white border-r-white bg-white checked:bg-os-blue checked:[box-shadow:inset_0_0_0_2px_#fff] disabled:opacity-60"
                    />
                    Auto-login
                  </label>
                </div>
              </div>
            </div>

            <p className="min-h-9 border border-os-dark-grey bg-white px-2 py-1 text-[12px] font-bold leading-snug text-os-blue shadow-window-in">
              {statusMsg}
            </p>

            <div className="flex items-center justify-end">
              <button
                type="submit"
                disabled={isLoading}
                className="min-w-[122px] bg-os-blue px-3 py-1 font-bold text-white border-2 border-white border-b-[#0a0a0a] border-r-[#0a0a0a] active:border-t-[#0a0a0a] active:border-l-[#0a0a0a] active:border-b-white active:border-r-white disabled:opacity-50 cursor-pointer"
              >
                {isLoading ? (isSignUp ? 'Creating...' : 'Signing On...') : isSignUp ? 'Create Account' : 'Sign On'}
              </button>
            </div>

            <button
              type="button"
              onClick={toggleMode}
              disabled={isLoading}
              className="text-[12px] font-bold text-os-blue underline underline-offset-2 disabled:opacity-50 cursor-pointer"
            >
              {isSignUp ? 'Back to Sign On' : 'Get a Screen Name'}
            </button>
          </form>
        </RetroWindow>
      </div>
    </main>
  );
}
