import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { CampusFixProvider } from "@/lib/store";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CampusFix — Campus Complaint Management & Tracking System",
  description: "Genesis '26 Hackathon: Transparent, accountable, and prompt campus issue resolution.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 selection:bg-indigo-500 selection:text-white">
        <CampusFixProvider>{children}</CampusFixProvider>
      </body>
    </html>
  );
}
