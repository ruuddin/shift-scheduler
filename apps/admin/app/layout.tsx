import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import MaintenanceBanner from "./MaintenanceBanner";
import { isFlagEnabled } from "@shift-scheduler/shared/flags";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Shift Scheduler — Owner Console",
  description: "SaaS owner console for Shift Scheduler",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <MaintenanceBanner enabled={isFlagEnabled("maintenance-banner")} />
        {children}
      </body>
    </html>
  );
}
