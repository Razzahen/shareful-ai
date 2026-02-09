import { NextResponse } from "next/server";
import { getContributorProfile } from "@/lib/reputation";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;

    if (!username || username.trim().length === 0) {
      return NextResponse.json({ error: "Invalid username" }, { status: 400 });
    }

    const profile = await getContributorProfile(username);

    if (!profile) {
      return NextResponse.json(
        { error: `No contributor found: ${username}` },
        { status: 404 }
      );
    }

    return NextResponse.json(profile);
  } catch (error) {
    console.error("Profile error:", error);
    return NextResponse.json(
      { error: "Failed to fetch profile" },
      { status: 500 }
    );
  }
}
