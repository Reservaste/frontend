import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Brand } from "@/components/brand";
import { ContactForm } from "./contact-form";

export const metadata = {
  title: "Contacto",
  description: "Contanos sobre tu negocio y te acompañamos a publicar tu primera agenda.",
};

/**
 * The landing's CTA destination (ADR-0030 resolution 2). Reachable without
 * a session -- same as the public calendar -- because it's the one page
 * whose entire job is to talk to someone who doesn't have an account yet.
 * A signed-in visitor is sent to their dashboard instead, same convention
 * as `/`, `/login` and `/signup`.
 */
export default async function ContactPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-5 py-10 sm:py-16">
      <Brand />
      <div className="flex w-full max-w-lg flex-col gap-1 text-center">
        <h1 className="text-2xl">Contanos sobre tu negocio</h1>
        <p className="text-sm text-muted-foreground">
          Te respondemos nosotros mismos, no un ticket automático.
        </p>
      </div>
      <div className="w-full max-w-lg">
        <ContactForm />
      </div>
    </div>
  );
}
