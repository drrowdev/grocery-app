import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { LangProvider } from "@/components/lang-provider";
import { IosInstallHint } from "@/components/ios-install-hint";
import { SwRegister } from "@/components/sw-register";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ostoslista — Smart Grocery",
  description:
    "Bilingual (FI/SV) smart shopping list that learns your recurring grocery patterns.",
  applicationName: "Ostoslista",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Ostoslista",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ecfdf5" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="sv"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-white text-zinc-900 dark:bg-black dark:text-zinc-50 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
        <LangProvider>
          {children}
          <IosInstallHint />
        </LangProvider>
        <SwRegister />
      </body>
    </html>
  );
}
