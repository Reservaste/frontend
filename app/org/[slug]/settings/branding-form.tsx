"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import type { Organization } from "@reservaste/domain";
import { brandTheme, isAccessibleAccent, normalizeBrandColor } from "@reservaste/domain";
import { removeLogo, setLogo, updateBrandColor } from "@/app/actions/branding";
import type { ActionState } from "@/app/actions/admin";
import { createClient } from "@/lib/supabase/client";
import { LOGO_BUCKET } from "@/lib/logo";
import { OrganizationLogo } from "@/components/organization-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: ActionState = { error: null, success: null };

// Mirrors the bucket's own limits. The bucket is what enforces them; this
// is here so a 4MB photo fails in a tenth of a second instead of after
// the upload.
const MAX_BYTES = 512 * 1024;
const ACCEPTED = ["image/png", "image/jpeg", "image/webp"];

const PRESETS = ["#0067e1", "#0f766e", "#7c3aed", "#db2777", "#ea580c", "#16a34a", "#111827"];

export function BrandingForm({
  organizationSlug,
  organization,
  canEdit,
}: {
  organizationSlug: string;
  organization: Organization;
  canEdit: boolean;
}) {
  const [color, setColor] = useState(organization.brandColor ?? "#0067e1");
  const [enabled, setEnabled] = useState(organization.brandColor !== null);
  const [colorState, colorAction, colorPending] = useActionState(
    updateBrandColor.bind(null, organizationSlug),
    initialState,
  );

  const [logoPath, setLogoPath] = useState(organization.logoPath);
  const [logoState, setLogoState] = useState<ActionState>(initialState);
  const [uploading, startUpload] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const normalized = normalizeBrandColor(color);
  const preview = brandTheme(enabled ? normalized : null);
  const lowContrast = normalized !== null && enabled && !isAccessibleAccent(normalized);

  async function upload(file: File) {
    setLogoState(initialState);

    if (!ACCEPTED.includes(file.type)) {
      setLogoState({ error: "Tiene que ser un PNG, JPG o WebP", success: null });
      return;
    }
    if (file.size > MAX_BYTES) {
      setLogoState({ error: "El archivo no puede pesar más de 512 KB", success: null });
      return;
    }

    const supabase = createClient();
    const extension = file.type.split("/")[1]!.replace("jpeg", "jpg");
    // Timestamped rather than a fixed "logo.png": replacing a logo at the
    // same path leaves the old one cached on the CDN, and the owner would
    // see their change not take.
    const path = `${organization.id}/logo-${Date.now()}.${extension}`;

    const { error } = await supabase.storage
      .from(LOGO_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });

    if (error) {
      setLogoState({ error: "No se pudo subir el archivo", success: null });
      return;
    }

    const result = await setLogo(organizationSlug, path);
    setLogoState(result);
    if (!result.error) setLogoPath(path);
  }

  return (
    <div className="flex flex-col gap-5 rounded-xl border bg-card p-5 shadow-card">
      <div className="flex flex-col gap-1">
        <h2 className="text-base">Identidad</h2>
        <p className="text-sm text-muted-foreground">
          Tu logo y tu color aparecen en la página donde reservan tus clientes y en este panel.
        </p>
      </div>

      {/* ---------------- Logo ---------------- */}
      <div className="flex flex-col gap-2.5">
        <Label>Logo</Label>
        <div className="flex flex-wrap items-center gap-3">
          <OrganizationLogo name={organization.name} logoPath={logoPath} size="lg" />

          <input
            ref={fileRef}
            type="file"
            accept={ACCEPTED.join(",")}
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) startUpload(() => upload(file));
              event.target.value = "";
            }}
          />

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!canEdit || uploading}
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? "Subiendo…" : logoPath ? "Cambiar logo" : "Subir logo"}
            </Button>
            {logoPath ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={!canEdit || uploading}
                onClick={() =>
                  startUpload(async () => {
                    const result = await removeLogo(organizationSlug);
                    setLogoState(result);
                    if (!result.error) setLogoPath(null);
                  })
                }
              >
                Quitar
              </Button>
            ) : null}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">PNG, JPG o WebP, hasta 512 KB.</p>
        {logoState.error ? <p className="text-sm text-destructive">{logoState.error}</p> : null}
        {logoState.success ? <p className="text-sm text-success">{logoState.success}</p> : null}
      </div>

      {/* ---------------- Colour ---------------- */}
      <form action={colorAction} className="flex flex-col gap-2.5 border-t pt-5">
        <Label htmlFor="brandColorPicker">Color principal</Label>

        <label className="flex w-fit items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={enabled}
            disabled={!canEdit}
            onChange={(event) => setEnabled(event.target.checked)}
            className="size-4 accent-primary"
          />
          Usar un color propio
        </label>

        {enabled ? (
          <div className="flex flex-wrap items-center gap-2">
            <input
              id="brandColorPicker"
              type="color"
              value={normalized ?? "#0067e1"}
              disabled={!canEdit}
              onChange={(event) => setColor(event.target.value)}
              className="size-9 cursor-pointer rounded-lg border bg-card p-1"
            />
            <Input
              value={color}
              disabled={!canEdit}
              onChange={(event) => setColor(event.target.value)}
              className="w-32 font-mono"
              aria-label="Color en hexadecimal"
            />
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  disabled={!canEdit}
                  onClick={() => setColor(preset)}
                  aria-label={`Usar ${preset}`}
                  className="size-7 rounded-full border transition-transform hover:scale-110"
                  style={{ backgroundColor: preset }}
                />
              ))}
            </div>
          </div>
        ) : null}

        {/* The value the form actually submits: empty means "product
            default", which is how the colour gets cleared. */}
        <input type="hidden" name="brandColor" value={enabled ? (normalized ?? "") : ""} />

        {enabled && normalized === null ? (
          <p className="text-sm text-destructive">Escribí un hexadecimal como #0067e1</p>
        ) : null}

        {lowContrast ? (
          <p className="rounded-lg bg-warning-subtle px-3 py-2 text-sm text-warning-foreground">
            Con ese color el texto de los botones queda difícil de leer. Podés guardarlo igual, pero
            probá uno un poco más oscuro o más claro.
          </p>
        ) : null}

        {/* Rendered with the same derived palette the real pages use, so
            this is the button, not a picture of it. */}
        <div
          data-brand={preview ? "" : undefined}
          style={
            preview
              ? ({
                  "--brand": preview.color,
                  "--brand-foreground": preview.foreground,
                  "--brand-hover": preview.hover,
                } as React.CSSProperties)
              : undefined
          }
          className="flex flex-wrap items-center gap-3 rounded-xl border bg-background px-4 py-3"
        >
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Vista previa
          </span>
          <Button type="button" size="sm" className="pointer-events-none">
            Reservar
          </Button>
          <span className="rounded-full bg-primary-subtle px-2.5 py-1 text-xs font-medium text-primary">
            3 lugares
          </span>
        </div>

        {colorState.error ? <p className="text-sm text-destructive">{colorState.error}</p> : null}
        {colorState.success ? <p className="text-sm text-success">{colorState.success}</p> : null}

        <Button
          type="submit"
          size="sm"
          className="self-start"
          disabled={!canEdit || colorPending || (enabled && normalized === null)}
        >
          {colorPending ? "Guardando…" : "Guardar color"}
        </Button>
      </form>

      {!canEdit ? (
        <p className="text-xs text-muted-foreground">Solo el dueño puede cambiar la identidad.</p>
      ) : null}
    </div>
  );
}
