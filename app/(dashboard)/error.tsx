"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="max-w-sm text-center">
        <CardContent className="flex flex-col items-center gap-3 py-8">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-status-cancelled-soft text-status-cancelled">
            <TriangleAlert size={22} />
          </span>
          <div>
            <p className="font-display text-lg text-ink">Something went wrong</p>
            <p className="mt-1 text-sm text-ink-muted">{error.message || "Please try again."}</p>
          </div>
          <Button size="sm" onClick={reset}>
            Try again
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
