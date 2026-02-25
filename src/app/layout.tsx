import type { Metadata } from "next";
import { Signika, Geist_Mono, Michroma } from "next/font/google";
import "./globals.css";

const signika = Signika({
  variable: "--font-signika",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const michroma = Michroma({
  weight: "400",
  variable: "--font-michroma",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LAÇOS 3.0 - ULTIMATE",
  description: "Sistema de gestão financeira com classificação inteligente",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Laços",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <head>
        <meta name="theme-color" content="#111827" />
      </head>
      <body
        className={`${signika.variable} ${geistMono.variable} ${michroma.variable} antialiased font-[family-name:var(--font-signika)]`}
      >
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                navigator.serviceWorker.register('/sw.js').catch(function(err) {
                  console.log('SW registration failed:', err);
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
