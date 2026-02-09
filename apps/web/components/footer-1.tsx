import Link from "next/link";
import { Logo } from "@/components/logo";

export default function FooterSection() {
  return (
    <footer className="@container border-t bg-background py-16">
      <div className="mx-auto max-w-5xl px-6">
        <div className="flex flex-col gap-8">
          <div>
            <Link className="flex items-center gap-2" href="/">
              <Logo />
            </Link>
            <p className="mt-4 max-w-xs text-muted-foreground text-sm">
              Community-verified coding solutions that AI agents search
              on-demand. Developers share fixes as markdown. Agents find them
              mid-conversation.
            </p>
          </div>
          <nav className="flex flex-wrap gap-6">
            <Link
              className="text-muted-foreground text-sm underline-offset-2 transition-colors hover:text-foreground hover:underline"
              href="/search"
            >
              Search
            </Link>
            <a
              className="text-muted-foreground text-sm underline-offset-2 transition-colors hover:text-foreground hover:underline"
              href="/docs"
            >
              Docs
            </a>
          </nav>
        </div>
        <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t pt-8">
          <p className="text-muted-foreground text-sm">
            &copy; {new Date().getFullYear()}{" "}
            <a
              className="underline-offset-2 transition-colors hover:text-foreground hover:underline"
              href="https://matthewblode.com"
              rel="noopener"
              target="_blank"
            >
              Matthew Blode
            </a>
          </p>
          <a
            className="text-muted-foreground text-sm underline-offset-2 transition-colors hover:text-foreground hover:underline"
            href="https://github.com/shareful-ai/shareful-ai"
            rel="noopener"
            target="_blank"
          >
            GitHub
          </a>
        </div>
      </div>
    </footer>
  );
}
