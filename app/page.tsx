import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { Brand, BrandMark } from "@/components/brand";

const FEATURES = [
  {
    title: "Agenda con cupos reales",
    body: "Cada horario sabe cuánta gente entra y cuánta ya reservó. Si alguien cancela, el lugar se libera al instante.",
  },
  {
    title: "Reservas recurrentes",
    body: "El que viene todos los lunes se anota una vez. Cancelar una fecha no rompe el resto de la serie.",
  },
  {
    title: "Pagos y habilitaciones",
    body: "Quién puede usar qué servicio y hasta cuándo, separado de si ya pagó. Las becas y cortesías también entran.",
  },
];

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b bg-card">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-4">
          <Brand />
          <div className="flex items-center gap-2">
            <Link href="/login" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              Ingresar
            </Link>
            <Link href="/signup" className={buttonVariants({ size: "sm" })}>
              Crear cuenta
            </Link>
          </div>
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        <section className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6 px-5 py-16 text-center sm:py-24">
          <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <span className="size-1.5 rounded-full bg-success" />
            Para gimnasios, consultorios, canchas y estudios
          </span>

          <h1 className="text-4xl leading-[1.1] text-balance sm:text-5xl">
            La agenda de tu negocio, sin WhatsApp ni cuaderno
          </h1>

          <p className="max-w-xl text-lg text-pretty text-muted-foreground">
            Publicá tus horarios, controlá los cupos y dejá que tus clientes reserven solos.
            Vos ves todo desde un panel.
          </p>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Link href="/signup" className={buttonVariants({ size: "lg" })}>
              Empezar gratis
            </Link>
            <Link href="/login" className={buttonVariants({ variant: "outline", size: "lg" })}>
              Ya tengo cuenta
            </Link>
          </div>
        </section>

        <section className="border-y bg-card">
          <div className="mx-auto grid w-full max-w-5xl gap-8 px-5 py-14 sm:grid-cols-3">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="flex flex-col gap-2">
                <BrandMark className="size-8 rounded-lg bg-primary-subtle text-primary" />
                <h2 className="text-base">{feature.title}</h2>
                <p className="text-sm leading-relaxed text-muted-foreground">{feature.body}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="mx-auto w-full max-w-5xl px-5 py-8">
        <p className="text-xs text-muted-foreground">Reservaste</p>
      </footer>
    </div>
  );
}
