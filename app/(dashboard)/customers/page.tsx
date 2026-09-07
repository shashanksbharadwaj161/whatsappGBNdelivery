import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";

export default function CustomersPage() {
  return (
    <div>
      <PageHeader title="Customers" description="Profiles, order history, and subscriptions." />
      <Card>
        <CardContent className="text-sm text-ink-muted">
          Customer management is wired up in Phase 1.
        </CardContent>
      </Card>
    </div>
  );
}
