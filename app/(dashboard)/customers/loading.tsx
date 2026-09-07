import { Skeleton } from "@/components/ui/Skeleton";
import { Card } from "@/components/ui/Card";

export default function CustomersLoading() {
  return (
    <div>
      <div className="mb-4">
        <Skeleton className="mb-1 h-7 w-32" />
        <Skeleton className="h-4 w-56" />
      </div>
      <Skeleton className="mb-4 h-10 w-36 rounded-lg" />
      <Card className="divide-y divide-border">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-6 px-4 py-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-48" />
          </div>
        ))}
      </Card>
    </div>
  );
}
