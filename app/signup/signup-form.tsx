"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signInWithGoogle, signUpWithPassword, type AuthActionState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/ui/form";

const initialState: AuthActionState = { error: null, notice: null };

export function SignupForm({ returnTo }: { returnTo: string }) {
  const [state, formAction, pending] = useActionState(signUpWithPassword, initialState);

  return (
    <div className="flex flex-col gap-6">
      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="returnTo" value={returnTo} />
        <div className="flex flex-col gap-2">
          <Label htmlFor="fullName">Nombre completo</Label>
          <Input id="fullName" name="fullName" type="text" autoComplete="name" required touch />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required touch />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Contraseña</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            touch
          />
        </div>
        <FormError>{state.error}</FormError>
        {state.notice ? (
          <p className="rounded-md bg-muted p-3 text-sm">{state.notice}</p>
        ) : null}
        <Button type="submit" size="touch" disabled={pending} className="w-full">
          {pending ? "Creando cuenta..." : "Crear cuenta"}
        </Button>
      </form>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <div className="h-px flex-1 bg-border" />
        o
        <div className="h-px flex-1 bg-border" />
      </div>

      <form action={signInWithGoogle}>
        <input type="hidden" name="returnTo" value={returnTo} />
        <Button type="submit" variant="outline" size="touch" className="w-full">
          Continuar con Google
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        ¿Ya tenés cuenta?{" "}
        <Link
          href={`/login?returnTo=${encodeURIComponent(returnTo)}`}
          className="font-medium text-foreground underline underline-offset-4"
        >
          Ingresá
        </Link>
      </p>
    </div>
  );
}
