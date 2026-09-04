import type { Metadata } from "next";
import { Manrope, DM_Sans } from "next/font/google";
import "./globals.css";
import "./qr-payments.css";

const display = Manrope({ variable: "--font-display", subsets: ["latin"] });
const body = DM_Sans({ variable: "--font-body", subsets: ["latin"] });

export const metadata: Metadata = {
  title: `${process.env.NEXT_PUBLIC_APP_BANK_NAME||"Great Lakes Bank"} — Digital Banking`,
  description: `Secure ${process.env.NEXT_PUBLIC_APP_BANK_NAME||"Great Lakes Bank"} digital banking for accounts, payments, cards and insights.`,
  icons: { icon: "/great-lakes-bank-logo.png", shortcut: "/great-lakes-bank-logo.png" },
  openGraph: { title: "Great Lakes Bank digital banking", description: "Your bank. Your future. Connected.", images: ["/great-lakes-bank-logo.png"] },
  twitter: { card: "summary", title: "Great Lakes Bank digital banking", description: "Your bank. Your future. Connected.", images: ["/great-lakes-bank-logo.png"] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={`${display.variable} ${body.variable}`}>{children}</body></html>;
}
