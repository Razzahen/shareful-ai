import { NextResponse } from "next/server";
import { discoverShareSlugs } from "@/lib/github";
import { indexRepo } from "@/lib/indexer";
import { listRepos, registerRepo } from "@/lib/registry";

export async function GET() {
  try {
    const repos = await listRepos();
    return NextResponse.json({ repos });
  } catch (error) {
    console.error("Registry list error:", error);
    return NextResponse.json(
      { error: "Failed to list repos" },
      { status: 500 }
    );
  }
}

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

    const slugs = await discoverShareSlugs(owner, repo);
    if (slugs.length === 0) {
      return NextResponse.json(
        {
          error: `No shares found in ${owner}/${repo}. Create shares in shares/*/SHARE.md.`,
        },
        { status: 400 }
      );
    }

    const entry = await registerRepo(owner, repo);

    // Trigger initial indexing
    const indexed = await indexRepo(owner, repo);

    return NextResponse.json({
      message: `Registered ${owner}/${repo} and indexed ${indexed} shares`,
      entry,
      indexed,
    });
  } catch (error) {
    console.error("Registry error:", error);
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
