import { Suspense } from "react";
import GlobalNotificationListener from "@/components/GlobalNotificationListener";
import { ChatProvider } from "@/context/ChatContext";

export default function HiItsMeLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ChatProvider>
      {children}
      <Suspense fallback={null}>
        <GlobalNotificationListener />
      </Suspense>
    </ChatProvider>
  );
}
