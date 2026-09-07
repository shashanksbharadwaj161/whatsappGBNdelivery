import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { DateRangeFilter } from "@/components/analytics/DateRangeFilter";
import { CustomRangeForm } from "@/components/analytics/CustomRangeForm";
import { getAnalyticsSummary } from "@/lib/services/analytics";
import { todayBusinessDateString, addDaysToBusinessDateString } from "@/lib/tz";

function resolveRange(range: string | undefined, from: string | undefined, to: string | undefined) {
  const today = todayBusinessDateString();
  switch (range) {
    case "yesterday": {
      const y = addDaysToBusinessDateString(today, -1);
      return { from: y, to: y, active: "yesterday" };
    }
    case "7d":
      return { from: addDaysToBusinessDateString(today, -6), to: today, active: "7d" };
    case "30d":
      return { from: addDaysToBusinessDateString(today, -29), to: today, active: "30d" };
    case "custom":
      return { from: from || today, to: to || today, active: "custom" };
    default:
      return { from: today, to: today, active: "today" };
  }
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const { range, from, to } = await searchParams;
  const resolved = resolveRange(range, from, to);
  const summary = await getAnalyticsSummary(resolved.from, resolved.to);

  return (
    <div>
      <PageHeader title="Analytics" description="Orders, milk volume, revenue, and distance." />
      <DateRangeFilter active={resolved.active} />
      <CustomRangeForm defaultFrom={resolved.from} defaultTo={resolved.to} />

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Orders" value={summary.orders.total} />
        <Stat label="Delivered" value={summary.orders.delivered} />
        <Stat label="Cancelled" value={summary.orders.cancelled} />
        <Stat label="Revenue" value={`₹${summary.revenue.toFixed(0)}`} />
        <Stat label="Milk delivered" value={`${summary.milk.totalLitres.toFixed(1)} L`} />
        <Stat label="500 ml orders" value={summary.milk.ml500Units} />
        <Stat label="1 L orders" value={summary.milk.l1Units} />
        <Stat label="Distance" value={`${summary.distance.totalKm.toFixed(1)} km`} />
        <Stat label="Avg km / delivery" value={summary.distance.avgKmPerDelivery.toFixed(2)} />
        <Stat label="Driving time" value={`${Math.round(summary.distance.totalDrivingMinutes)} min`} />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardContent>
            <p className="mb-3 font-medium text-ink">Orders by area</p>
            <Table rows={summary.ordersByArea.map((r) => [r.area, String(r.orders)])} headers={["Area", "Orders"]} />
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="mb-3 font-medium text-ink">Customers by area</p>
            <Table rows={summary.customersByArea.map((r) => [r.area, String(r.customers)])} headers={["Area", "Customers"]} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent>
        <p className="font-display text-xl text-ink">{value}</p>
        <p className="text-xs text-ink-muted">{label}</p>
      </CardContent>
    </Card>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <table className="w-full text-sm">
      <thead className="text-left text-xs font-medium uppercase tracking-wide text-ink-muted">
        <tr>
          {headers.map((h) => (
            <th key={h} className="py-2 pr-4">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {rows.map((row, i) => (
          <tr key={i}>
            {row.map((cell, j) => (
              <td key={j} className="py-2 pr-4 text-ink">
                {cell}
              </td>
            ))}
          </tr>
        ))}
        {rows.length === 0 && (
          <tr>
            <td colSpan={headers.length} className="py-6 text-center text-ink-muted">
              No data for this range.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
