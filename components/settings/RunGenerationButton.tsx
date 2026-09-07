"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { runDailyGenerationNowAction } from "@/lib/actions/subscriptions";
import type { GenerationResult } from "@/lib/services/subscriptionGeneration";

export function RunGenerationButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<GenerationResult | null>(null);

  return (
    <div>
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const r = await runDailyGenerationNowAction();
            setResult(r);
            router.refresh();
          })
        }
      >
        <Play size={14} /> {pending ? "Running…" : "Run now"}
      </Button>
      {result && (
        <p className="mt-2 text-xs text-ink-muted">
          Created {result.created} · already existed {result.skippedAlreadyExists} · skipped by request{" "}
          {result.skippedByRequest} · missing location {result.skippedNoCoordinates}
          {result.errors.length > 0 && ` · ${result.errors.length} error(s)`}
        </p>
      )}
    </div>
  );
}
