import { CopyCommand } from "@/components/copy-command";

export default function CallToAction() {
  return (
    <section className="@container bg-background py-24">
      <div className="mx-auto max-w-5xl px-6">
        <div className="text-center">
          <h2 className="text-balance font-bold text-4xl tracking-tight">
            Free. Open source. One command.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-balance text-muted-foreground">
            Set up in 30 seconds. Your agent starts finding community-verified
            fixes immediately.
          </p>
          <div className="mx-auto mt-8 max-w-sm">
            <CopyCommand />
          </div>
        </div>
      </div>
    </section>
  );
}
