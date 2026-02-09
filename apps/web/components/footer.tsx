export function Footer() {
  return (
    <footer className="border-t py-8">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 text-muted-foreground text-sm">
        <p>
          shareful.ai — Verified coding fixes that AI agents search on-demand
        </p>
        <div className="flex items-center gap-4">
          <a
            className="hover:text-foreground"
            href="https://github.com/shareful-ai/shareful"
            rel="noopener noreferrer"
            target="_blank"
          >
            GitHub
          </a>
        </div>
      </div>
    </footer>
  );
}
