import { Search } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <a
        className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:bg-background focus:p-2 focus:text-foreground"
        href="#main-content"
      >
        Skip to content
      </a>
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link className="flex items-center gap-2 font-semibold" href="/">
          <Image
            alt=""
            className="size-6"
            height={24}
            src="/logo.svg"
            width={24}
          />
          <span className="text-lg tracking-tight">shareful.ai</span>
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          <Link
            className="flex items-center gap-1.5 py-2 text-muted-foreground transition-colors hover:text-foreground"
            href="/search"
          >
            <Search aria-hidden="true" className="h-3.5 w-3.5" />
            Search
          </Link>
          <Link
            className="py-2 text-muted-foreground transition-colors hover:text-foreground"
            href="/docs"
          >
            Docs
          </Link>
          <Link
            className="py-2 text-muted-foreground transition-colors hover:text-foreground"
            href="/leaderboard"
          >
            Leaderboard
          </Link>
        </nav>
      </div>
    </header>
  );
}
