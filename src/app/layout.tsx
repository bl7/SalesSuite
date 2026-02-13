import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeToggle } from "@/components/theme-toggle";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://kora.vercel.app"),
  title: {
    default: "SalesSuite - Field Sales Management for Distributors",
    template: "%s | SalesSuite",
  },
  description: "SalesSuite helps distributors and sales teams verify field visits, capture leads, and process orders. Geofencing-based visit tracking, lead management, and order submission for field sales operations.",
  keywords: ["field sales", "sales management", "visit tracking", "geofencing", "sales reps", "distributors", "order management", "lead capture", "field operations"],
  authors: [{ name: "SalesSuite" }],
  creator: "Gopala Sales Management Pvt Ltd",
  publisher: "Gopala Sales Management Pvt Ltd",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: "SalesSuite",
    title: "SalesSuite - Field Sales Management for Distributors",
    description: "Verify field visits, capture leads, and process orders. Geofencing-based visit tracking for sales teams and distributors.",
    images: [
      {
        url: "/logo.png",
        width: 1200,
        height: 630,
        alt: "SalesSuite - Field Sales Management",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "SalesSuite - Field Sales Management for Distributors",
    description: "Verify field visits, capture leads, and process orders. Geofencing-based visit tracking for sales teams.",
    images: ["/logo.png"],
  },
  alternates: {
    canonical: "/",
  },
  verification: {
    // Add your verification codes here when available
    // google: "your-google-verification-code",
    // yandex: "your-yandex-verification-code",
  },
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
            __html: `
              (function() {
                try {
                  var stored = localStorage.getItem('kora-theme');
                  var shouldUseDark = stored
                    ? stored === 'dark'
                    : window.matchMedia('(prefers-color-scheme: dark)').matches;
                  document.documentElement.classList.toggle('dark', shouldUseDark);
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeToggle />
        {children}
      </body>
    </html>
  );
}
