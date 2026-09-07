import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";

export default function DashboardPage() {
  return (
    <div>
      <PageHeader title="Dashboard" description="Today at a glance." />
      <Card>
        <CardContent className="text-sm text-ink-muted">
          Today&rsquo;s orders, route summary, and revenue will appear here
          once orders and routing are wired up.
        </CardContent>
      </Card>
    </div>
  );
}
