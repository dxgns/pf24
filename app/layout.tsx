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
    default: "PF24 | Project Flight Spanish Community",
    template: "%s | PF24",
  },
  description:
    "PF24 es una comunidad hispana de simulación aérea en Project Flight con pilotos, controladores ATC, vuelos multijugador, planes de vuelo y herramientas operativas.",
  keywords: [
    "PF24",
    "Project Flight",
    "Project Flight Spanish",
    "Project Flight español",
    "simulación aérea",
    "ATC virtual",
    "controladores aéreos",
    "vuelos multijugador",
    "aviación virtual",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "es_CL",
    url: "https://pf24.lat",
    siteName: "PF24",
    title: "PF24 | Project Flight Spanish Community",
    description:
      "Comunidad hispana de simulación aérea en Project Flight con pilotos, ATC y operaciones multijugador.",
  },
  twitter: {
    card: "summary_large_image",
    title: "PF24 | Project Flight Spanish Community",
    description:
      "Comunidad hispana de simulación aérea en Project Flight con pilotos, ATC y operaciones multijugador.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
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
