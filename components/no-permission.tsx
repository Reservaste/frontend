import { Alert } from "@/components/ui/alert";

/**
 * ADR-0033: what a screen says when the viewer's role does not include what
 * it is for. Not the authorization -- RLS and each RPC are -- just the
 * honest version of "this page would be empty or fail for you".
 */
export function NoPermission({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <Alert tone="info" title={title}>
      {children ?? "Tu rol en este negocio no lo incluye. Si lo necesitás, pedíselo al dueño."}
    </Alert>
  );
}
