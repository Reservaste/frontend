"use client";

import { forwardRef, useState } from "react";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { cn } from "cn";
import { AlertCircleIcon } from "@/components/icons";

/**
 * Cloudflare Turnstile widget (ADR-0043, corrección post-review de
 * seguridad, punto 5).
 *
 * GoTrue requires `captcha_token` on both `signUp()` and
 * `signInWithPassword()` once `[auth.captcha]` is enabled in Supabase --
 * not just on signup -- so this widget is meant to sit in every
 * email/password auth form, not just `/signup`.
 *
 * Usage:
 *
 *   const captchaRef = useRef<TurnstileInstance>(null);
 *   const [captchaToken, setCaptchaToken] = useState<string | null>(null);
 *   <input type="hidden" name="captchaToken" value={captchaToken ?? ""} />
 *   <CaptchaWidget ref={captchaRef} onTokenChange={setCaptchaToken} />
 *
 * The token is passed through a plain hidden input rather than lifted into
 * the server action directly, matching this product's rule (components/ui/form.tsx):
 * every form here is `<form action={serverAction}>` + `useActionState`, no
 * form library layered on top.
 *
 * ADR-0043 (segundo pase de seguridad, hallazgo M1): Turnstile tokens are
 * single-use. If a submit fails for any reason (wrong password, a rejected
 * signup, ...) and the form is resubmitted, the hidden input still carries
 * the already-consumed token -- Cloudflare answers "timeout-or-duplicate"
 * and GoTrue reports it as a captcha error on every retry, even once the
 * person fixes what was actually wrong. Callers must reset the widget (via
 * this forwarded ref's `.reset()`) whenever the server action returns a new
 * error, so the person always retries against a fresh token.
 */

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

export interface CaptchaWidgetProps {
  onTokenChange: (token: string | null) => void;
  className?: string;
}

export const CaptchaWidget = forwardRef<TurnstileInstance, CaptchaWidgetProps>(
  function CaptchaWidget({ onTokenChange, className }, ref) {
    const [error, setError] = useState<string | null>(null);

    if (!SITE_KEY) {
      // Fail loudly, never silently: a signup/login form without a captcha
      // token will be rejected by GoTrue anyway once [auth.captcha] is on
      // (local and, eventually, production) -- better to say so here than to
      // let the person fill the whole form and fail at submit with no clue
      // why.
      return (
        <p role="alert" className="flex items-start gap-1.5 text-sm text-destructive">
          <AlertCircleIcon className="mt-0.5 size-4 shrink-0" />
          <span>
            Falta configurar la verificación anti-spam (NEXT_PUBLIC_TURNSTILE_SITE_KEY). Avisá al
            negocio.
          </span>
        </p>
      );
    }

    return (
      <div className={cn("flex flex-col gap-1.5", className)}>
        <Turnstile
          ref={ref}
          siteKey={SITE_KEY}
          options={{ size: "flexible", theme: "light" }}
          onSuccess={(token) => {
            setError(null);
            onTokenChange(token);
          }}
          onExpire={() => {
            // Turnstile tokens expire after a few minutes -- someone who
            // fills the rest of the form slowly can hit this before
            // submitting. The widget auto-refreshes itself (default
            // refreshExpired="auto"); this just clears the stale token so a
            // submit can't sneak through with it and explains the fresh
            // widget that just appeared.
            onTokenChange(null);
            setError("La verificación expiró. Completala de nuevo antes de continuar.");
          }}
          onError={() => {
            onTokenChange(null);
            setError("No pudimos cargar la verificación anti-spam. Recargá la página e intentá de nuevo.");
          }}
        />
        {error ? (
          <p role="alert" className="flex items-start gap-1.5 text-sm text-destructive">
            <AlertCircleIcon className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </p>
        ) : null}
      </div>
    );
  },
);
