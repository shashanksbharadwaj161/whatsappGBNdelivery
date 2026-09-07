import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { getDashboardSummary } from "@/lib/services/dashboard";

export default async function DashboardPage() {
  const summary = await getDashboardSummary();

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Today at a glance."
        actions={
          <Link href="/routes">
            <Button>Generate today&rsquo;s route</Button>
          </Link>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent>
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-ink-muted">
              Today&rsquo;s orders
            </p>
            <dl className="grid grid-cols-3 gap-2 text-center">
              <Stat label="Confirmed" value={summary.orders.confirmed} />
              <Stat label="Pending" value={summary.orders.pending} />
              <Stat label="Delivered" value={summary.orders.delivered} />
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-ink-muted">
              Today&rsquo;s route
            </p>
            {summary.route ? (
              <dl className="grid grid-cols-3 gap-2 text-center">
                <Stat label="Stops" value={summary.route.totalStops} />
                <Stat
                  label="Est. km"
                  value={summary.route.plannedDistanceKm?.toFixed(1) ?? "—"}
                />
                <Stat
                  label="Est. mins"
                  value={summary.route.plannedDurationMinutes ?? "—"}
                />
              </dl>
            ) : (
              <p className="py-4 text-center text-sm text-ink-muted">No route generated yet today.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-ink-muted">Revenue</p>
            <p className="font-display text-2xl text-ink">₹{summary.revenue.toFixed(0)}</p>
            <p className="mt-2 text-xs text-ink-muted">
              {summary.milk.ml500} × 500 ml · {summary.milk.l1} × 1 L
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="font-display text-xl text-ink">{value}</p>
      <p className="text-xs text-ink-muted">{label}</p>
    </div>
  );
}
