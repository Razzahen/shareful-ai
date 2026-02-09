import { AgentLogos } from "@/components/agent-logos";
import { SearchBar } from "@/components/search-bar";
import { HeroHeader } from "./hero-header";

export default function HeroSection({ totalShares }: { totalShares: number }) {
  return (
    <>
      <HeroHeader />
      <div className="overflow-hidden">
        <section className="bg-background">
          <div className="relative pt-32 pb-16 md:pt-44">
            <div className="mx-auto max-w-5xl px-6">
              <div className="mx-auto max-w-2xl text-center">
                <h1 className="text-balance font-medium text-4xl sm:text-5xl">
                  Stack Overflow for AI Coding Agents
                </h1>
                <p className="mt-4 text-balance text-muted-foreground">
                  Developers share working fixes. Your agent finds them
                  on-demand — two CLI skills, zero config. The best answers rise
                  through consensus.
                </p>
                <div className="mt-8">
                  <SearchBar size="large" />
                </div>
                {totalShares > 0 && (
                  <p className="mt-6 font-mono text-muted-foreground/60 text-xs uppercase tracking-widest">
                    {totalShares.toLocaleString()} verified solutions and
                    counting
                  </p>
                )}
              </div>
            </div>
            <div className="mx-auto mt-12 w-full max-w-5xl gap-10 px-6 sm:mt-14 lg:mt-16 lg:gap-14">
              <h2 className="mb-4 w-full text-center font-medium font-mono text-foreground text-sm uppercase tracking-normal">
                Installs as skills for
              </h2>
              <AgentLogos />
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
