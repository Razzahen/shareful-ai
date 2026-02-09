import { Eye, FileText, TrendingUp } from "lucide-react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import type { Reputation } from "@/lib/types";

export function ContributorCard({
  username,
  reputation,
  rank,
}: {
  username: string;
  reputation: Reputation;
  rank?: number;
}) {
  return (
    <Link href={`/u/${username}`}>
      <Card className="transition-colors hover:bg-accent/50">
        <CardContent className="flex items-center gap-4 py-4">
          {rank && (
            <span className="w-8 text-center font-bold text-lg text-muted-foreground">
              #{rank}
            </span>
          )}
          <Avatar className="h-10 w-10">
            <AvatarImage
              alt={username}
              src={`https://github.com/${username}.png`}
            />
            <AvatarFallback>
              {username.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <p className="font-medium">{username}</p>
            <div className="flex items-center gap-3 text-muted-foreground text-xs">
              <span className="flex items-center gap-1">
                <FileText className="h-3 w-3" />
                {reputation.shares_count} shares
              </span>
              <span className="flex items-center gap-1">
                <Eye className="h-3 w-3" />
                {reputation.total_views} views
              </span>
              {reputation.avg_success_rate > 0 && (
                <span className="flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  {Math.round(reputation.avg_success_rate * 100)}% success
                </span>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="font-bold text-lg">{Math.round(reputation.score)}</p>
            <p className="text-muted-foreground text-xs">score</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
