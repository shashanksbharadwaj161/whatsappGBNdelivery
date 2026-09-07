import Link from "next/link";
import { SearchX } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default function DashboardNotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="max-w-sm text-center">
        <CardContent className="flex flex-col items-center gap-3 py-8">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-alt text-ink-muted">
            <SearchX size={22} />
          </span>
          <div>
            <p className="font-display text-lg text-ink">Not found</p>
            <p className="mt-1 text-sm text-ink-muted">
              That record doesn&rsquo;t exist, or may have been removed.
            </p>
          </div>
          <Link href="/dashboard">
            <Button variant="outline" size="sm">
              Back to dashboard
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
