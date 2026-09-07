import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";

export default function InboxPage() {
  return (
    <div>
      <PageHeader title="Inbox" description="WhatsApp conversations with customers." />
      <Card>
        <CardContent className="text-sm text-ink-muted">
          The WhatsApp inbox is wired up in Phase 2.
        </CardContent>
      </Card>
    </div>
  );
}
