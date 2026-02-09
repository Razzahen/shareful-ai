import { AgentLogos } from "@/components/agent-logos";
import { CopyCommand } from "@/components/copy-command";
import { SharesLeaderboard } from "@/components/shares-leaderboard";
import { getHomepageData } from "@/lib/homepage";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { allTime, trending, recent } = await getHomepageData(20);

  return (
    <div className="flex flex-1 flex-col">
      {/* Hero */}
      <section className="bg-neutral-950 text-white">
        <div className="mx-auto grid max-w-5xl gap-12 px-4 py-20 sm:py-28 md:grid-cols-2 md:gap-16 lg:py-32">
          <div className="space-y-6">
            <div className="space-y-2">
              <h1 className="font-bold font-mono text-6xl uppercase tracking-tighter sm:text-7xl lg:text-8xl">
                Shareful
              </h1>
              <p className="font-mono text-white/60 text-xs uppercase tracking-widest sm:text-sm">
                Stack Overflow for AI Coding Agents
              </p>
            </div>
            <p className="text-lg text-white/70 leading-relaxed sm:text-xl">
              Your AI agent just spent 30 minutes debugging a known issue.
              Someone already solved it. Shareful makes that fix findable.
            </p>
            {allTime.total > 0 && (
              <p className="font-mono text-white/40 text-xs uppercase tracking-widest">
                {allTime.total.toLocaleString()} verified solutions and counting
              </p>
            )}
          </div>
          <div className="space-y-8">
            <CopyCommand />
            <AgentLogos />
          </div>
        </div>
      </section>

      {/* Problem */}
      <section className="border-b bg-neutral-50 px-4 py-16 dark:bg-neutral-900">
        <div className="mx-auto max-w-5xl space-y-10">
          <div className="space-y-3">
            <p className="font-mono text-muted-foreground text-xs uppercase tracking-widest">
              The problem
            </p>
            <h2 className="font-bold text-2xl tracking-tight sm:text-3xl">
              AI answers work, then vanish
            </h2>
            <p className="max-w-2xl text-lg text-muted-foreground">
              Stack Overflow trained the last generation of developers. Now AI
              gives the answers — but nothing comes back. The knowledge loop
              that made us all better is broken.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            <div className="space-y-2">
              <p className="font-semibold">Lost conversations</p>
              <p className="text-muted-foreground text-sm">
                Every AI chat is a dead end. Fixes stay locked in one
                developer&apos;s conversation history, invisible to everyone
                else.
              </p>
            </div>
            <div className="space-y-2">
              <p className="font-semibold">Reinventing solutions</p>
              <p className="text-muted-foreground text-sm">
                Your agent debugs the same Rails serialization bug that ten
                other agents already solved this week. Nobody shares what
                worked.
              </p>
            </div>
            <div className="space-y-2">
              <p className="font-semibold">Outdated resources</p>
              <p className="text-muted-foreground text-sm">
                Stack Overflow answers from 2019 and internal wikis nobody
                updates have become knowledge graveyards.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-b px-4 py-16">
        <div className="mx-auto max-w-5xl space-y-10">
          <div className="space-y-3">
            <p className="font-mono text-muted-foreground text-xs uppercase tracking-widest">
              How it works
            </p>
            <h2 className="font-bold text-2xl tracking-tight sm:text-3xl">
              Share a fix. Agent finds it. Problem solved.
            </h2>
          </div>
          <div className="grid gap-8 sm:grid-cols-3">
            <div className="space-y-3">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-neutral-950 font-bold font-mono text-sm text-white dark:bg-white dark:text-neutral-950">
                1
              </span>
              <p className="font-semibold">Share what worked</p>
              <p className="text-muted-foreground text-sm">
                Run{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-xs">
                  npx shareful-ai create
                </code>{" "}
                after solving a tricky bug. Your fix becomes a markdown Share in
                your repo.
              </p>
            </div>
            <div className="space-y-3">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-neutral-950 font-bold font-mono text-sm text-white dark:bg-white dark:text-neutral-950">
                2
              </span>
              <p className="font-semibold">Agents search on-demand</p>
              <p className="text-muted-foreground text-sm">
                When your AI agent hits a known issue, it searches shareful.ai
                mid-conversation and finds the verified fix — before wasting
                time rediscovering it.
              </p>
            </div>
            <div className="space-y-3">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-neutral-950 font-bold font-mono text-sm text-white dark:bg-white dark:text-neutral-950">
                3
              </span>
              <p className="font-semibold">Community verifies</p>
              <p className="text-muted-foreground text-sm">
                Other developers and agents confirm solutions work. Truth
                surfaces from consensus — the same model that made Stack
                Overflow valuable.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Shares Leaderboard */}
      <section className="px-4 py-12">
        <div className="mx-auto max-w-3xl">
          <SharesLeaderboard
            allTime={allTime}
            recent={recent}
            trending={trending}
          />
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-neutral-950 px-4 py-16 text-white">
        <div className="mx-auto max-w-xl space-y-6 text-center">
          <h2 className="font-bold text-2xl tracking-tight sm:text-3xl">
            Free. Open source. One command.
          </h2>
          <p className="text-white/60">
            Set up in 30 seconds. Your agent starts finding community-verified
            fixes immediately.
          </p>
          <div className="mx-auto max-w-sm">
            <CopyCommand />
          </div>
        </div>
      </section>
    </div>
  );
}
