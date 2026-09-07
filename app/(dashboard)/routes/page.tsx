import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";

export default function RoutesPage() {
  return (
    <div>
      <PageHeader title="Routes" description="Optimize and review the driver's delivery route." />
      <Card>
        <CardContent className="text-sm text-ink-muted">
          Route optimization is wired up in Phase 4.
        </CardContent>
      </Card>
    </div>
  );
}
