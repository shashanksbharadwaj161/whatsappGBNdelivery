import { redirect } from "next/navigation";
import { getOptionalUser } from "@/lib/auth/guard";
import { AppShell } from "@/components/layout/AppShell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getOptionalUser();

  if (!user || user.role !== "OWNER") {
    redirect("/login");
  }

  return (
    <AppShell userLabel={user.email} roleLabel="Owner">
      {children}
    </AppShell>
  );
}
