import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { AppProviders } from "@/components/AppProviders";
import { theme, themeToCss } from "@/theme";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"] });
const jetbrains = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PAU Network",
  description: "Connect with Pan-Atlantic University alumni from your course. Book mentorship sessions, join live spaces, and grow your network.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // lets the bottom nav use the iPhone safe area
  themeColor: theme.colors.primary,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <style dangerouslySetInnerHTML={{ __html: themeToCss() }} />
      </head>
      <body className={`${jakarta.variable} ${jetbrains.variable} font-sans antialiased`}>
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
