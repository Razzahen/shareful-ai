"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

export function CopyCommand({
  command = "npx shareful-ai skills",
}: {
  command?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="mx-auto flex w-full items-center justify-between gap-4 rounded-md bg-muted/80 px-4 py-3 font-mono text-foreground text-sm sm:max-w-[348px] lg:mx-0">
      <code className="truncate">
        <span className="text-muted-foreground">$</span> {command}
      </code>
      <button
        aria-label={copied ? "Copied" : "Copy command"}
        className="cursor-pointer rounded p-1.5 text-muted-foreground transition-colors hover:text-foreground"
        onClick={handleCopy}
        type="button"
      >
        {copied ? (
          <Check aria-hidden="true" className="h-4 w-4" />
        ) : (
          <Copy aria-hidden="true" className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}
