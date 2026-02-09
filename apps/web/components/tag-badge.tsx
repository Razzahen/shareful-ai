import { Badge } from "@/components/ui/badge";

export function TagBadge({ tag }: { tag: string }) {
  return (
    <Badge className="font-normal text-xs" variant="outline">
      {tag}
    </Badge>
  );
}
