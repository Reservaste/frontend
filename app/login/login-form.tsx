"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signInWithGoogle, signInWithPassword, type AuthActionState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: AuthActionState = { error: null };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(signInWithPassword, initialState);

  return (
    <div className="flex flex-col gap-6">
      <form action={formAction} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Contraseña</Label>
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </div>
        {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Ingresando..." : "Ingresar"}
        </Button>
      </form>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <div className="h-px flex-1 bg-border" />
        o
        <div className="h-px flex-1 bg-border" />
      </div>

      <form action={signInWithGoogle}>
        <Button type="submit" variant="outline" className="w-full">
          Continuar con Google
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        ¿No tenés cuenta?{" "}
        <Link href="/signup" className="font-medium text-foreground underline underline-offset-4">
          Creá una
        </Link>
      </p>
    </div>
  );
}
