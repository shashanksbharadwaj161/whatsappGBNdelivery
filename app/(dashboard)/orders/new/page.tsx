import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { NewOrderForm } from "@/components/orders/NewOrderForm";

export default async function NewOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ name?: string; phone?: string; conversationId?: string }>;
}) {
  const { name, phone, conversationId } = await searchParams;

  return (
    <div>
      <Link href="/orders" className="mb-4 inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft size={14} /> Back to orders
      </Link>
      <PageHeader title="New order" description="Create an order from a WhatsApp chat or manually." />
      <NewOrderForm prefill={{ customerName: name, phone, conversationId }} />
    </div>
  );
}
