import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ChatProvider } from '@/context/ChatContext';
import PwaBootstrap from '@/components/PwaBootstrap';
import NativeShellRouteSync from '@/components/NativeShellRouteSync';
import GlobalNotificationListener from '@/components/GlobalNotificationListener';

// Pages — lazy-loaded for code splitting
const LoginPage = lazy(() => import('@/app/page'));
const HiItsMePage = lazy(() => import('@/app/hi-its-me/page'));
const RoomsPage = lazy(() => import('@/app/hi-its-me/rooms/page'));
const NewRoomPage = lazy(() => import('@/app/hi-its-me/rooms/new/page'));
const RoomPreviewPage = lazy(() => import('@/app/hi-its-me/rooms/[roomId]/preview/page'));
const InvitePage = lazy(() => import('@/app/join/[inviteCode]/page'));

export default function App() {
  return (
    <ChatProvider>
      <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<LoginPage />} />
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
      <GlobalNotificationListener />
    </ChatProvider>
  );
}
