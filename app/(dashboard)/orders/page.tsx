import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";

export default function OrdersPage() {
  return (
    <div>
      <PageHeader title="Orders" description="Today, tomorrow, and upcoming deliveries." />
      <Card>
        <CardContent className="text-sm text-ink-muted">
          Order management is wired up in Phase 1.
        </CardContent>
      </Card>
    </div>
  );
}
