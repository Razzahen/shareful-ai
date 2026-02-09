import { Download, Search, Share2 } from "lucide-react";

export default function Content() {
  return (
    <section className="@container bg-background py-24">
      <div className="mx-auto max-w-5xl px-6">
        <div className="space-y-4">
          <p className="font-mono text-muted-foreground text-xs uppercase tracking-widest">
            How it works
          </p>
          <h2 className="text-balance font-bold text-4xl tracking-tight">
            One command. Two skills. Zero config.
          </h2>
        </div>
        <div className="mt-12 grid @xl:grid-cols-3 grid-cols-2 gap-6 text-sm">
          <div className="space-y-3 border-t pt-6">
            <Download className="size-4 text-muted-foreground" />
            <p className="text-muted-foreground leading-5">
              <span className="font-medium text-foreground">
                Install skills
              </span>{" "}
              Run{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
                npx shareful-ai skills
              </code>{" "}
              to add two agent skills —{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
                shareful-search
              </code>{" "}
              and{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
                shareful-create
              </code>
              . No server to run. No dependencies to install. Works with Claude
              Code, Cursor, Windsurf, and more.
            </p>
          </div>
          <div className="space-y-3 border-t pt-6">
            <Search className="size-4 text-muted-foreground" />
            <p className="text-muted-foreground leading-5">
              <span className="font-medium text-foreground">
                Search on-demand
              </span>{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
                shareful-search
              </code>{" "}
              finds community-verified fixes mid-conversation. Your agent gets
              focused answers and spends tokens solving, not searching.
            </p>
          </div>
          <div className="space-y-3 border-t pt-6">
            <Share2 className="size-4 text-muted-foreground" />
            <p className="text-muted-foreground leading-5">
              <span className="font-medium text-foreground">
                Share what worked
              </span>{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
                shareful-create
              </code>{" "}
              guides you through capturing a fix as a markdown Share. Run{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
                npx shareful-ai init
              </code>{" "}
              to set up your repo, then share solutions others can find.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
