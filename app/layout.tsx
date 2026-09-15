import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// Inter over the scaffold's Geist pairing: it's the typeface this whole
// category (Calendly, Linear, Cal.com) reads like, and the mono face was
// never used -- tabular numbers come from font-feature-settings instead.
const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Reservaste",
    template: "%s · Reservaste",
  },
  description: "Agenda, reservas y cupos para cualquier negocio con horarios.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${inter.variable} h-full`}>
      <body className="flex min-h-full flex-col bg-background text-foreground">{children}</body>
    </html>
  );
}
