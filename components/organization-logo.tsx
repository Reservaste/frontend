import { cn } from "cn";
import { initialsOf, logoUrl } from "@/lib/logo";

/**
 * A business's logo, or its initials when it hasn't uploaded one.
 *
 * Plain <img>, not next/image: these come from a Supabase Storage host
 * that would have to be allow-listed in next.config, and a logo is
 * already size-capped at the bucket. `object-contain` because a logo has
 * its own aspect ratio and cropping one is worse than letterboxing it.
 */
export function OrganizationLogo({
  name,
  logoPath,
  size = "md",
  className,
}: {
  name: string;
  logoPath: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const url = logoUrl(logoPath);
  const box = {
    sm: "size-7 rounded-lg text-xs",
    md: "size-10 rounded-xl text-sm",
    lg: "size-14 rounded-2xl text-lg",
  }[size];

  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- see the note above
      <img
        src={url}
        alt={name}
        className={cn("shrink-0 bg-card object-contain", box, className)}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center bg-primary font-semibold text-primary-foreground",
        box,
        className,
      )}
    >
      {initialsOf(name)}
    </span>
  );
}
