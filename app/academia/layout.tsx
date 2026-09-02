import { auth } from "@/auth";
import { redirect } from "next/navigation";

const PFRADAR_ACADEMIA_ROLE_ID = "1435807208830140416";

export default async function AcademiaLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();
  if (!session) redirect("/login");

  const canAccess = session.user?.permissions?.roles?.includes(PFRADAR_ACADEMIA_ROLE_ID) ?? false;
  if (!canAccess) redirect("/access-denied");

  return children;
}
