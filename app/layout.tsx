import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://pf24.lat"),
  title: {
    default: "PF24 | Simulación aérea en Project Flight",
    template: "%s",
  },
  description:
    "PF24 es una comunidad hispana de simulación aérea en Project Flight y una plataforma para pilotos y controladores ATC.",
  applicationName: "PF24",
  generator: "Next.js",
  alternates: {
    canonical: "https://pf24.lat/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "es_CL",
    url: "https://pf24.lat/",
    siteName: "PF24",
    title: "PF24 | Simulación aérea en Project Flight",
    description:
      "Comunidad hispana de simulación aérea en Project Flight con operaciones de pilotos y control de tránsito aéreo virtual.",
  },
  twitter: {
    card: "summary_large_image",
    title: "PF24 | Simulación aérea en Project Flight",
    description:
      "Comunidad hispana de simulación aérea en Project Flight con operaciones de pilotos y ATC.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
