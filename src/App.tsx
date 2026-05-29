import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { ChatProvider } from '@/context/ChatContext';
import PwaBootstrap from '@/components/PwaBootstrap';
import NativeShellRouteSync from '@/components/NativeShellRouteSync';
import GlobalNotificationListener from '@/components/GlobalNotificationListener';
import DeepLinkHandler from '@/components/DeepLinkHandler';
import StorageNotice from '@/components/StorageNotice';
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

export default function App() {
  return (
    <ChatProvider>
      {SHOW_STORAGE_NOTICE && <StorageNotice />}
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
      <Analytics />
    </ChatProvider>
  );
}
