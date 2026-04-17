import type { ReactNode } from "react";
import { requireArchiveAccess } from "@/lib/archive-access";

export default async function IssuesLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireArchiveAccess();
  return <>{children}</>;
}
