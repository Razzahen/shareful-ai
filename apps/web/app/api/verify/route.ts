import { NextResponse } from "next/server";
import { recordVerification } from "@/lib/reputation";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { share_path, github_user } = body;

    if (!share_path || typeof share_path !== "string") {
      return NextResponse.json(
        {
          error: "Missing required field: share_path (format: owner/repo/slug)",
        },
        { status: 400 }
      );
    }

    if (!github_user || typeof github_user !== "string") {
      return NextResponse.json(
        { error: "Missing required field: github_user" },
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
    const result = await recordVerification(owner, repo, slug, github_user);

    if (result.alreadyVerified) {
      return NextResponse.json({
        message: "Already verified by this user",
        count: result.count,
      });
    }

    return NextResponse.json({
      message: "Verification recorded",
      count: result.count,
    });
  } catch (error) {
    console.error("Verify error:", error);
    return NextResponse.json(
      { error: "Failed to record verification" },
      { status: 500 }
    );
  }
}
