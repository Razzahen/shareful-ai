export interface DedupeDatasetItem {
  id: string;
  problemGroup: string;
  solutionGroup: string;
  problem: string;
  solution: string;
  language: string;
  framework?: string;
  errorSignature?: string;
}

function lines(...parts: Array<string | string[]>): string {
  const out: string[] = [];
  for (const p of parts) {
    if (Array.isArray(p)) {
      out.push(...p);
    } else {
      out.push(p);
    }
  }
  return out.join("\n").trim();
}

const NEXTJS_HYDRATION_ERROR =
  "Hydration failed because the initial UI does not match what was rendered on the server.";

interface GroupDef {
  problemGroup: string;
  language: string;
  framework?: string;
  errorSignature?: string;
  problems: string[];
  solutions: Record<string, string[]>;
  duplicates?: Array<{
    // Duplicate counts to stress "seen_count" and solution dedupe.
    solutionGroup: string;
    times: number;
    problemIndex?: number;
    solutionIndex?: number;
  }>;
}

function buildGroup(def: GroupDef): DedupeDatasetItem[] {
  const solutionGroups = Object.keys(def.solutions);
  const items: DedupeDatasetItem[] = [];

  for (let i = 0; i < def.problems.length; i++) {
    const sg = solutionGroups[i % solutionGroups.length];
    if (!sg) {
      continue;
    }
    const sols = def.solutions[sg] ?? [];
    const sol = sols[i % sols.length] ?? "";
    items.push({
      id: `${def.problemGroup}:${sg}:${i + 1}`,
      problemGroup: def.problemGroup,
      solutionGroup: sg,
      language: def.language,
      framework: def.framework,
      errorSignature: def.errorSignature,
      problem: def.problems[i] ?? "",
      solution: sol,
    });
  }

  for (const dup of def.duplicates ?? []) {
    const pIdx = dup.problemIndex ?? 0;
    const sIdx = dup.solutionIndex ?? 0;
    const p = def.problems[pIdx] ?? def.problems[0] ?? "";
    const sol = def.solutions[dup.solutionGroup]?.[sIdx] ?? "";

    for (let n = 0; n < dup.times; n++) {
      items.push({
        id: `${def.problemGroup}:${dup.solutionGroup}:dup:${pIdx}:${sIdx}:${n + 1}`,
        problemGroup: def.problemGroup,
        solutionGroup: dup.solutionGroup,
        language: def.language,
        framework: def.framework,
        errorSignature: def.errorSignature,
        problem: p,
        solution: sol,
      });
    }
  }

  return items;
}

const groups: GroupDef[] = [
  {
    problemGroup: "nextjs_hydration_window",
    language: "typescript",
    framework: "nextjs",
    errorSignature: NEXTJS_HYDRATION_ERROR,
    problems: [
      `Next.js hydration mismatch when a component reads window/localStorage during render. Error: ${NEXTJS_HYDRATION_ERROR}`,
      `Hydration mismatch in Next.js when a component touches \`window\` on first render (SSR vs client differ). ${NEXTJS_HYDRATION_ERROR}`,
      "React hydration error in Next.js because localStorage.getItem() runs during render and server HTML differs.",
      "Hydration fails because client renders different markup when accessing browser APIs (window/document).",
      "Hydration mismatch caused by a browser-only library that reads document on import (SSR renders different tree).",
      "Server renders markup that assumes window.innerWidth; client renders different markup immediately.",
      "In production, Next.js SSR crashes hydration because a component accesses navigator.userAgent during render.",
      "On Vercel, hydration fails because a component uses document.cookie during render.",
      "Hydration mismatch: code references sessionStorage in render path; server output differs.",
      "SSR/client mismatch: reading window.location in render changes output; hydration error occurs.",
      `Hydration error on first load due to \`window\` usage in render. ${NEXTJS_HYDRATION_ERROR}`,
      `Same hydration error, root cause is \`document\` access during render. ${NEXTJS_HYDRATION_ERROR}`,
    ],
    solutions: {
      dynamic_import_ssr_false: [
        lines(
          "Use a client-only dynamic import so the component is never rendered on the server.",
          "",
          [
            "```tsx",
            "import dynamic from 'next/dynamic';",
            "const ClientOnlyWidget = dynamic(() => import('./Widget'), { ssr: false });",
            "export default function Page() { return <ClientOnlyWidget /> }",
            "```",
          ]
        ),
        lines(
          "Dynamic import with ssr: false for browser-only components.",
          "",
          [
            "```tsx",
            "import dynamic from 'next/dynamic';",
            "const Map = dynamic(() => import('./Map'), { ssr: false });",
            "export default function Page() { return <Map /> }",
            "```",
          ]
        ),
        // Same content with different case/spacing to exercise solutionHash normalization.
        lines(
          "DYNAMIC import with ssr: false for browser-only components.",
          "",
          [
            "```tsx",
            "import dynamic from 'next/dynamic';",
            "const Map = dynamic(() => import('./Map'), { ssr: false });",
            "export default function Page() { return <Map /> }",
            "```",
          ]
        ),
      ],
      use_effect_gate_render: [
        lines("Gate browser-only rendering behind a mounted flag.", "", [
          "```tsx",
          "import { useEffect, useState } from 'react';",
          "export function Widget() {",
          "  const [mounted, setMounted] = useState(false);",
          "  useEffect(() => setMounted(true), []);",
          "  if (!mounted) return null;",
          "  const value = localStorage.getItem('x');",
          "  return <div>{value}</div>;",
          "}",
          "```",
        ]),
        lines(
          "Render a consistent placeholder on the server and fill client-side in an effect.",
          "",
          [
            "```tsx",
            "import { useEffect, useState } from 'react';",
            "export function ClientValue() {",
            "  const [value, setValue] = useState<string | null>(null);",
            "  useEffect(() => { setValue(window.location.href) }, []);",
            "  return <span>{value ?? ''}</span>;",
            "}",
            "```",
          ]
        ),
        lines(
          "Avoid accessing window/document during SSR: run browser reads in useEffect and keep initial markup stable."
        ),
      ],
    },
    duplicates: [
      {
        solutionGroup: "dynamic_import_ssr_false",
        times: 3,
        problemIndex: 0,
        solutionIndex: 1,
      },
      {
        solutionGroup: "use_effect_gate_render",
        times: 2,
        problemIndex: 2,
        solutionIndex: 0,
      },
    ],
  },

  {
    problemGroup: "nextjs_hydration_random",
    language: "typescript",
    framework: "nextjs",
    errorSignature: NEXTJS_HYDRATION_ERROR,
    problems: [
      `Hydration error in Next.js because component uses Math.random() during render so server/client markup differs. ${NEXTJS_HYDRATION_ERROR}`,
      "SSR output differs from client because IDs are generated with Date.now()/Math.random in render; hydration mismatch.",
      "Hydration mismatch on first load. Root cause: random IDs rendered on server and client differ.",
      "Component calls crypto.randomUUID() in render, causing different markup on server vs client.",
      "Hydration fails because a random key is generated for list items during render.",
      "After upgrading React, hydration mismatch happens due to non-deterministic render output (random).",
      `Hydration mismatch: Math.random in render path. ${NEXTJS_HYDRATION_ERROR}`,
      `Hydration mismatch: Date.now() used in render. ${NEXTJS_HYDRATION_ERROR}`,
      "Hydration mismatch because of unstable ids used in aria-describedby during SSR.",
      "Hydration mismatch: random-ish value computed in render (uuid).",
      "Server/client mismatch caused by random values in initial render.",
      "Hydration mismatch because initial render includes a timestamp string that changes per environment.",
    ],
    solutions: {
      use_id_instead_of_random: [
        lines(
          "Use React's `useId()` for stable IDs across server/client.",
          "",
          [
            "```tsx",
            "import { useId } from 'react';",
            "export function Field() {",
            "  const id = useId();",
            "  return <label htmlFor={id}><input id={id} /></label>;",
            "}",
            "```",
          ]
        ),
        lines("Prefer deterministic IDs (useId) over Math.random.", "", [
          "```tsx",
          "import { useId } from 'react';",
          "export function A11yInput() {",
          "  const id = useId();",
          "  return <input aria-describedby={id} />;",
          "}",
          "```",
        ]),
      ],
      generate_random_in_effect: [
        lines("Generate random values only on the client (after mount).", "", [
          "```tsx",
          "import { useEffect, useState } from 'react';",
          "export function RandomBadge() {",
          "  const [n, setN] = useState<number | null>(null);",
          "  useEffect(() => { setN(Math.random()) }, []);",
          "  return <span>{n ?? ''}</span>;",
          "}",
          "```",
        ]),
        lines(
          "Move any randomness into a client-only effect so the initial HTML matches."
        ),
      ],
    },
    duplicates: [
      {
        solutionGroup: "use_id_instead_of_random",
        times: 2,
        problemIndex: 0,
        solutionIndex: 0,
      },
    ],
  },

  {
    problemGroup: "nextjs_hydration_date_locale",
    language: "typescript",
    framework: "nextjs",
    errorSignature: NEXTJS_HYDRATION_ERROR,
    problems: [
      `Hydration mismatch because server renders a formatted date in UTC, but the client formats it in local timezone via toLocaleString(). ${NEXTJS_HYDRATION_ERROR}`,
      "Hydration error: date strings differ between server and browser because locale/timezone differ.",
      "SSR renders 01/02/2026 but client renders 1/2/2026 due to locale differences; hydration mismatch.",
      "Hydration mismatch caused by Intl.DateTimeFormat defaults varying between environments.",
      "Next.js hydration fails because server uses en-US but browser uses a different locale for toLocaleString().",
      "Hydration mismatch when formatting dates without a fixed timeZone/locale on server and client.",
      `Hydration mismatch: toLocaleString() output differs. ${NEXTJS_HYDRATION_ERROR}`,
      "Hydration mismatch because Date rendering differs in client timezone.",
      "Hydration mismatch on Vercel because server timezone differs from local dev; date output differs.",
      "Hydration mismatch: server and client pick different locales when formatting dates.",
      "Hydration mismatch: locale-specific number/date formatting differs.",
      "Hydration mismatch due to Intl formatting differences between Node and browser.",
    ],
    solutions: {
      render_date_on_client: [
        lines("Render the formatted date only after mount (client-only).", "", [
          "```tsx",
          "import { useEffect, useState } from 'react';",
          "export function LocalDate({ iso }: { iso: string }) {",
          "  const [txt, setTxt] = useState('');",
          "  useEffect(() => { setTxt(new Date(iso).toLocaleString()) }, [iso]);",
          "  return <span>{txt}</span>;",
          "}",
          "```",
        ]),
        lines(
          "Avoid rendering locale-dependent strings during SSR; compute them on the client."
        ),
      ],
      format_with_fixed_timezone_locale: [
        lines(
          "Format dates with a fixed locale/timeZone on both server and client.",
          "",
          [
            "```ts",
            "const fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC' });",
            "fmt.format(new Date(iso));",
            "```",
          ]
        ),
        lines(
          "Use ISO strings or a deterministic formatter (fixed locale + timezone)."
        ),
      ],
    },
  },

  {
    problemGroup: "prisma_pool_exhaustion",
    language: "typescript",
    framework: "prisma",
    errorSignature:
      "Timed out fetching a new connection from the connection pool.",
    problems: [
      "Prisma errors under load: Timed out fetching a new connection from the connection pool. Too many concurrent requests in Next.js API routes.",
      "Serverless environment opens too many DB connections via Prisma; connection pool timeout error occurs.",
      "Production spikes cause Prisma to exhaust the connection pool and time out fetching a new connection.",
      "PrismaClient hits connection pool timeout; too many concurrent queries in lambda.",
      "After deploying, Prisma connects too often and times out fetching a new connection.",
      "Connection pool exhaustion error from Prisma under concurrency.",
      "Prisma connection pool timeout because PrismaClient is instantiated per request.",
      "Prisma pool exhaustion in dev because hot reload creates multiple clients.",
      "Timed out fetching connection; Postgres max connections exceeded due to Prisma.",
      "Prisma pool: timeout fetching new connection under load.",
      "Connection pool timeout after adding background jobs; Prisma opens too many connections.",
      "Prisma pool exhaustion when running many parallel requests.",
    ],
    solutions: {
      limit_prisma_connections: [
        lines(
          "Limit Prisma connections and ensure a single PrismaClient instance in dev.",
          "",
          [
            "```ts",
            "import { PrismaClient } from '@prisma/client';",
            "export const prisma = globalThis.prisma ?? new PrismaClient();",
            "if (process.env.NODE_ENV !== 'production') (globalThis as any).prisma = prisma;",
            "```",
          ]
        ),
        lines("Reuse one PrismaClient and reduce per-request instantiation."),
      ],
      use_pgbouncer_or_pooler: [
        lines(
          "Use a connection pooler (PgBouncer/Neon pooling) and configure Prisma accordingly.",
          "",
          "- Prefer pooled connection string for serverless",
          "- Reduce concurrency / batch requests"
        ),
        lines("Add a pooler and use the pooled connection URL in serverless."),
      ],
    },
  },

  {
    problemGroup: "prisma_n_plus_one",
    language: "typescript",
    framework: "prisma",
    errorSignature: "Too many SQL queries when iterating relations",
    problems: [
      "Prisma is doing N+1 queries when rendering a list of posts with authors; performance tanks.",
      "N+1 queries with Prisma: each row triggers a separate query for its relation data.",
      "Prisma queries explode because relation data is loaded per item in a loop.",
      "Page makes hundreds of queries: Prisma relation fetch is inside map().",
      "Prisma N+1 problem when loading nested relations for each record.",
      "Performance issue: Prisma runs one query per row for related entities.",
      "N+1 queries after adding a list view; relation fetch is not included in findMany.",
      "Prisma does separate queries for author on each post (N+1).",
      "N+1 queries when selecting relation IDs then fetching each relation separately.",
      "Prisma N+1: missing include/select causes per-row queries.",
      "N+1 queries: relation is accessed lazily and triggers queries per item.",
      "Prisma N+1 queries in API route under load.",
    ],
    solutions: {
      use_include_select: [
        lines("Load relations in the initial query using `include`.", "", [
          "```ts",
          "const posts = await prisma.post.findMany({ include: { author: true } });",
          "```",
        ]),
        lines(
          "Use `include`/`select` to fetch related data in one go.",
          "",
          "```ts",
          "await prisma.user.findMany({ include: { posts: true } })",
          "```"
        ),
      ],
      batch_with_in_clause: [
        lines(
          "If you can't include, batch by IDs: query relations with `where: { id: { in: [...] } }`."
        ),
        lines(
          "Batch-fetch related rows using an IN query instead of per-row queries."
        ),
      ],
    },
  },

  {
    problemGroup: "node_esm_require",
    language: "javascript",
    framework: "node",
    errorSignature: "ReferenceError: require is not defined in ES module scope",
    problems: [
      "Node throws ReferenceError: require is not defined in ES module scope after setting package.json type=module.",
      "ESM project: require() breaks in Node with require is not defined in ES module scope.",
      "After migrating to ESM, scripts using require fail with require is not defined.",
      "Build script crashes: require is not defined in ES module scope (type=module).",
      "Node ESM: require() not available; script fails at runtime.",
      "require is not defined after switching to ESM.",
      "Monorepo with type=module: legacy require usage breaks.",
      "Script fails with require not defined due to module type change.",
      "Node ESM runtime error: require is not defined.",
      "require breaks in ESM mode after upgrading Node.",
      "ES module scope requires import; require throws ReferenceError.",
      "Cannot use require in ES module scope after setting type=module.",
    ],
    solutions: {
      rename_to_cjs: [
        lines(
          "Rename the file to `.cjs` (or remove type=module) so Node treats it as CommonJS.",
          "",
          "```bash",
          "mv scripts/build.js scripts/build.cjs",
          "```"
        ),
        lines(
          "RENAME the file to `.cjs` (or remove type=module) so Node treats it as CommonJS.",
          "",
          "```bash",
          "mv scripts/build.js scripts/build.cjs",
          "```"
        ),
      ],
      replace_require_with_import: [
        lines(
          "Replace require() with ESM imports.",
          "",
          "```js",
          "import fs from 'node:fs';",
          "```"
        ),
        lines(
          "Convert the script to ESM syntax (import/export) instead of require()."
        ),
      ],
    },
    duplicates: [
      {
        solutionGroup: "rename_to_cjs",
        times: 2,
        problemIndex: 0,
        solutionIndex: 0,
      },
    ],
  },

  {
    problemGroup: "node_import_outside_module",
    language: "javascript",
    framework: "node",
    errorSignature: "SyntaxError: Cannot use import statement outside a module",
    problems: [
      "Running a Node script fails with SyntaxError: Cannot use import statement outside a module (using import in a CJS context).",
      "Node throws Cannot use import statement outside a module when executing scripts/build.js.",
      "Cannot use import statement outside a module after copying an ESM snippet into a CommonJS script.",
      "CI fails: SyntaxError Cannot use import statement outside a module for a Node script.",
      "Script breaks because import syntax is used without ESM configuration.",
      "Node cannot parse import statement because file is treated as CJS.",
      "Unexpected import statement error in Node runtime.",
      "Cannot use import outside module when running node index.js.",
      "SyntaxError import outside module in Node 18.",
      "import syntax breaks in Node because package.json is missing type=module.",
      "Cannot use import statement outside a module in build step.",
      "Node script uses import but is executed as CommonJS.",
    ],
    solutions: {
      set_type_module_or_mjs: [
        lines(
          "Use ESM: set package.json `type: module` or rename the file to `.mjs`.",
          "",
          "```json",
          '{ "type": "module" }',
          "```"
        ),
        lines("Enable ESM for the script (type=module or .mjs)."),
      ],
      use_require_in_cjs: [
        lines(
          "Keep CommonJS: replace `import` with `require()`.",
          "",
          "```js",
          "const fs = require('node:fs');",
          "```"
        ),
        lines("If the file must stay CJS, use require() instead of import."),
      ],
    },
  },

  {
    problemGroup: "ts_paths_cannot_find_module",
    language: "typescript",
    framework: "tsc",
    errorSignature: "TS2307: Cannot find module '@/lib/foo'",
    problems: [
      "TypeScript compiles fail: TS2307 Cannot find module '@/lib/foo' after adding @ alias in code.",
      "TS path alias works in editor but fails at runtime because bundler doesn't know @ alias.",
      "Cannot find module '@/...' error after moving files; paths alias not configured.",
      "CI fails with TS2307 for @/* imports; local dev works.",
      "TS server resolves @ alias but build fails; baseUrl/paths mismatch.",
      "TS2307 cannot find module with @ alias in monorepo package.",
      "TypeScript cannot resolve @ imports without baseUrl + paths.",
      "TS2307 errors because tsconfig paths are missing for @/*.",
      "Cannot find module '@/utils' in tsc build output.",
      "Build fails: TS2307 for path alias @.",
      "tsc cannot find module '@/lib/foo' (alias).",
      "Editor works, but tsc can't resolve @ alias; paths config missing.",
    ],
    solutions: {
      add_tsconfig_paths: [
        lines(
          "Add `baseUrl` and `paths` to tsconfig.json (and configure your bundler to match).",
          "",
          "```json",
          "{",
          '  "compilerOptions": {',
          '    "baseUrl": ".",',
          '    "paths": { "@/*": ["./src/*"] }',
          "  }",
          "}",
          "```"
        ),
        lines("Configure tsconfig `baseUrl` + `paths` for @/* imports."),
      ],
      configure_bundler_alias: [
        lines(
          "Configure the runtime/bundler alias (e.g., Vite/Webpack) to match tsconfig paths."
        ),
        lines(
          "Add the same @ alias to your bundler config so runtime matches TS."
        ),
      ],
    },
  },

  {
    problemGroup: "python_module_not_found",
    language: "python",
    framework: "python",
    errorSignature: "ModuleNotFoundError: No module named 'requests'",
    problems: [
      "Python crashes with ModuleNotFoundError: No module named 'requests' when running script.",
      "ModuleNotFoundError for a dependency even though it is installed globally; wrong venv is active.",
      "Running python script fails: No module named requests; pip install didn't fix it.",
      "CI fails with ModuleNotFoundError: requests not found because requirements not installed.",
      "ModuleNotFoundError because `python` points to a different interpreter than `pip` installed into.",
      "No module named requests after creating a new venv.",
      "Python can't import a package due to missing virtualenv activation.",
      "ModuleNotFoundError: requests on macOS when running with system python.",
      "Python import error because dependencies not installed in .venv.",
      "Module not found because running with python3 but installed with pip for python2.",
      "ModuleNotFoundError due to using the wrong poetry environment.",
      "Python package missing in runtime environment (ModuleNotFoundError).",
    ],
    solutions: {
      activate_venv_install_deps: [
        lines(
          "Activate the correct virtualenv and install dependencies.",
          "",
          "```bash",
          "python -m venv .venv",
          "source .venv/bin/activate",
          "pip install -r requirements.txt",
          "```"
        ),
        lines("Ensure pip and python point to the same interpreter/venv."),
      ],
      install_module_directly: [
        lines(
          "Install the missing module in the active environment: `python -m pip install requests`."
        ),
        lines("Use `python -m pip` to avoid pip/python mismatch."),
      ],
    },
  },

  {
    problemGroup: "react_max_update_depth",
    language: "typescript",
    framework: "react",
    errorSignature: "Maximum update depth exceeded",
    problems: [
      "React throws Maximum update depth exceeded because an effect sets state and runs every render due to missing deps.",
      "Infinite render loop: state update triggers effect, effect triggers state update, React hits maximum update depth.",
      "useEffect runs on every render and calls setState; maximum update depth exceeded.",
      "React component keeps re-rendering due to setState in render path; depth exceeded.",
      "After adding a dependency, effect triggers itself and causes infinite updates.",
      "Maximum update depth exceeded due to unstable dependency in useEffect.",
      "React infinite re-render loop caused by derived object in deps array.",
      "Maximum update depth exceeded because useEffect depends on an object literal.",
      "Maximum update depth exceeded: setState called in effect without deps.",
      "Infinite loop from setState inside useEffect with changing deps.",
      "React update depth error after adding setState in effect.",
      "Maximum update depth exceeded due to missing dependency array.",
    ],
    solutions: {
      fix_useeffect_deps: [
        lines(
          "Add the correct dependency array and avoid setting state from values that change every render.",
          "",
          "```tsx",
          "useEffect(() => { setValue(compute()) }, [id]);",
          "```"
        ),
        lines(
          "Ensure useEffect deps are correct and not changing every render."
        ),
      ],
      use_memo_for_stable_values: [
        lines(
          "Memoize derived values so the effect deps are stable.",
          "",
          "```tsx",
          "const params = useMemo(() => ({ a, b }), [a, b]);",
          "useEffect(() => { setState(params) }, [params]);",
          "```"
        ),
        lines(
          "Use useMemo/useCallback to avoid unstable deps that retrigger effects."
        ),
      ],
    },
  },

  {
    problemGroup: "vite_process_not_defined",
    language: "typescript",
    framework: "vite",
    errorSignature: "ReferenceError: process is not defined",
    problems: [
      "Vite app crashes in browser with ReferenceError: process is not defined because code uses process.env.*",
      "Browser build references Node globals; process isn't available in Vite by default.",
      "After migrating from CRA to Vite, process.env is undefined in the browser.",
      "ReferenceError process is not defined when using a library that assumes Node globals.",
      "process is not defined error in Vite when accessing env variables.",
      "Client bundle breaks because a dependency reads process.env.NODE_ENV in the browser.",
      "Vite build outputs code referencing process; runtime throws ReferenceError.",
      "ReferenceError: process is not defined after upgrading Vite.",
      "process env usage breaks in Vite browser runtime.",
      "process is not defined with Vite + React when using process.env.REACT_APP_*",
      "ReferenceError process is not defined for env var access in Vite.",
      "process is not defined because code expects webpack polyfills.",
    ],
    solutions: {
      use_import_meta_env: [
        lines(
          "Use Vite env vars via `import.meta.env` (prefixed with VITE_).",
          "",
          "```ts",
          "const apiUrl = import.meta.env.VITE_API_URL;",
          "```"
        ),
        lines("Replace process.env usage with import.meta.env in Vite."),
      ],
      avoid_process_polyfill: [
        lines(
          "Avoid Node-only globals in client code; prefer import.meta.env and browser APIs."
        ),
        lines(
          "Do not rely on webpack's process polyfill; remove process usage from client code."
        ),
      ],
    },
  },

  {
    problemGroup: "jest_unexpected_token_export",
    language: "typescript",
    framework: "jest",
    errorSignature: "SyntaxError: Unexpected token 'export'",
    problems: [
      "Jest fails with Unexpected token 'export' when a dependency ships ESM and isn't transformed.",
      "Tests crash because Jest can't parse ESM syntax in node_modules.",
      "Unexpected token export error when importing an ESM-only package in Jest.",
      "Jest cannot parse export statements from a dependency; needs transform.",
      "CI fails: Unexpected token export in Jest due to ESM dependency.",
      "Jest throws SyntaxError export when running TS tests.",
      "Jest fails parsing ESM dep; transformIgnorePatterns blocks it.",
      "Unexpected token export because Jest runs in CJS mode but dep is ESM.",
      "Jest cannot handle ESM-only package; token export error.",
      "SyntaxError export when requiring an ESM library in Jest.",
      "Unexpected token export after upgrading dependency to ESM-only.",
      "Jest fails on export token from node_modules ESM module.",
    ],
    solutions: {
      configure_transform_ignore: [
        lines(
          "Configure transform + transformIgnorePatterns to transpile the ESM dependency.",
          "",
          "```js",
          "module.exports = { transformIgnorePatterns: ['/node_modules/(?!nanoid)/'] };",
          "```"
        ),
        lines("Allowlist the ESM dependency in transformIgnorePatterns."),
      ],
      use_babel_jest: [
        lines(
          "Use babel-jest or ts-jest to transform ESM into CJS for the test environment."
        ),
        lines("Add a Babel/Jest transform so export syntax is transpiled."),
      ],
    },
  },

  {
    problemGroup: "docker_node_gyp",
    language: "docker",
    framework: "docker",
    errorSignature: "gyp ERR! find Python",
    problems: [
      "Docker build fails compiling native Node modules: gyp ERR! find Python / make not found.",
      "node-gyp rebuild fails during npm ci in Docker for packages like sharp/canvas.",
      "CI Docker build fails: gyp ERR! find Python; can't compile native deps.",
      "Docker image missing build tools; node-gyp fails when installing dependencies.",
      "node-gyp fails in alpine image because python/make/g++ missing.",
      "Native module compilation fails in Docker due to missing toolchain.",
      "npm install fails in Docker: node-gyp cannot find python.",
      "Docker build fails: make not found, g++ missing for node-gyp.",
      "gyp ERR during docker build because python3 not installed.",
      "node-gyp rebuild failed on linux container; missing build-essential.",
      "Docker build cannot compile sharp; missing deps + node-gyp errors.",
      "Native deps fail to build in container; node-gyp errors.",
    ],
    solutions: {
      install_build_tools: [
        lines(
          "Install build tooling in the image (python3, make, g++).",
          "",
          "```Dockerfile",
          "RUN apt-get update && apt-get install -y python3 make g++",
          "```"
        ),
        lines(
          "Install python3 + build-essential in the container before npm ci."
        ),
      ],
      use_prebuilt_binaries: [
        lines(
          "Prefer base images and package versions that provide prebuilt binaries, or install OS deps required by the module."
        ),
        lines(
          "Use a Debian-based image (or matching libc) so prebuilt binaries are available."
        ),
      ],
    },
  },

  {
    problemGroup: "postgres_ssl_required",
    language: "typescript",
    framework: "postgres",
    errorSignature: "no pg_hba.conf entry for host",
    problems: [
      "Postgres connection fails in production with 'no pg_hba.conf entry for host ... SSL off'.",
      "DB connection rejected because SSL is required but client connects without TLS.",
      "Connection error: no pg_hba.conf entry ... SSL off when connecting from app.",
      "Production Postgres requires SSL; app connects without it and gets pg_hba error.",
      "no pg_hba.conf entry for host when connecting; SSL is off.",
      "Postgres rejects connection because sslmode not enabled.",
      "Database forces SSL; local dev works but prod fails with pg_hba SSL off.",
      "Connection blocked unless SSL enabled; pg_hba error shows SSL off.",
      "pg_hba error because client didn't use SSL.",
      "no pg_hba.conf entry ... SSL off, fix ssl config.",
      "Postgres requires TLS; driver doesn't set ssl.",
      "pg_hba conf error shows SSL off when connecting.",
    ],
    solutions: {
      set_sslmode_require: [
        lines(
          "Enable SSL in the connection string (sslmode=require).",
          "",
          "```",
          "postgres://user:pass@host/db?sslmode=require",
          "```"
        ),
        lines("Add sslmode=require to the connection URL."),
      ],
      configure_driver_ssl: [
        lines(
          "Set `ssl: true` (or equivalent) in the Postgres driver configuration."
        ),
        lines("Configure your driver to use SSL/TLS in production."),
      ],
    },
  },

  {
    problemGroup: "git_unrelated_histories",
    language: "shell",
    framework: "git",
    errorSignature: "fatal: refusing to merge unrelated histories",
    problems: [
      "git pull fails with fatal: refusing to merge unrelated histories when combining two repos.",
      "Unrelated histories error after initializing locally then connecting to a remote with its own commits.",
      "fatal refusing to merge unrelated histories when pulling remote main into local repo.",
      "git merge refuses unrelated histories after adding remote origin.",
      "Cannot merge unrelated histories when trying to pull from new remote.",
      "git pull errors due to unrelated histories (local init vs remote init).",
      "Unrelated histories error in git when pulling into repo with different root commits.",
      "git refuses to merge histories that do not share a common ancestor.",
      "fatal: refusing to merge unrelated histories after connecting to an existing repo.",
      "Unrelated histories fatal error when pulling changes from template repo.",
      "git merge error: unrelated histories.",
      "Refusing to merge unrelated histories when pulling remote branch.",
    ],
    solutions: {
      allow_unrelated_histories: [
        lines(
          "Run pull/merge with --allow-unrelated-histories (and resolve conflicts).",
          "",
          "```bash",
          "git pull origin main --allow-unrelated-histories",
          "```"
        ),
        lines("Use --allow-unrelated-histories to combine the histories."),
      ],
      reset_to_remote: [
        lines(
          "If you want to discard local history, reset to remote:",
          "",
          "```bash",
          "git fetch origin",
          "git reset --hard origin/main",
          "```"
        ),
        lines(
          "Hard reset to the remote branch if local history should be replaced."
        ),
      ],
    },
  },

  // Additional groups to stress entity resolution across stacks.
  {
    problemGroup: "nextjs_redirect_loop",
    language: "typescript",
    framework: "nextjs",
    errorSignature: "ERR_TOO_MANY_REDIRECTS",
    problems: [
      "After login, Next.js redirects back to the login page repeatedly (ERR_TOO_MANY_REDIRECTS).",
      "Auth flow loops: user signs in, then gets redirected back to /login again and again.",
      "Next.js middleware causes infinite redirect loop after authentication.",
      "Too many redirects after setting auth cookie in Next.js app router.",
      "Redirect loop in Next.js after successful auth callback; callbackUrl misconfigured.",
      "After upgrading next-auth, login loops with too many redirects.",
      "Infinite redirect between /login and /dashboard due to missing session cookie.",
      "Vercel deployment has redirect loop after auth, works locally.",
      "ERR_TOO_MANY_REDIRECTS due to middleware redirecting even when authenticated.",
      "Login redirect loop due to cookie path/domain mismatch.",
      "Redirect loop because middleware runs on auth callback route.",
      "Redirect loop because middleware checks session incorrectly (always false).",
    ],
    solutions: {
      fix_middleware_matcher: [
        lines(
          "Exclude auth callback routes from middleware and ensure matcher only targets protected paths.",
          "",
          "```ts",
          "export const config = { matcher: ['/((?!api/auth|login).*)'] };",
          "```"
        ),
        lines("Fix the middleware matcher to avoid redirecting auth routes."),
      ],
      fix_cookie_config: [
        lines(
          "Fix cookie domain/path/secure settings so the session cookie is sent."
        ),
        lines(
          "Ensure cookies are set with correct domain + secure flags in production."
        ),
      ],
    },
  },

  {
    problemGroup: "eslint_parser_options_project",
    language: "typescript",
    framework: "eslint",
    errorSignature: "Parsing error: Cannot read file",
    problems: [
      "ESLint throws parsing error: Cannot read file tsconfig.json when parserOptions.project is set.",
      "Linting fails because @typescript-eslint/parser cannot find tsconfig referenced in parserOptions.project.",
      "ESLint parsing error for TS project references wrong tsconfig path.",
      "Monorepo ESLint config breaks: parserOptions.project points to missing tsconfig.",
      "CI lint fails: Cannot read file tsconfig.eslint.json (Parsing error).",
      "ESLint parsing error after moving tsconfig files.",
      "Parsing error cannot read tsconfig because ESLint cwd differs.",
      "ESLint fails on TypeScript files due to parserOptions.project misconfiguration.",
      "Cannot read file tsconfig.json in ESLint when running from repo root.",
      "ESLint parsing error due to incorrect tsconfigRootDir.",
      "Parsing error cannot read file, project config not found.",
      "ESLint TypeScript parser can't find project file.",
    ],
    solutions: {
      set_tsconfig_root_dir: [
        lines(
          "Set tsconfigRootDir and point parserOptions.project to the right file(s).",
          "",
          "```js",
          "parserOptions: { tsconfigRootDir: __dirname, project: ['./tsconfig.eslint.json'] }",
          "```"
        ),
        lines("Fix parserOptions.project path and tsconfigRootDir."),
      ],
      disable_type_aware_rules: [
        lines(
          "If you don't need type-aware linting, remove parserOptions.project to avoid project resolution errors."
        ),
        lines(
          "Avoid type-aware config unless needed; it makes ESLint resolve tsconfig."
        ),
      ],
    },
  },

  {
    problemGroup: "npm_eresolve_dependency_tree",
    language: "shell",
    framework: "npm",
    errorSignature: "ERESOLVE unable to resolve dependency tree",
    problems: [
      "npm install fails with ERESOLVE unable to resolve dependency tree after upgrading React.",
      "Dependency conflict: npm errors ERESOLVE unable to resolve dependency tree.",
      "CI breaks on npm ci with ERESOLVE dependency tree error.",
      "npm v9 refuses to install due to peer dependency mismatch (ERESOLVE).",
      "Monorepo install fails: ERESOLVE unable to resolve dependency tree.",
      "npm install errors due to conflicting peer deps (ERESOLVE).",
      "Cannot install dependencies because npm can't resolve peer deps.",
      "ERESOLVE error when installing a package that requires React 18 but project has React 19.",
      "ERESOLVE due to incompatible @types versions.",
      "npm dependency tree conflict after adding eslint plugin.",
      "ERESOLVE error due to peer dependency mismatch.",
      "npm ci fails in pipeline with ERESOLVE.",
    ],
    solutions: {
      legacy_peer_deps: [
        lines(
          "Use `--legacy-peer-deps` (or `--force`) as a temporary workaround."
        ),
        lines(
          "Run `npm install --legacy-peer-deps` to bypass strict peer dep resolution."
        ),
      ],
      fix_versions: [
        lines(
          "Fix the underlying peer dependency versions (upgrade/downgrade the conflicting packages)."
        ),
        lines(
          "Align package versions so peer deps match instead of bypassing resolution."
        ),
      ],
    },
  },

  {
    problemGroup: "vercel_edge_crypto_not_defined",
    language: "typescript",
    framework: "nextjs",
    errorSignature: "ReferenceError: crypto is not defined",
    problems: [
      "Next.js route running in Edge runtime throws ReferenceError: crypto is not defined.",
      "Edge runtime: crypto is not defined when using node:crypto in middleware.",
      "Vercel edge function fails because Node crypto APIs are unavailable.",
      "crypto is not defined error when deploying Next.js middleware to Vercel Edge.",
      "ReferenceError crypto not defined in edge runtime after importing jsonwebtoken.",
      "Edge runtime breaks when using libraries that require node:crypto.",
      "Next.js middleware cannot use node crypto; crypto undefined.",
      "crypto not defined in edge runtime; works locally in node runtime.",
      "ReferenceError crypto is not defined when running on edge.",
      "Edge runtime lacks Node APIs; crypto undefined.",
      "crypto undefined in edge runtime for JWT signing.",
      "crypto not defined in edge; using node:crypto causes crash.",
    ],
    solutions: {
      use_webcrypto: [
        lines(
          "Use Web Crypto APIs available in Edge runtime (`globalThis.crypto.subtle`) instead of node:crypto."
        ),
        lines("Switch to WebCrypto-compatible libraries when running on Edge."),
      ],
      switch_to_node_runtime: [
        lines(
          "Run the route in the Node.js runtime instead of Edge.",
          "",
          "```ts",
          "export const runtime = 'nodejs';",
          "```"
        ),
        lines("Avoid Edge runtime for code that depends on Node APIs."),
      ],
    },
  },
];

export const dedupeDataset: DedupeDatasetItem[] = groups.flatMap(buildGroup);
