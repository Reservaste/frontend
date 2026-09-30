"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { TurnstileInstance } from "@marsidev/react-turnstile";
import { signInWithGoogle, signUpWithPassword, type AuthActionState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/ui/form";
import { CaptchaWidget } from "@/components/captcha-widget";

const initialState: AuthActionState = { error: null };

export function SignupForm({ returnTo }: { returnTo: string }) {
  const [state, formAction, pending] = useActionState(signUpWithPassword, initialState);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRef = useRef<TurnstileInstance>(null);

  // ADR-0043 (segundo pase de seguridad, hallazgo M1): ver el mismo
  // comentario en login-form.tsx -- el token de Turnstile es de un solo uso,
  // así que cada submit fallido deja el input oculto con un token ya
  // consumido. `state` es un objeto nuevo en cada retorno de la server
  // action, así que esto dispara en cada submit fallido, incluso cuando el
  // mensaje de error se repite igual entre reintentos.
  useEffect(() => {
    if (state.error) {
      captchaRef.current?.reset();
      // Ver el comentario en login-form.tsx: captchaToken no se puede
      // derivar de `state` durante el render, así que se limpia acá para
      // que el botón quede deshabilitado mientras el widget resuelve el
      // nuevo desafío que el reset() de arriba acaba de disparar.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCaptchaToken(null);
    }
  }, [state]);

  return (
    <div className="flex flex-col gap-6">
      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="returnTo" value={returnTo} />
        <input type="hidden" name="captchaToken" value={captchaToken ?? ""} />
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
        <CaptchaWidget ref={captchaRef} onTokenChange={setCaptchaToken} />
        <FormError>{state.error}</FormError>
        <Button type="submit" size="touch" disabled={pending || !captchaToken} className="w-full">
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
