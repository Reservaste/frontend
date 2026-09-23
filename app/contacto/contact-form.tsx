"use client";

import { useActionState } from "react";
import Link from "next/link";
import { submitContactRequest, type ContactActionState } from "@/app/actions/contact";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Field, FieldHint, FormError } from "@/components/ui/form";
import { CheckIcon } from "@/components/icons";

const initialState: ContactActionState = { error: null, success: false };

/**
 * The landing's primary CTA (ADR-0030 resolution 2). Public, anonymous --
 * no session required to submit, same as the calendar itself. `touch`
 * density on every control: this is a public form, filled from a phone
 * most of the time.
 *
 * Stays on the page after a successful submit and swaps the form for a
 * confirmation panel instead of navigating away -- there's nowhere more
 * useful to send someone who just asked to be contacted.
 */
export function ContactForm() {
  const [state, formAction, pending] = useActionState(submitContactRequest, initialState);

  if (state.success) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border bg-card p-8 text-center shadow-raised">
        <span className="flex size-12 items-center justify-center rounded-full bg-success-subtle text-success">
          <CheckIcon className="size-6" />
        </span>
        <h2 className="text-xl">Recibimos tu mensaje</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          Te vamos a contactar en breve para coordinar los próximos pasos.
        </p>
        <Link href="/" className={buttonVariants({ variant: "outline", size: "touch" })}>
          Volver al inicio
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-2xl border bg-card p-6 shadow-raised sm:p-7">
      <Field>
        <Label htmlFor="name">Nombre</Label>
        <Input id="name" name="name" autoComplete="name" required touch aria-invalid={!!state.error} />
      </Field>

      <Field>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          touch
          aria-invalid={!!state.error}
        />
      </Field>

      <Field>
        <Label htmlFor="phone">Teléfono (opcional)</Label>
        <Input id="phone" name="phone" type="tel" autoComplete="tel" touch />
      </Field>

      <Field>
        <Label htmlFor="businessType">Tu negocio (opcional)</Label>
        <Input id="businessType" name="businessType" placeholder="Consultorio, estudio de pilates, cancha…" touch />
        <FieldHint>Así sabemos de antemano de qué se trata.</FieldHint>
      </Field>

      <Field>
        <Label htmlFor="message">Contanos qué necesitás</Label>
        <Textarea
          id="message"
          name="message"
          required
          touch
          rows={4}
          placeholder="Cuántos servicios, cuánta gente reserva, cómo trabajás hoy…"
          aria-invalid={!!state.error}
        />
      </Field>

      <FormError>{state.error}</FormError>

      <Button type="submit" size="touch" disabled={pending} className="w-full">
        {pending ? "Enviando…" : "Enviar"}
      </Button>
    </form>
  );
}
