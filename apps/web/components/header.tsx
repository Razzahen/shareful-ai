"use client";

import Image from "next/image";
import Link from "next/link";

import { ShareSearchInput } from "@/components/share-search-input";

export function Header() {
  return (
    <header className="flex min-h-[64px] w-full shrink-0 flex-wrap items-center justify-between border-0 border-border border-b border-solid md:flex-nowrap">
      <a
        className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:bg-background focus:p-2 focus:text-foreground"
        href="#main-content"
      >
        Skip to content
      </a>
      <div className="flex w-1/3 justify-start pl-4 md:pl-6">
        <div className="flex items-center gap-3">
          <Link className="flex items-center gap-2 font-semibold" href="/">
            <Image
              alt=""
              className="size-6"
              height={24}
              src="/logo.svg"
              width={24}
            />
            <span className="font-semibold text-lg tracking-tight">
              shareful.ai
            </span>
          </Link>
        </div>
      </div>
      <div className="order-1 flex w-full items-center justify-center border-0 border-border border-t border-solid px-4 py-3 md:order-none md:border-none md:px-5 md:py-0">
        <div className="w-full min-w-0 max-w-[520px]">
          <ShareSearchInput />
        </div>
      </div>
      <div className="flex min-h-[64px] w-1/3 select-none items-center justify-end gap-3 pr-4 md:pr-6">
        <a
          className="text-muted-foreground text-sm transition-colors hover:text-foreground"
          href="/docs"
        >
          Docs
        </a>
      </div>
    </header>
  );
}
