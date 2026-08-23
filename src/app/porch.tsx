import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import AppIcon from '@/components/AppIcon';
import HimWordmark from '@/components/HimWordmark';
import { waitForSessionOrNull } from '@/lib/authClient';
import { captureAcquisitionSource } from '@/lib/acquisitionSource';
import { navigateAppPath, useAppRouter } from '@/lib/appNavigation';
import {
  APP_STORE_URL,
  PORCH_ADD_ME,
  PORCH_HEADLINE,
  PORCH_LEDE,
  PORCH_ROOMS,
} from '@/lib/webPorch';

export default function WebPorch() {
  const router = useAppRouter();
  const hasNavigatedRef = useRef(false);

  useEffect(() => {
    captureAcquisitionSource();
  }, []);

  useEffect(() => {
    let mounted = true;
    void waitForSessionOrNull().then((session) => {
      if (!mounted || !session || hasNavigatedRef.current) return;
      hasNavigatedRef.current = true;
      navigateAppPath(router, '/hi-its-me');
    });
    return () => {
      mounted = false;
    };
  }, [router]);

  return (
    <main className="ui-auth-shell relative min-h-[100dvh] overflow-y-auto">
      <div className="ui-auth-orb--gold pointer-events-none absolute bottom-0 right-0 h-64 w-64 rounded-full blur-3xl" />
      <div className="mx-auto flex w-full max-w-md flex-col px-6 pb-16 pt-10">
        <span className="ui-brand-sparkle inline-flex h-11 w-11 items-center justify-center rounded-2xl">
          <AppIcon kind="sparkle" className="h-5 w-5" />
        </span>
        <HimWordmark className="mt-4 text-[13px]" />
        <h1 className="mt-5 text-[34px] font-semibold tracking-[-0.04em] text-slate-50">
          {PORCH_HEADLINE}
        </h1>
        <p className="mt-3 max-w-[22rem] text-[15px] leading-6 text-slate-400">{PORCH_LEDE}</p>

        <div className="mt-8 flex flex-col gap-3">
          <a
            href={APP_STORE_URL}
            className="ui-focus-ring ui-auth-submit flex min-h-[48px] items-center justify-center rounded-2xl px-4 text-[14px] font-semibold"
          >
            Get the app
          </a>
          <div className="grid grid-cols-2 gap-3">
            <Link
              to="/signin"
              className="ui-focus-ring ui-auth-secondary flex min-h-[48px] items-center justify-center rounded-2xl px-3 text-[14px] font-semibold"
            >
              Sign in
            </Link>
            <Link
              to="/signin?signup=1"
              className="ui-focus-ring ui-auth-secondary flex min-h-[48px] items-center justify-center rounded-2xl px-3 text-[14px] font-semibold"
            >
              Create account
            </Link>
          </div>
        </div>

        <p className="mt-5 text-[13px] leading-5 text-slate-400">{PORCH_ADD_ME}</p>

        <section className="ui-auth-card mt-10 rounded-[1.6rem] p-5">
          <h2 className="text-[13px] font-semibold tracking-[0.12em] text-slate-400">Seven rooms</h2>
          <ul className="mt-4 space-y-3">
            {PORCH_ROOMS.map((room) => (
              <li key={room.name}>
                <p className="text-[15px] font-semibold text-slate-50">{room.name}</p>
                <p className="text-[13px] leading-5 text-slate-400">{room.blurb}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
