"use client";

import { useState, useTransition } from "react";
import type { OrganizationTeamInvitation } from "@reservaste/domain";
import {
  issueTeamInvitation,
  revokeTeamInvitation,
  type IssuedTeamInvitation,
} from "@/app/actions/team-invitations";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status";
import { DataList, DataListRow } from "@/components/ui/table";
import {
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { TEAM_INVITATION_STATUS, expiresInLabel, isOpenInvitation } from "@/lib/team-invitation-status";
import { IssuedInvitation } from "./issued-invitation";

/**
 * ADR-0034: the invitations the owner sent, kept apart from the member list
 * on purpose -- a pending invitation is not a member, and mixing them would
 * lie about who is on the team.
 *
 * The "link nuevo" dialog lives here, at list level, and not in each row:
 * re-sending revokes the old invitation and creates a new one with another
 * id, so the revalidated list unmounts the old row -- a dialog owned by that
 * row would vanish together with the only copy of the new link.
 */
export function InvitationList({
  organizationSlug,
  invitations,
  timezone,
  now,
}: {
  organizationSlug: string;
  invitations: OrganizationTeamInvitation[];
  timezone: string;
  /** Rendered once on the server, so "vence en N h" never disagrees on hydration. */
  now: number;
}) {
  const [issued, setIssued] = useState<IssuedTeamInvitation | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const toast = useToast();

  const dateFormatter = new Intl.DateTimeFormat("es-UY", {
    timeZone: timezone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const resend = (invitation: OrganizationTeamInvitation) => {
    setPendingId(invitation.invitationId);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("email", invitation.email);
      if (invitation.displayName) formData.set("displayName", invitation.displayName);
      if (invitation.phone) formData.set("phone", invitation.phone);
      // The role chosen at issue time, not the effective one: null means
      // "the default", and has to keep meaning that.
      if (invitation.roleId) formData.set("roleId", invitation.roleId);

      const result = await issueTeamInvitation(
        organizationSlug,
        { error: null, success: null, invitation: null },
        formData,
      );
      setPendingId(null);

      if (result.error || !result.invitation) {
        toast.add({
          title: "No se pudo reenviar",
          description: result.error ?? undefined,
          type: "error",
          timeout: 0,
          priority: "high",
        });
        return;
      }
      setIssued(result.invitation);
    });
  };

  const revoke = (invitation: OrganizationTeamInvitation) => {
    setPendingId(invitation.invitationId);
    startTransition(async () => {
      const result = await revokeTeamInvitation(organizationSlug, invitation.invitationId);
      setPendingId(null);
      if (result.error) {
        toast.add({ title: result.error, type: "error", timeout: 0, priority: "high" });
      } else if (result.success) {
        toast.add({ title: result.success, type: "success" });
      }
    });
  };

  return (
    <>
      <DataList>
        {invitations.map((invitation) => {
          const status = TEAM_INVITATION_STATUS[invitation.status];
          const busy = pendingId === invitation.invitationId;

          return (
            <DataListRow key={invitation.invitationId} className="flex flex-col gap-2.5 px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-sm font-medium">
                    {invitation.displayName ?? invitation.email}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {invitation.email}
                    {invitation.phone ? ` · ${invitation.phone}` : " · sin teléfono"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Rol: {invitation.roleName ?? "por defecto"}
                  </span>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                  <span className="text-xs text-muted-foreground">
                    {invitation.status === "PENDING"
                      ? expiresInLabel(invitation.expiresAt, now)
                      : invitation.status === "REDEEMED" && invitation.redeemedAt
                        ? `el ${dateFormatter.format(new Date(invitation.redeemedAt))}`
                        : invitation.status === "REVOKED" && invitation.revokedAt
                          ? `el ${dateFormatter.format(new Date(invitation.revokedAt))}`
                          : invitation.status === "EXPIRED"
                            ? "el link ya no sirve"
                            : null}
                  </span>
                </div>
              </div>

              {isOpenInvitation(invitation.status) ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="touch"
                    disabled={busy}
                    onClick={() => resend(invitation)}
                    title="Genera un link nuevo. El anterior deja de funcionar."
                  >
                    {busy ? "Generando…" : "Reenviar (link nuevo)"}
                  </Button>
                  <ConfirmDialog
                    trigger={
                      <Button variant="ghost" size="touch" disabled={busy}>
                        Revocar
                      </Button>
                    }
                    title="¿Revocar esta invitación?"
                    description="El link deja de funcionar y libera el lugar en el equipo. Si después querés sumar a esta persona, la invitás de nuevo."
                  >
                    <Button
                      variant="destructive"
                      size="touch"
                      className="w-full"
                      disabled={busy}
                      onClick={() => revoke(invitation)}
                    >
                      Sí, revocar
                    </Button>
                  </ConfirmDialog>
                </div>
              ) : null}
            </DataListRow>
          );
        })}
      </DataList>

      <Dialog
        open={issued !== null}
        onOpenChange={(open) => {
          // Closing drops the link from memory: it is shown once.
          if (!open) setIssued(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link nuevo listo</DialogTitle>
            <DialogDescription>El link anterior ya no funciona. Mandá éste.</DialogDescription>
          </DialogHeader>
          {issued ? <IssuedInvitation invitation={issued} /> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
