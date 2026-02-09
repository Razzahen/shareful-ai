import { Badge } from "@/components/ui/badge";
import type { SolutionType } from "@/lib/types";

const typeColors: Record<SolutionType, string> = {
  fix: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  workaround:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  pattern: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  reference:
    "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  config:
    "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
};

export function SolutionTypeBadge({ type }: { type: SolutionType }) {
  return (
    <Badge
      className={`font-medium text-xs ${typeColors[type]}`}
      variant="secondary"
    >
      {type}
    </Badge>
  );
}
