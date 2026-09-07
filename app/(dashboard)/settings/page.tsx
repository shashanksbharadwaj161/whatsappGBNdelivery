import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";

export default function SettingsPage() {
  return (
    <div>
      <PageHeader title="Settings" description="Default delivery start location and business config." />
      <Card>
        <CardContent className="text-sm text-ink-muted">
          Settings is wired up in Phase 7.
        </CardContent>
      </Card>
    </div>
  );
}
