import Image from "next/image";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Image alt="" className="size-6" height={24} src="/logo.svg" width={24} />
      <span className="font-semibold text-lg tracking-tight">shareful.ai</span>
    </div>
  );
}
