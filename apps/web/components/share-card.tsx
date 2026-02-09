import { CheckCircle, Eye, TrendingUp } from "lucide-react";
import Link from "next/link";
import { SolutionTypeBadge } from "@/components/solution-type-badge";
import { TagBadge } from "@/components/tag-badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ShareWithStats } from "@/lib/types";

export function ShareCard({ share }: { share: ShareWithStats }) {
  const successPercent =
    share.successRate !== null
      ? `${Math.round(share.successRate * 100)}%`
      : null;

  return (
    <Link href={`/s/${share.owner}/${share.repo}/${share.slug}`}>
      <Card className="transition-colors hover:bg-accent/50">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1">
              <CardTitle className="text-base leading-snug">
                {share.title}
              </CardTitle>
              <CardDescription className="line-clamp-2">
                {share.problem}
              </CardDescription>
            </div>
            <SolutionTypeBadge type={share.solution_type} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-1.5">
            {share.tags.slice(0, 5).map((tag) => (
              <TagBadge key={tag} tag={tag} />
            ))}
          </div>
          <div className="mt-3 flex items-center gap-4 text-muted-foreground text-xs">
            <span className="flex items-center gap-1">
              <Eye className="h-3 w-3" />
              {share.views}
            </span>
            {successPercent && (
              <span className="flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                {successPercent} success
              </span>
            )}
            {share.verifications > 0 && (
              <span className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3" />
                {share.verifications} verified
              </span>
            )}
            <span className="ml-auto">
              {share.owner}/{share.repo}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
