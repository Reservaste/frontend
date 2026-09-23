"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Brand } from "@/components/brand";
import { AlertTriangleIcon } from "@/components/icons";

/**
 * App-level error boundary. Next requires this to be a Client Component
 * (`error.tsx` render happens client-side so it can offer `reset()`), and it
 * has to stay defensive: this is what renders when something *else* already
 * broke, so it doesn't fetch data, doesn't read session state, doesn't do
 * anything that could itself throw. Two exits, not one -- `reset()` re-renders
 * the segment in place (the right call for a transient failure, a flaky
 * request), `Link href="/"` always works because it doesn't depend on
 * whatever broke still being broken (the right call if the error is
 * sticky). Without this, an uncaught error fell through to Next's own
 * unbranded default with no way out, which is exactly the "callejón sin
 * salida" `architecture.md` § Navegación rules out.
 */
export default function GlobalError({
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
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-5 py-10 text-center">
      <Brand />
      <div className="flex flex-col items-center gap-2">
        <span className="flex size-12 items-center justify-center rounded-full bg-destructive-subtle text-destructive">
          <AlertTriangleIcon className="size-6" />
        </span>
        <h1 className="text-xl">Algo salió mal</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Tuvimos un problema para mostrar esta página. Podés volver a intentar o volver al inicio.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="button" size="touch" onClick={() => reset()}>
          Volver a intentar
        </Button>
        <Link href="/" className={buttonVariants({ variant: "outline", size: "touch" })}>
          Ir al inicio
        </Link>
      </div>
    </div>
  );
}
