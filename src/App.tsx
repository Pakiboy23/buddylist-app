import { Component, Suspense, lazy, type ErrorInfo, type ReactNode } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { Analytics } from '@vercel/analytics/react';
import { ChatProvider } from '@/context/ChatContext';
import PwaBootstrap from '@/components/PwaBootstrap';
import NativeShellRouteSync from '@/components/NativeShellRouteSync';
import GlobalNotificationListener from '@/components/GlobalNotificationListener';
import DeepLinkHandler from '@/components/DeepLinkHandler';
import StorageNotice from '@/components/StorageNotice';
import AppIcon from '@/components/AppIcon';
import HimWordmark from '@/components/HimWordmark';
import { isEuTimezone } from '@/lib/euTimezone';

const SHOW_STORAGE_NOTICE = isEuTimezone();

// Pages — lazy-loaded for code splitting
const LoginPage = lazy(() => import('@/app/page'));
const ResetPasswordPage = lazy(() => import('@/app/reset-password/page'));
const AccountPage = lazy(() => import('@/app/account/page'));
const DeleteAccountPage = lazy(() => import('@/app/account/delete/page'));
const HiItsMePage = lazy(() => import('@/app/hi-its-me/page'));
const RoomsPage = lazy(() => import('@/app/hi-its-me/rooms/page'));
const NewRoomPage = lazy(() => import('@/app/hi-its-me/rooms/new/page'));
const RoomPreviewPage = lazy(() => import('@/app/hi-its-me/rooms/[roomId]/preview/page'));
const InvitePage = lazy(() => import('@/app/join/[inviteCode]/page'));

function AppLaunchFallback() {
  return (
    <main className="ui-auth-shell flex h-[100dvh] items-center justify-center overflow-hidden px-6 text-center text-slate-100">
      <div className="ui-auth-card w-full max-w-sm rounded-[1.9rem] p-6 shadow-2xl">
        <span className="ui-brand-sparkle mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl">
          <AppIcon kind="sparkle" className="h-6 w-6" />
        </span>
        <HimWordmark className="mx-auto mt-4 justify-center text-[13px]" />
        <p className="mt-4 text-[15px] font-semibold">Starting H.I.M.…</p>
        <p className="mt-2 text-[12px] leading-5 text-slate-400">
          Warming up your private messaging shell. This should only take a moment.
        </p>
      </div>
    </main>
  );
}

function AppLoadingFallback() {
  return (
    <main className="flex h-[100dvh] items-center justify-center bg-[#13100E] px-6 text-center text-[#F7F0E8]">
      <div role="status" aria-live="polite" className="space-y-3">
        <div className="mx-auto h-10 w-10 animate-pulse rounded-2xl bg-[#E8A23A]" />
        <p className="text-[13px] font-semibold uppercase tracking-[0.22em] text-[#E8A23A]">Loading H.I.M.</p>
        <p className="text-[14px] text-[#9C8E82]">Getting the app ready…</p>
      </div>
    </main>
  );
}

class AppErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('App shell failed to render:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="ui-auth-shell flex h-[100dvh] items-center justify-center overflow-hidden px-6 text-center text-slate-100">
          <div className="ui-auth-card w-full max-w-sm rounded-[1.9rem] p-6 shadow-2xl">
            <span className="ui-brand-sparkle mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl">
              <AppIcon kind="sparkle" className="h-6 w-6" />
            </span>
            <HimWordmark className="mx-auto mt-4 justify-center text-[13px]" />
            <h1 className="mt-4 text-[22px] font-semibold tracking-[-0.03em]">H.I.M. needs a refresh</h1>
            <p className="mt-2 text-[13px] leading-5 text-slate-400">
              The app shell did not finish loading. Refresh to try again.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="ui-focus-ring ui-auth-submit mt-5 min-h-[48px] w-full rounded-2xl px-4 py-3 text-[14px] font-semibold transition active:scale-[0.99]"
            >
              Refresh app
            </button>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  return (
    <ChatProvider>
      {SHOW_STORAGE_NOTICE && <StorageNotice />}
      <AppErrorBoundary>
        <Suspense fallback={<AppLaunchFallback />}>
          <Routes>
            <Route path="/" element={<LoginPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/account" element={<AccountPage />} />
            <Route path="/account/delete" element={<DeleteAccountPage />} />
            <Route path="/hi-its-me" element={<HiItsMePage />} />
            <Route path="/hi-its-me/rooms" element={<RoomsPage />} />
            <Route path="/hi-its-me/rooms/new" element={<NewRoomPage />} />
            <Route path="/hi-its-me/rooms/:roomId/preview" element={<RoomPreviewPage />} />
            <Route path="/join/:inviteCode" element={<InvitePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </AppErrorBoundary>
      <Suspense fallback={<AppLoadingFallback />}>
        <Routes>
          <Route path="/" element={<LoginPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/account/delete" element={<DeleteAccountPage />} />
          <Route path="/hi-its-me" element={<HiItsMePage />} />
          <Route path="/hi-its-me/rooms" element={<RoomsPage />} />
          <Route path="/hi-its-me/rooms/new" element={<NewRoomPage />} />
          <Route path="/hi-its-me/rooms/:roomId/preview" element={<RoomPreviewPage />} />
          <Route path="/join/:inviteCode" element={<InvitePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <PwaBootstrap />
      <NativeShellRouteSync />
      <DeepLinkHandler />
      <GlobalNotificationListener />
      {!Capacitor.isNativePlatform() && <Analytics />}
    </ChatProvider>
  );
}
