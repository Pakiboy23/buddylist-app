'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import RetroWindow from '@/components/RetroWindow';
import { supabase } from '@/lib/supabase';

export default function Home() {
  const [screenname, setScreenname] = useState('');
  const [email, setEmail] = useState('');
  const [statusMsg, setStatusMsg] = useState('Welcome to BuddyList.');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  // Check if user is already logged in and send them to the Buddy List
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.push('/buddy-list');
      }
    };
    checkSession();

    // Also listen for the exact moment they click the Magic Link
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        router.push('/buddy-list');
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  const handleSignOn = async () => {
    if (!screenname || !email) {
      setStatusMsg('Please enter both fields!');
      return;
    }

    setIsLoading(true);
    setStatusMsg('Dialing in... ☎️');

    const { error } = await supabase.auth.signInWithOtp({
      email: email,
      options: {
        data: {
          screenname: screenname,
        }
      }
    });

    if (error) {
      setStatusMsg(`Connection failed: ${error.message}`);
    } else {
      setStatusMsg('Success! Check your email for the Sign-On link.');
    }
    
    setIsLoading(false);
  };

  return (
    <main className="min-h-[100dvh] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <RetroWindow title="Sign On">
          <div className="flex flex-col gap-4 p-2 text-sm font-sans">
            <p className="font-bold text-os-blue">{statusMsg}</p>
            
            <div>
              <label className="block mb-1 font-bold">Screenname:</label>
              <input 
                type="text" 
                value={screenname}
                onChange={(e) => setScreenname(e.target.value)}
                className="w-full border-2 border-[#0a0a0a] border-b-white border-r-white p-1 focus:outline-none bg-white shadow-window-in" 
                placeholder="e.g. Sk8erBoi99"
                disabled={isLoading}
              />
            </div>

            <div>
              <label className="block mb-1 font-bold">Email Address:</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border-2 border-[#0a0a0a] border-b-white border-r-white p-1 focus:outline-none bg-white shadow-window-in" 
                placeholder="you@email.com"
                disabled={isLoading}
              />
            </div>

            <button 
              onClick={handleSignOn}
              disabled={isLoading}
              className="mt-2 bg-os-grey border-2 border-white border-b-[#0a0a0a] border-r-[#0a0a0a] active:border-t-[#0a0a0a] active:border-l-[#0a0a0a] active:border-b-white active:border-r-white p-1 font-bold disabled:opacity-50 cursor-pointer"
            >
              {isLoading ? 'Connecting...' : 'Sign On'}
            </button>
          </div>
        </RetroWindow>
      </div>
    </main>
  );
}