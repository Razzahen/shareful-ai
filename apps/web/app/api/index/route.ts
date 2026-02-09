import { NextResponse } from "next/server";
import { enqueueIndexJob, isRegistered, registerRepo } from "@/lib/registry";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const repoStr = typeof body.repo === "string" ? body.repo : "";
    const parts = repoStr.split("/");

    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      return NextResponse.json(
        { error: "Invalid repo format. Expected: owner/repo" },
        { status: 400 }
      );
    }

    const [owner, repo] = parts;

    // Auto-register if not already registered
    if (!(await isRegistered(owner, repo))) {
      await registerRepo(owner, repo);
    }

    await enqueueIndexJob(owner, repo);

    return NextResponse.json({
      message: `Queued indexing for ${owner}/${repo}`,
    });
  } catch (error) {
    console.error("Index error:", error);
    return NextResponse.json({ error: "Indexing failed" }, { status: 500 });
  }
}
