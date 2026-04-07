import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Nunito } from "next/font/google";
import { Suspense } from "react";
import GlobalNotificationListener from "@/components/GlobalNotificationListener";
import NativeShellRouteSync from "@/components/NativeShellRouteSync";
import PwaBootstrap from "@/components/PwaBootstrap";
import { ChatProvider } from "@/context/ChatContext";
import "./globals.css";

const nunito = Nunito({
  subsets: ["latin"],
  variable: "--font-ui",
  display: "swap",
  weight: ["300", "400", "500", "600", "700", "800"],
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-screenname",
  display: "swap",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "H.I.M.",
  description: "H.I.M. messenger",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "H.I.M.",
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
  themeColor: "#13100E",
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
            __html: `(function(){try{var t=localStorage.getItem('hiitsme_theme');var d=t==='light'?false:t==='system'?matchMedia('(prefers-color-scheme:dark)').matches:true;document.documentElement.classList.toggle('dark',d)}catch(e){document.documentElement.classList.add('dark')}})()`,
          }}
        />
      </head>
      <body className={`${nunito.variable} ${ibmPlexMono.variable} antialiased`}>
        <ChatProvider>
          {children}
          <PwaBootstrap />
          <Suspense fallback={null}>
            <NativeShellRouteSync />
          </Suspense>
          <Suspense fallback={null}>
            <GlobalNotificationListener />
          </Suspense>
        </ChatProvider>
      </body>
    </html>
  );
}
