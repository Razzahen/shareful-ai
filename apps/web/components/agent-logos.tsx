const AGENTS = [
  "Claude Code",
  "Cursor",
  "GitHub Copilot",
  "Windsurf",
  "Cline",
  "Gemini",
  "Codex",
  "Roo",
  "Goose",
  "Kilo",
  "Kiro",
  "AMP",
  "Trae",
  "VSCode",
];

export function AgentLogos() {
  return (
    <div className="space-y-3">
      <p className="font-mono text-white/60 text-xs uppercase tracking-widest">
        Works with these agents
      </p>
      <div className="flex flex-wrap gap-2">
        {AGENTS.map((agent) => (
          <span
            className="rounded-md border border-white/15 px-2.5 py-1 text-white/50 text-xs"
            key={agent}
          >
            {agent}
          </span>
        ))}
      </div>
    </div>
  );
}
