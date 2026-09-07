import { redirect } from "next/navigation";
import { getOptionalUser } from "@/lib/auth/guard";

export default async function RootPage() {
  const user = await getOptionalUser();

  if (!user) {
    redirect("/login");
  }

  redirect(user.role === "DRIVER" ? "/driver" : "/dashboard");
}
