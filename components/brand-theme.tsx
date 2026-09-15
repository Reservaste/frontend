import { brandTheme } from "@reservaste/domain";
import { cn } from "cn";

/**
 * Wraps a subtree in an organization's accent colour (ADR-0020).
 *
 * Renders a plain div with no branding at all when the organization
 * hasn't set a colour, so the product default keeps applying rather than
 * some half-branded in-between state.
 *
 * The values are safe to interpolate because they are validated twice
 * over: a CHECK constraint on the column rejects anything that is not
 * #rrggbb, and brandTheme() returns null for anything that somehow got
 * past it. Neither of those is the UI, which is the point -- this column
 * is writable through PostgREST directly.
 */
export function BrandTheme({
  color,
  className,
  children,
}: {
  color: string | null;
  className?: string;
  children: React.ReactNode;
}) {
  const theme = brandTheme(color);

  if (!theme) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div
      data-brand
      className={cn(className)}
      style={
        {
          "--brand": theme.color,
          "--brand-foreground": theme.foreground,
          "--brand-hover": theme.hover,
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
}
