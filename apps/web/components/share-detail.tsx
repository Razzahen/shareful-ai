import { format, parseISO } from "date-fns";
import { CheckCircle, ExternalLink, Eye, TrendingUp } from "lucide-react";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { SolutionTypeBadge } from "@/components/solution-type-badge";
import { TagBadge } from "@/components/tag-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { ShareWithStats } from "@/lib/types";

export function ShareDetail({ share }: { share: ShareWithStats }) {
  const successPercent =
    share.successRate !== null
      ? `${Math.round(share.successRate * 100)}%`
      : null;

  const githubUrl = `https://github.com/${share.owner}/${share.repo}/tree/main/shares/${share.slug}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <h1 className="font-bold text-2xl tracking-tight">{share.title}</h1>
          <SolutionTypeBadge type={share.solution_type} />
        </div>
        <p className="text-lg text-muted-foreground">{share.problem}</p>
        <div className="flex flex-wrap gap-1.5">
          {share.tags.map((tag) => (
            <TagBadge key={tag} tag={tag} />
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-muted-foreground text-sm">
        <span className="flex items-center gap-1.5">
          <Eye className="h-4 w-4" />
          {share.views} views
        </span>
        {successPercent && (
          <span className="flex items-center gap-1.5">
            <TrendingUp className="h-4 w-4" />
            {successPercent} success rate
          </span>
        )}
        {share.verifications > 0 && (
          <span className="flex items-center gap-1.5">
            <CheckCircle className="h-4 w-4" />
            {share.verifications} verifications
          </span>
        )}
        {share.verifications >= 3 && (
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
            Verified
          </Badge>
        )}
      </div>

      <Separator />

      {/* Content */}
      <MarkdownRenderer content={share.content} />

      <Separator />

      {/* Sidebar info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">About this share</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Contributor</span>
            <a
              className="font-medium hover:underline"
              href={`/u/${share.owner}`}
            >
              {share.owner}
            </a>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Repository</span>
            <span className="font-medium">
              {share.owner}/{share.repo}
            </span>
          </div>
          {share.created && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Created</span>
              <span>{format(parseISO(share.created), "MMM d, yyyy")}</span>
            </div>
          )}
          {share.environment && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Environment</span>
              <span>
                {[share.environment.framework, share.environment.version]
                  .filter(Boolean)
                  .join(" ")}
              </span>
            </div>
          )}
          <Separator />
          <a
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
            href={githubUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            View on GitHub
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
