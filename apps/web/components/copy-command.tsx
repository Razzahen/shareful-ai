"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

export function CopyCommand({
  command = "npx shareful-ai init",
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
    <div className="space-y-3">
      <p className="font-mono text-white/60 text-xs uppercase tracking-widest">
        Set up in 30 seconds — free and open source
      </p>
      <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-3">
        <code className="font-mono text-sm text-white/80">$ {command}</code>
        <button
          aria-label={copied ? "Copied" : "Copy command"}
          className="ml-3 rounded-md p-1.5 text-white/40 transition-colors hover:bg-white/10 hover:text-white/70"
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
    </div>
  );
}
