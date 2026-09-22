import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toast";

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
      {/* Toaster is a client component wrapping server-rendered children,
          which doesn't turn them into client components -- it just puts the
          toast provider above the whole app so any client component can call
          useToast() without wiring a provider per screen. */}
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <Toaster>{children}</Toaster>
      </body>
    </html>
  );
}
