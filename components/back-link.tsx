import Link from "next/link";
import { cn } from "cn";
import { ChevronLeft } from "@/components/icons";

/**
 * The one way back. Always says where it goes ("Clientes", not "Volver"):
 * a back link that names its destination is the difference between
 * trusting it and having to try it.
 */
export function BackLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        // Negative margin so the text lines up with the content below it
        // while the tap target still covers the comfortable 44px.
        "group -ml-2 inline-flex w-fit items-center gap-1 rounded-lg px-2 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        className,
      )}
    >
      <ChevronLeft className="size-4 transition-transform group-hover:-translate-x-0.5" />
      {children}
    </Link>
  );
}
