import { redirect } from "next/navigation";

/** /atlas/<ws> opens the first step. */
export default async function WorkspaceIndex({ params }: { params: Promise<{ ws: string }> }) {
  const { ws } = await params;
  redirect(`/atlas/${encodeURIComponent(ws)}/detect`);
}
