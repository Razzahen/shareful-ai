import { MessageSquareOff, Shield } from "lucide-react";
import { Card } from "@/components/ui/card";

export default function Features() {
  return (
    <section className="@container bg-background py-24">
      <div className="mx-auto max-w-5xl px-6">
        <div>
          <p className="font-mono text-muted-foreground text-xs uppercase tracking-widest">
            The problem
          </p>
          <h2 className="mt-2 text-balance font-bold text-4xl tracking-tight">
            AI answers work, then vanish
          </h2>
          <p className="mt-4 text-balance text-muted-foreground">
            Stack Overflow trained the last generation of developers. Now AI
            gives the answers — but nothing comes back. The knowledge loop that
            made us all better is broken.
          </p>
        </div>
        <div className="mt-12 grid @xl:grid-cols-2 gap-3 *:p-6">
          <Card className="row-span-2 grid grid-rows-subgrid" variant="outline">
            <div className="space-y-2">
              <h3 className="font-medium text-foreground">
                Lost conversations
              </h3>
              <p className="text-muted-foreground text-sm">
                Every AI chat is a dead end. Fixes stay locked in one
                developer&apos;s conversation history, invisible to everyone
                else.
              </p>
            </div>
            <div
              aria-hidden
              className="flex h-44 flex-col justify-between pt-8"
            >
              <div className="relative flex h-10 items-center gap-12 px-6">
                <div className="absolute inset-0 my-auto h-px bg-border" />
                <div className="relative flex h-8 items-center rounded-full bg-card px-3 shadow-black/6.5 shadow-sm ring ring-border">
                  <MessageSquareOff className="size-3.5 text-muted-foreground" />
                </div>
                <div className="relative flex h-8 items-center rounded-full bg-card px-3 shadow-black/6.5 shadow-sm ring ring-border">
                  <MessageSquareOff className="size-3.5 text-muted-foreground" />
                </div>
              </div>
              <div className="relative flex h-10 items-center justify-between gap-12 pr-6 pl-17">
                <div className="absolute inset-0 my-auto h-px bg-border" />
                <div className="relative flex h-8 items-center rounded-full bg-card px-3 shadow-black/6.5 shadow-sm ring ring-border">
                  <MessageSquareOff className="size-3.5 text-muted-foreground" />
                </div>
                <div className="relative flex h-8 items-center rounded-full bg-card px-3 shadow-black/6.5 shadow-sm ring ring-border">
                  <MessageSquareOff className="size-3.5 text-muted-foreground" />
                </div>
              </div>
              <div className="relative flex h-10 items-center gap-20 px-8">
                <div className="absolute inset-0 my-auto h-px bg-border" />
                <div className="relative flex h-8 items-center rounded-full bg-card px-3 shadow-black/6.5 shadow-sm ring ring-border">
                  <MessageSquareOff className="size-3.5 text-muted-foreground" />
                </div>
                <div className="relative flex h-8 items-center rounded-full bg-card px-3 shadow-black/6.5 shadow-sm ring ring-border">
                  <MessageSquareOff className="size-3.5 text-muted-foreground" />
                </div>
              </div>
            </div>
          </Card>
          <Card
            className="row-span-2 grid grid-rows-subgrid overflow-hidden"
            variant="outline"
          >
            <div className="space-y-2">
              <h3 className="font-medium text-foreground">
                Reinventing solutions
              </h3>
              <p className="text-muted-foreground text-sm">
                Your agent debugs the same Rails serialization bug that ten
                other agents already solved this week. Nobody shares what
                worked.
              </p>
            </div>
            <div aria-hidden className="relative h-44 translate-y-6">
              <div className="absolute inset-0 mx-auto w-px bg-foreground/15" />
              <div className="absolute -inset-x-16 top-6 aspect-square rounded-full border" />
              <div className="mask-l-from-50% mask-l-to-90% mask-r-from-50% mask-r-to-50% absolute -inset-x-16 top-6 aspect-square rounded-full border border-primary" />
              <div className="absolute -inset-x-8 top-24 aspect-square rounded-full border" />
              <div className="mask-r-from-50% mask-r-to-90% mask-l-from-50% mask-l-to-50% absolute -inset-x-8 top-24 aspect-square rounded-full border border-destructive" />
            </div>
          </Card>
          <Card
            className="row-span-2 grid grid-rows-subgrid overflow-hidden"
            variant="outline"
          >
            <div className="space-y-2">
              <h3 className="font-medium text-foreground">
                Outdated resources
              </h3>
              <p className="text-muted-foreground text-sm">
                Stack Overflow answers from 2019 and internal wikis nobody
                updates have become knowledge graveyards.
              </p>
            </div>
            <div
              aria-hidden
              className="flex h-44 justify-between pt-12 pb-6 *:h-full *:w-px *:bg-foreground/15"
            >
              <div />
              <div />
              <div />
              <div />
              <div className="!bg-primary" />
              <div />
              <div />
              <div />
              <div />
              <div className="!bg-primary" />
              <div />
              <div />
              <div />
              <div className="!bg-primary" />
              <div />
              <div />
              <div />
              <div />
              <div className="!bg-primary" />
              <div />
              <div />
              <div />
              <div />
              <div className="!bg-primary" />
              <div />
              <div />
              <div />
              <div />
              <div />
              <div />
              <div />
              <div className="!bg-primary" />
            </div>
          </Card>
          <Card className="row-span-2 grid grid-rows-subgrid" variant="outline">
            <div className="space-y-2">
              <h3 className="font-medium">Community-verified fixes</h3>
              <p className="text-muted-foreground text-sm">
                Shareful restores the knowledge loop. Developers share fixes,
                agents find them, consensus surfaces truth — and your team stops
                solving the same bugs twice.
              </p>
            </div>
            <div className="pointer-events-none relative -ml-7 flex size-44 items-center justify-center pt-5">
              <Shield className="absolute inset-0 top-2.5 size-full stroke-[0.1px] opacity-15" />
              <Shield className="size-32 stroke-[0.1px]" />
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}
