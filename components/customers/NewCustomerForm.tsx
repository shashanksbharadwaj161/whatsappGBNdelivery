"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Card, CardContent } from "@/components/ui/Card";
import { createCustomerAction } from "@/lib/actions/customers";

export function NewCustomerForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>
        <Plus size={16} /> New customer
      </Button>
    );
  }

  return (
    <Card className="mb-4 w-full max-w-md">
      <CardContent>
        <div className="mb-3 flex items-center justify-between">
          <p className="font-medium text-ink">New customer</p>
          <button onClick={() => setOpen(false)} className="text-ink-muted hover:text-ink">
            <X size={16} />
          </button>
        </div>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            startTransition(async () => {
              try {
                await createCustomerAction({ name, phone, email: email.trim() || undefined });
                setOpen(false);
                setName("");
                setPhone("");
                setEmail("");
                router.refresh();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Could not create customer");
              }
            });
          }}
        >
          <div>
            <Label htmlFor="new-cust-name">Name</Label>
            <Input id="new-cust-name" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="new-cust-phone">Phone</Label>
            <Input
              id="new-cust-phone"
              required
              placeholder="+91 98xxxxxxxx"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div><Label htmlFor="new-cust-email">Email (optional)</Label><Input id="new-cust-email" type="email" value={email} onChange={e=>setEmail(e.target.value)}/></div>
          {error && <p className="text-sm text-status-cancelled">{error}</p>}
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Saving…" : "Save customer"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
