"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { TurnstileInstance } from "@marsidev/react-turnstile";
import { signInWithGoogle, signInWithPassword, type AuthActionState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/ui/form";
import { CaptchaWidget } from "@/components/captcha-widget";

const initialState: AuthActionState = { error: null };

export function LoginForm({ returnTo }: { returnTo: string }) {
  const [state, formAction, pending] = useActionState(signInWithPassword, initialState);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRef = useRef<TurnstileInstance>(null);

  // ADR-0043 (segundo pase de seguridad, hallazgo M1): Turnstile tokens are
  // single-use. Every failed submit leaves the hidden input holding an
  // already-consumed token, so a retry would hit Cloudflare's
  // "timeout-or-duplicate" and read as "the captcha expired" even when the
  // real problem was the password. `state` is a fresh object on every
  // server action return, so this fires on every failed submit -- including
  // consecutive ones with the same error text (e.g. "Email o contraseña
  // incorrectos" twice in a row) -- not just when the message changes.
  useEffect(() => {
    if (state.error) {
      captchaRef.current?.reset();
      // captchaToken can't be derived from `state` during render: it mirrors
      // the widget's *own* async re-verification, which the `reset()` call
      // above just kicked off imperatively and which only resolves later
      // through `onSuccess`/`onExpire`. Clearing it here (not just relying on
      // those callbacks) keeps the submit button disabled for the instant
      // between the reset and the widget re-solving, so the already-consumed
      // token can't sneak through if someone double-clicks submit.
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
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required touch />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Contraseña</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            touch
          />
        </div>
        <CaptchaWidget ref={captchaRef} onTokenChange={setCaptchaToken} />
        <FormError>{state.error}</FormError>
        <Button type="submit" size="touch" disabled={pending || !captchaToken} className="w-full">
          {pending ? "Ingresando..." : "Ingresar"}
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
        ¿No tenés cuenta?{" "}
        <Link
          href={`/signup?returnTo=${encodeURIComponent(returnTo)}`}
          className="font-medium text-foreground underline underline-offset-4"
        >
          Creá una
        </Link>
      </p>
    </div>
  );
}
