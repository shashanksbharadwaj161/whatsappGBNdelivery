import { Skeleton } from "@/components/ui/Skeleton";
import { Card, CardContent } from "@/components/ui/Card";

export default function DashboardLoading() {
  return (
    <div>
      <Skeleton className="mb-1 h-7 w-40" />
      <Skeleton className="mb-6 h-4 w-56" />
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardContent>
              <Skeleton className="mb-3 h-3 w-24" />
              <Skeleton className="h-6 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
