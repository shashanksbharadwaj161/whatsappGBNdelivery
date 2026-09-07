import { Skeleton } from "@/components/ui/Skeleton";
import { Card, CardContent } from "@/components/ui/Card";

export default function RoutesLoading() {
  return (
    <div>
      <div className="mb-6">
        <Skeleton className="mb-1 h-7 w-24" />
        <Skeleton className="h-4 w-72" />
      </div>
      <Card>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-10 w-40" />
        </CardContent>
      </Card>
    </div>
  );
}
