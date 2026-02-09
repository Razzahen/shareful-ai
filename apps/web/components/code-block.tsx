"use client";

import { Check, Copy } from "lucide-react";
import { type ReactNode, useRef, useState } from "react";

export function CodeBlock({
  children,
  language,
}: {
  children: ReactNode;
  language?: string;
}) {
  const preRef = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const text = preRef.current?.textContent ?? "";
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="group relative my-6 overflow-hidden rounded-xl border bg-code text-code-foreground">
      {language && (
        <div className="border-b px-4 py-2 font-mono text-muted-foreground text-xs">
          {language}
        </div>
      )}
      <div className="relative">
        <button
          aria-label={copied ? "Copied" : "Copy code"}
          className="absolute top-3 right-3 z-10 cursor-pointer rounded-md p-1.5 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
          onClick={handleCopy}
          type="button"
        >
          {copied ? (
            <Check aria-hidden="true" className="h-4 w-4" />
          ) : (
            <Copy aria-hidden="true" className="h-4 w-4" />
          )}
        </button>
        <pre className="overflow-x-auto p-4 font-mono text-sm" ref={preRef}>
          {children}
        </pre>
      </div>
    </div>
  );
}
