import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { IconTile } from "@/components/ui/icon-tile";
import { Brand } from "@/components/brand";
import { HeroPreview } from "@/components/marketing/hero-preview";
import { PricingSection, PricingSkeleton } from "@/components/marketing/pricing-section";
import {
  ActivityIcon,
  ChevronRight,
  CreditCardIcon,
  GoalIcon,
  ListChecksIcon,
  PaletteIcon,
  RepeatIcon,
  RotateCcwIcon,
  StethoscopeIcon,
  UsersIcon,
} from "@/components/icons";

export const metadata = {
  description:
    "Publicá tus horarios, tus clientes reservan solos y vos ves todo desde un panel. Cupos, turnos fijos y pagos, para cualquier negocio con horarios.",
};

// ADR-0030 §3.3: nunca un solo rubro (menos aún gimnasio) como caso único
// -- los tres cubren los tres modos reales del producto (capacidad 1 /
// capacidad N / recurso múltiple).
const INDUSTRIES = [
  {
    icon: <StethoscopeIcon />,
    name: "Consultorio",
    scenario: "Turnos de 30 minutos, uno por vez, con la ficha del paciente a mano.",
  },
  {
    icon: <ActivityIcon />,
    name: "Estudio de pilates",
    scenario: "Clases de 8 lugares, el que viene todos los martes se anota una vez.",
  },
  {
    icon: <GoalIcon />,
    name: "Cancha de fútbol",
    scenario: "Dos canchas, turnos de una hora, y el que reserva ya pagó.",
  },
] as const;

const FEATURES = [
  {
    icon: <UsersIcon />,
    title: "Cupos que son de verdad",
    body: "Cada horario sabe cuánta gente entra; si alguien libera, el lugar vuelve al instante.",
  },
  {
    icon: <RepeatIcon />,
    title: "Turnos fijos",
    body: "El que viene todas las semanas se anota una vez; cancelar una fecha no rompe la serie.",
  },
  {
    icon: <ListChecksIcon />,
    title: "Planes y cuotas",
    body: "“Dos veces por semana” es una regla del plan, no algo que tengas que contar a mano.",
  },
  {
    icon: <CreditCardIcon />,
    title: "Pagos al día",
    body: "Quién está al día y hasta cuándo, con becas y cortesías incluidas.",
  },
  {
    icon: <RotateCcwIcon />,
    title: "Crédito de recupero",
    body: "El que avisa a tiempo se recupera la fecha dentro del mes, sin que lo arregles vos.",
  },
  {
    icon: <PaletteIcon />,
    title: "Tu marca, no la nuestra",
    body: "Tu logo y tu color en la página que ven tus clientes.",
  },
] as const;

const STEPS = [
  { title: "Cargás lo que ofrecés", body: "Servicios, horarios y cupos, en un rato." },
  { title: "Compartís tu link", body: "Tu página pública queda lista para mandar." },
  { title: "Mirás la agenda llenarse", body: "Tus clientes reservan solos, vos controlás todo." },
] as const;

const TRUST_SIGNALS = [
  "Tus clientes no instalan nada. Entran a un link y reservan.",
  "Backup diario de tu información.",
  "Hablás directo con quien lo construye, no con un ticket.",
] as const;

const FAQS = [
  {
    q: "¿Mis clientes tienen que crear cuenta?",
    a: "Para ver la agenda y los horarios disponibles, no. Para confirmar una reserva, sí necesitan una cuenta simple.",
  },
  {
    q: "¿Puedo poner mi logo y mi color?",
    a: "Sí. La página pública y el panel se ven con la marca de tu negocio, no con la nuestra.",
  },
  {
    q: "¿Cobra la plataforma los pagos de mis clientes?",
    a: "No. Vos registrás quién está al día; el cobro en sí lo hacés por el medio que ya usás.",
  },
  {
    q: "¿Qué pasa si alguien cancela?",
    a: "El lugar se libera al instante. Según cómo configures el servicio, le queda un crédito para recuperar la fecha.",
  },
  {
    q: "¿Sirve si atiendo de a uno?",
    a: "Sí: un consultorio con capacidad 1 funciona igual que una clase de 20.",
  },
  {
    q: "¿Y si tengo más de un local o más de una cancha?",
    a: "Cada uno es un recurso propio con su horario y su capacidad, dentro de la misma cuenta.",
  },
] as const;

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
      {/* 3.1 Header */}
      <header className="sticky top-0 z-10 border-b border-border/70 bg-card/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-3.5 sm:px-8">
          <Brand />
          <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground sm:flex">
            <a href="#funciones" className="hover:text-foreground">
              Funciones
            </a>
            <a href="#precios" className="hover:text-foreground">
              Precios
            </a>
            <a href="#preguntas" className="hover:text-foreground">
              Preguntas
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login" className={buttonVariants({ variant: "ghost", size: "touch" })}>
              Ingresar
            </Link>
            <Link href="/contacto" className={buttonVariants({ size: "touch" })}>
              Empezar
            </Link>
          </div>
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        {/* 3.2 Hero */}
        <section className="brand-wash border-b bg-card">
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div className="flex flex-col items-start gap-6 text-left">
              <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
                <span className="size-1.5 rounded-full bg-success" />
                Para consultorios, estudios, canchas y cualquier negocio con horarios
              </span>

              <h1 className="display-1">
                La agenda de tu negocio,{" "}
                <span className="text-[var(--brand-violet-strong)]">funcionando sola</span>
              </h1>

              <p className="lead max-w-xl text-muted-foreground">
                Publicás tus horarios, tus clientes reservan solos y vos ves todo desde un panel.
                Sin WhatsApp a las once de la noche ni cuaderno.
              </p>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Link href="/contacto" className={buttonVariants({ size: "touch" })}>
                  Empezar
                </Link>
                <a
                  href="#como-funciona"
                  className={buttonVariants({ variant: "outline", size: "touch" })}
                >
                  Ver cómo funciona
                </a>
              </div>

              <p className="text-xs text-muted-foreground">
                Te acompañamos en el alta. Tu página queda publicada el mismo día.
              </p>
            </div>

            <div className="hidden lg:block">
              <HeroPreview />
            </div>
          </div>
        </section>

        {/* 3.3 Franja de rubros */}
        <section className="border-b bg-background">
          <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
            <div className="mx-auto mb-10 flex max-w-2xl flex-col items-center gap-2 text-center">
              <h2 className="text-2xl">Para cualquier negocio con horarios</h2>
              <p className="text-muted-foreground">
                Los mismos cupos y la misma agenda, adaptados a cómo trabajás vos.
              </p>
            </div>
            <div className="grid gap-6 sm:grid-cols-3">
              {INDUSTRIES.map((industry) => (
                <div
                  key={industry.name}
                  className="flex flex-col gap-3 rounded-2xl border bg-card p-6 shadow-card"
                >
                  <IconTile icon={industry.icon} />
                  <h3 className="text-base">{industry.name}</h3>
                  <p className="text-sm text-muted-foreground">{industry.scenario}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 3.4 Funciones */}
        <section id="funciones" className="scroll-mt-20 border-b bg-card">
          <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
            <div className="mx-auto mb-10 flex max-w-2xl flex-col items-center gap-2 text-center">
              <h2 className="text-2xl">Todo lo que hoy hacés a mano</h2>
              <p className="text-muted-foreground">
                Cupos, turnos fijos, pagos y tu marca, en un solo lugar.
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {FEATURES.map((feature) => (
                <div key={feature.title} className="flex flex-col gap-3">
                  <IconTile icon={feature.icon} />
                  <h3 className="text-base">{feature.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{feature.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 3.5 Cómo funciona */}
        <section id="como-funciona" className="scroll-mt-20 border-b bg-background">
          <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
            <div className="mx-auto mb-10 flex max-w-2xl flex-col items-center gap-2 text-center">
              <h2 className="text-2xl">Cómo funciona</h2>
            </div>
            <div className="relative grid gap-8 md:grid-cols-3">
              <div
                aria-hidden
                className="absolute top-5 right-0 left-0 hidden h-px bg-border md:block"
              />
              {STEPS.map((step, index) => (
                <div key={step.title} className="relative flex flex-col items-center gap-3 text-center">
                  <span className="relative z-[1] flex size-10 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                    {index + 1}
                  </span>
                  <h3 className="text-base">{step.title}</h3>
                  <p className="text-sm text-muted-foreground">{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 3.6 Señales de confianza -- sin testimonios inventados */}
        <section className="border-b bg-card">
          <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
            <div className="grid gap-6 sm:grid-cols-3">
              {TRUST_SIGNALS.map((signal) => (
                <p key={signal} className="text-balance text-center text-lg text-foreground sm:text-left">
                  {signal}
                </p>
              ))}
            </div>
          </div>
        </section>

        {/* 3.7 Precios -- única sección dinámica de la landing */}
        <section id="precios" className="scroll-mt-20 border-b bg-background">
          <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
            <div className="mx-auto mb-10 flex max-w-2xl flex-col items-center gap-2 text-center">
              <h2 className="text-2xl">Precios</h2>
              <p className="text-muted-foreground">Precios en dólares, sin letra chica.</p>
            </div>
            <Suspense fallback={<PricingSkeleton />}>
              <PricingSection />
            </Suspense>
          </div>
        </section>

        {/* 3.8 Preguntas frecuentes */}
        <section id="preguntas" className="scroll-mt-20 border-b bg-card">
          <div className="mx-auto w-full max-w-3xl px-5 py-16 sm:px-8 sm:py-24">
            <h2 className="mb-8 text-center text-2xl">Preguntas frecuentes</h2>
            <div className="flex flex-col divide-y divide-border">
              {FAQS.map((faq) => (
                <details key={faq.q} className="group py-4">
                  <summary className="focus-ring flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
                    <span className="text-sm font-medium sm:text-base">{faq.q}</span>
                    <ChevronRight className="shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
                  </summary>
                  <p className="mt-2 text-sm text-muted-foreground">{faq.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* 3.9 CTA final */}
        <section className="bg-background">
          <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
            <div className="brand-band flex flex-col items-center gap-5 rounded-3xl px-6 py-14 text-center sm:px-16">
              <h2 className="display-2">Dejá de armar tu agenda a mano</h2>
              <p className="max-w-xl">
                Contanos sobre tu negocio y te acompañamos a publicar tu primera agenda.
              </p>
              <Link href="/contacto" className={buttonVariants({ size: "touch" })}>
                Empezar
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t bg-card">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-3 px-5 py-8 text-center sm:flex-row sm:justify-between sm:px-8 sm:text-left">
          <Brand />
          <div className="flex flex-col items-center gap-1 text-xs text-muted-foreground sm:flex-row sm:gap-4">
            <Link href="/contacto" className="hover:text-foreground">
              Contacto
            </Link>
            <span>© {new Date().getFullYear()} Reservaste</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
