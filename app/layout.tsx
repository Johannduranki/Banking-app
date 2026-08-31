import type { Metadata } from "next";
import { Manrope, DM_Sans } from "next/font/google";
import "./globals.css";
import "./qr-payments.css";

const display = Manrope({ variable: "--font-display", subsets: ["latin"] });
const body = DM_Sans({ variable: "--font-body", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Duranki — Banking, beautifully simple",
  description: "A secure digital banking demo for everyday money, payments, cards and insights.",
  icons: { icon: "/duranki-logo.png", shortcut: "/duranki-logo.png" },
  openGraph: { title: "Duranki digital banking", description: "Your money, moving beautifully.", images: ["/og.png"] },
  twitter: { card: "summary_large_image", title: "Duranki digital banking", description: "Your money, moving beautifully.", images: ["/og.png"] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={`${display.variable} ${body.variable}`}>{children}</body></html>;
}
