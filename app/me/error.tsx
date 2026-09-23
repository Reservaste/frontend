"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { AlertTriangleIcon } from "@/components/icons";

/**
 * Error boundary for the customer portal.
 *
 * The app-level one (app/error.tsx) replaces the whole page, header and
 * section bar included, and offers "Ir al inicio" -- which for someone
 * looking at their classes means losing the portal entirely. This one
 * renders inside the portal layout, so the tabs stay: if Agenda fails to
 * load, Pagos and Créditos are still one tap away instead of gone.
 */
export default function MePortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-5 px-5 py-12 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-destructive-subtle text-destructive">
        <AlertTriangleIcon className="size-6" />
      </span>
      <div className="flex flex-col gap-2">
        <h1 className="text-xl">No pudimos cargar tu agenda</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Fue un problema nuestro, no algo que hayas hecho. Tus reservas siguen como estaban.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="button" size="touch" onClick={() => reset()}>
          Volver a intentar
        </Button>
        <Link href="/me/creditos" className={buttonVariants({ variant: "outline", size: "touch" })}>
          Ver mis créditos
        </Link>
      </div>
    </div>
  );
}
