import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import GlobalNotificationListener from "@/components/GlobalNotificationListener";
import PwaBootstrap from "@/components/PwaBootstrap";
import { ChatProvider } from "@/context/ChatContext";
import "./globals.css";

export const metadata: Metadata = {
  title: "BuddyList",
  description: "BuddyList messenger",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "BuddyList",
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0f172a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('buddylist_theme');var d=t==='light'?false:t==='system'?matchMedia('(prefers-color-scheme:dark)').matches:true;document.documentElement.classList.toggle('dark',d)}catch(e){document.documentElement.classList.add('dark')}})()`,
          }}
        />
      </head>
      <body className="antialiased">
        <ChatProvider>
          {children}
          <PwaBootstrap />
          <Suspense fallback={null}>
            <GlobalNotificationListener />
          </Suspense>
        </ChatProvider>
      </body>
    </html>
  );
}
