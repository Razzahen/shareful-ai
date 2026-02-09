import { enqueueIndexJob, isRegistered } from "@/lib/registry";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const owner = searchParams.get("owner");
  const repo = searchParams.get("repo");

  if (owner && repo && !(await isRegistered(owner, repo))) {
    await enqueueIndexJob(owner, repo);
  }

  return new Response(null, { status: 204 });
}
