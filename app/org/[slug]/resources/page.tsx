import { listResources } from "@/app/actions/resources";
import { requireOrganizationMembership } from "@/app/actions/organizations";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { ResourceForm } from "./resource-form";

export default async function ResourcesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await requireOrganizationMembership(slug);
  const resources = await listResources(slug);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold">Recursos</h1>

      <ResourceForm organizationSlug={slug} />

      {resources.length === 0 ? (
        <p className="text-sm text-muted-foreground">Todavía no hay recursos.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {resources.map((resource) => (
            <Card key={resource.id}>
              <CardHeader>
                <CardTitle className="text-base">{resource.name}</CardTitle>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
