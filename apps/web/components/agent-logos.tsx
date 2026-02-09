import Image from "next/image";

const AGENTS = [
  { name: "AMP", href: "https://ampcode.com/", src: "/agents/amp.svg" },
  {
    name: "Antigravity",
    href: "https://antigravity.google/",
    src: "/agents/antigravity.svg",
  },
  {
    name: "Claude Code",
    href: "https://claude.com/product/claude-code",
    src: "/agents/claude-code.svg",
  },
  {
    name: "ClawdBot",
    href: "https://clawd.bot/",
    src: "/agents/clawdbot.svg",
  },
  { name: "Cline", href: "https://cline.bot/", src: "/agents/cline.svg" },
  {
    name: "Codex",
    href: "https://openai.com/codex",
    src: "/agents/codex.svg",
  },
  { name: "Cursor", href: "https://cursor.sh", src: "/agents/cursor.svg" },
  { name: "Droid", href: "https://factory.ai", src: "/agents/droid.svg" },
  {
    name: "Gemini",
    href: "https://gemini.google.com",
    src: "/agents/gemini.svg",
  },
  {
    name: "GitHub Copilot",
    href: "https://github.com/features/copilot",
    src: "/agents/copilot.svg",
  },
  {
    name: "Goose",
    href: "https://block.github.io/goose",
    src: "/agents/goose.svg",
  },
  { name: "Kilo", href: "https://kilo.ai/", src: "/agents/kilo.svg" },
  {
    name: "Kiro CLI",
    href: "https://kiro.dev/cli",
    src: "/agents/kiro-cli.svg",
  },
  {
    name: "OpenCode",
    href: "https://opencode.ai/",
    src: "/agents/opencode.svg",
  },
  { name: "Roo", href: "https://roocode.com/", src: "/agents/roo.svg" },
  { name: "Trae", href: "https://www.trae.ai/", src: "/agents/trae.svg" },
  {
    name: "VSCode",
    href: "https://code.visualstudio.com/",
    src: "/agents/vscode.svg",
  },
  {
    name: "Windsurf",
    href: "https://codeium.com/windsurf",
    src: "/agents/windsurf.svg",
  },
];

function AgentList() {
  return (
    <>
      {AGENTS.map((agent) => (
        <a
          className="min-w-[44px] flex-shrink-0 grayscale transition-all duration-300 hover:grayscale-0"
          href={agent.href}
          key={agent.name}
          rel="noopener noreferrer"
          target="_blank"
        >
          <Image
            alt={agent.name}
            className="h-[72px] w-auto object-contain sm:h-[72px] lg:h-[88px]"
            height={100}
            loading="lazy"
            src={agent.src}
            width={100}
          />
        </a>
      ))}
    </>
  );
}

export function AgentLogos() {
  return (
    <div className="relative w-full overflow-hidden">
      <div className="pointer-events-none absolute top-0 bottom-0 left-0 z-10 w-24 bg-gradient-to-r from-background to-transparent sm:w-32 lg:w-48" />
      <div className="pointer-events-none absolute top-0 right-0 bottom-0 z-10 w-24 bg-gradient-to-l from-background to-transparent sm:w-32 lg:w-48" />
      <div
        className="flex gap-2 sm:gap-3"
        style={{
          animation: "marquee 30s linear infinite",
          width: "max-content",
        }}
      >
        <AgentList />
        <AgentList />
      </div>
    </div>
  );
}
