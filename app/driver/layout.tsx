import { redirect } from "next/navigation";
import { getOptionalUser } from "@/lib/auth/guard";
import { SignOutButton } from "@/components/layout/SignOutButton";
import { Leaf } from "lucide-react";

export default async function DriverLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getOptionalUser();

  if (!user || (user.role !== "OWNER" && user.role !== "DRIVER")) {
    redirect("/login");
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-bg">
      <header className="flex h-14 items-center justify-between border-b border-border bg-surface px-4">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white">
            <Leaf size={16} />
          </span>
          <span className="font-display text-sm font-semibold text-ink">
            Driver Route
          </span>
        </div>
        <SignOutButton />
      </header>
      <main className="flex-1 px-4 py-4">{children}</main>
    </div>
  );
}
