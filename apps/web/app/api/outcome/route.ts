import { NextResponse } from "next/server";
import { recordOutcome } from "@/lib/reputation";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { share_path, outcome } = body;

    if (!share_path || typeof share_path !== "string") {
      return NextResponse.json(
        {
          error: "Missing required field: share_path (format: owner/repo/slug)",
        },
        { status: 400 }
      );
    }

    if (outcome !== "success" && outcome !== "failure") {
      return NextResponse.json(
        { error: "Invalid outcome. Must be 'success' or 'failure'" },
        { status: 400 }
      );
    }

    const parts = share_path.split("/");
    if (parts.length !== 3) {
      return NextResponse.json(
        { error: "Invalid share_path format. Expected: owner/repo/slug" },
        { status: 400 }
      );
    }

    const [owner, repo, slug] = parts;
    await recordOutcome(owner, repo, slug, outcome);

    return NextResponse.json({
      message: `Recorded ${outcome} for ${share_path}`,
    });
  } catch (error) {
    console.error("Outcome error:", error);
    return NextResponse.json(
      { error: "Failed to record outcome" },
      { status: 500 }
    );
  }
}
