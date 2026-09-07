import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";

export default function AnalyticsPage() {
  return (
    <div>
      <PageHeader title="Analytics" description="Orders, milk volume, revenue, and distance." />
      <Card>
        <CardContent className="text-sm text-ink-muted">
          Analytics is wired up in Phase 7.
        </CardContent>
      </Card>
    </div>
  );
}
