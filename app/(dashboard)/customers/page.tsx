import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { NewCustomerForm } from "@/components/customers/NewCustomerForm";
import { listCustomers } from "@/lib/services/customers";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const customers = await listCustomers({ search: q });

  return (
    <div>
      <PageHeader title="Customers" description="Profiles, order history, and subscriptions." />

      <NewCustomerForm />

      <Card className="mt-2 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-alt text-left text-xs font-medium uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Default address</th>
                <th className="px-4 py-3">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {customers.map((c) => (
                <tr key={c.id} className="hover:bg-surface-alt/50">
                  <td className="px-4 py-3">
                    <Link href={`/customers/${c.id}`} className="font-medium text-primary hover:underline">
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-ink-muted">{c.phone}</td>
                  <td className="px-4 py-3 text-ink-muted">
                    {c.defaultAddress?.formattedAddress ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-ink-muted">
                    {c.createdAt.toLocaleDateString("en-IN")}
                  </td>
                </tr>
              ))}
              {customers.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-ink-muted">
                    No customers yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
