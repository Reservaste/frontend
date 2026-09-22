"use client";

import { useState } from "react";
import type { Service } from "@reservaste/domain";
import type { ServicePlanWithUsage } from "@/app/actions/service-plans";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Field } from "@/components/ui/form";
import { DataList } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { PlanRow } from "./plan-forms";

/**
 * The full price list of the organization, with an optional filter by
 * service (product decision: filtering is a convenience, never a
 * requirement to see the whole list -- ADR-0029 is exactly the case where a
 * plan lives outside any single service).
 *
 * Client component only for the filter's local state: the list itself is
 * server-rendered data passed down as a prop, no extra round trip to filter.
 */
export function PlansList({
  organizationSlug,
  plans,
  services,
  canEdit,
  currency,
  initialServiceId,
}: {
  organizationSlug: string;
  plans: ServicePlanWithUsage[];
  services: Service[];
  canEdit: boolean;
  currency: string;
  /** Deep link from a service screen ("Ver todos los planes de X"). */
  initialServiceId?: string;
}) {
  const [serviceFilter, setServiceFilter] = useState(initialServiceId ?? "ALL");
  const serviceNameById = Object.fromEntries(services.map((s) => [s.id, s.name]));

  const filtered =
    serviceFilter === "ALL"
      ? plans
      : plans.filter(
          (plan) => plan.appliesToAllServices || plan.serviceIds.includes(serviceFilter),
        );

  return (
    <div className="flex flex-col gap-3">
      {services.length > 0 ? (
        <Field className="max-w-xs">
          <Label htmlFor="plan-service-filter">Filtrar por servicio</Label>
          <Select
            id="plan-service-filter"
            touch
            value={serviceFilter}
            onChange={(event) => setServiceFilter(event.target.value)}
          >
            <option value="ALL">Todos los servicios</option>
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}

      {filtered.length === 0 ? (
        <EmptyState size="sm" title="Ningún plan cubre este servicio." />
      ) : (
        <DataList>
          {filtered.map((plan) => (
            <PlanRow
              key={plan.id}
              organizationSlug={organizationSlug}
              plan={plan}
              currency={currency}
              canEdit={canEdit}
              serviceNameById={serviceNameById}
            />
          ))}
        </DataList>
      )}
    </div>
  );
}
