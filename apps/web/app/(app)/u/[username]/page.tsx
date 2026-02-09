import { Eye, FileText, TrendingUp } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShareCard } from "@/components/share-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getContributorProfile } from "@/lib/reputation";

export const dynamic = "force-dynamic";

export async function generateMetadata(props: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await props.params;
  const profile = await getContributorProfile(username);

  if (!profile) {
    return {};
  }

  const title = `${username}'s Profile`;
  const description = `${username}'s coding solutions on shareful.ai — ${profile.shares_count} shares`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
    },
    twitter: {
      card: "summary_large_image",
    },
    alternates: {
      canonical: `https://shareful.ai/u/${username}`,
    },
  };
}

export default async function ProfilePage(props: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await props.params;
  const profile = await getContributorProfile(username);

  if (!profile) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Profile header */}
      <div className="flex items-start gap-6">
        <Avatar className="h-20 w-20">
          <AvatarImage
            alt={username}
            src={`https://github.com/${username}.png`}
          />
          <AvatarFallback className="text-xl">
            {username.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 space-y-2">
          <h1 className="font-bold text-2xl">{username}</h1>
          <div className="flex items-center gap-6 text-muted-foreground text-sm">
            <span className="flex items-center gap-1.5">
              <FileText className="h-4 w-4" />
              {profile.shares_count} shares
            </span>
            <span className="flex items-center gap-1.5">
              <Eye className="h-4 w-4" />
              {profile.total_views} total views
            </span>
            {profile.avg_success_rate > 0 && (
              <span className="flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4" />
                {Math.round(profile.avg_success_rate * 100)}% success rate
              </span>
            )}
          </div>
        </div>
        <Card className="w-32 text-center">
          <CardContent className="py-4">
            <p className="font-bold text-3xl">{Math.round(profile.score)}</p>
            <p className="text-muted-foreground text-xs">reputation</p>
          </CardContent>
        </Card>
      </div>

      <Separator className="my-8" />

      {/* Shares list */}
      <div className="space-y-4">
        <h2 className="font-semibold text-lg">Shares</h2>
        {profile.shares.length > 0 ? (
          <div className="space-y-3">
            {profile.shares.map((share) => (
              <ShareCard
                key={`${share.owner}/${share.repo}/${share.slug}`}
                share={share}
              />
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground">No shares yet.</p>
        )}
      </div>
    </div>
  );
}
