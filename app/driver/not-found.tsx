import Link from "next/link";
import { SearchX } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default function DriverNotFound() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-alt text-ink-muted">
          <SearchX size={22} />
        </span>
        <div>
          <p className="font-display text-lg text-ink">Route not found</p>
          <p className="mt-1 text-sm text-ink-muted">This route may have been re-optimized or removed.</p>
        </div>
        <Link href="/driver">
          <Button variant="outline" size="sm">
            Back to today&rsquo;s route
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
