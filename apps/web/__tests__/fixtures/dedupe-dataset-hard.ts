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

const INVALID_HOOK_CALL =
  "Invalid hook call. Hooks can only be called inside of the body of a function component.";

const STRIPE_SIGNATURE_ERROR =
  "No signatures found matching the expected signature for payload";

const WINDOW_NOT_DEFINED = "ReferenceError: window is not defined";

const TS2307_PATHS =
  "TS2307: Cannot find module '@/components/Button' or its corresponding type declarations.";

const MODULE_NOT_FOUND_FS = "Module not found: Can't resolve 'fs'";

const EDGE_NODE_API =
  "The Edge Runtime does not support Node.js APIs (e.g. 'crypto', 'fs').";

const PG_UNIQUE_VIOLATION = "duplicate key value violates unique constraint";

interface GroupDef {
  problemGroup: string;
  language: string;
  framework?: string;
  errorSignature?: string;
  problems: string[];
  solutions: Record<string, string[]>;
  duplicates?: Array<{
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
    problemGroup: "react_invalid_hook_multiple_react",
    language: "typescript",
    framework: "react",
    errorSignature: INVALID_HOOK_CALL,
    problems: [
      lines(
        "React app crashes with Invalid hook call when importing a shared UI package from a monorepo.",
        `Error: ${INVALID_HOOK_CALL}`,
        "",
        "Setup: Next.js app in apps/web imports packages/ui. packages/ui has react in dependencies."
      ),
      lines(
        "Invalid hook call after `npm link` a local component library.",
        `Error: ${INVALID_HOOK_CALL}`,
        "",
        "Pretty sure there are two Reacts (app + linked lib)."
      ),
      lines(
        "Invalid hook call in pnpm workspace when consuming a local package.",
        `Error: ${INVALID_HOOK_CALL}`,
        "",
        "`pnpm why react` shows multiple versions. App uses React 19, library pulls React 18."
      ),
      lines(
        "Storybook shows Invalid hook call only for components from the shared package.",
        `Error: ${INVALID_HOOK_CALL}`,
        "",
        "Likely bundler resolves react from package node_modules instead of root."
      ),
      lines(
        "Invalid hook call in production build only. Dev is fine.",
        `Error: ${INVALID_HOOK_CALL}`,
        "",
        "Workspace with transpiled packages. Suspect duplicated react/jsx-runtime."
      ),
      lines(
        "Invalid hook call when using yarn workspaces and nohoist for react.",
        `Error: ${INVALID_HOOK_CALL}`,
        "",
        "Shared library accidentally bundles its own react."
      ),
      lines(
        "Invalid hook call because react and react-dom versions don't match across app + package.",
        `Error: ${INVALID_HOOK_CALL}`,
        "",
        "react=18.3 in app, react-dom=18.2 in package."
      ),
      lines(
        "Invalid hook call after upgrading to React 19 in the app but a dependency still uses React 18.",
        `Error: ${INVALID_HOOK_CALL}`,
        "",
        "Error happens when rendering the dependency's component."
      ),
    ],
    solutions: {
      peer_deps_and_dedupe: [
        lines("Make sure the shared library does NOT ship its own React.", "", [
          "1. In `packages/ui/package.json`, move `react` and `react-dom` to `peerDependencies` (and possibly `devDependencies`).",
          "2. Remove `react`/`react-dom` from `dependencies` in the library.",
          "3. Reinstall and dedupe so the app has a single React instance.",
          "4. Verify with `npm ls react` / `pnpm why react`.",
        ]),
        lines(
          "In a monorepo, treat React as a peer dependency in shared packages and ensure only the app provides it."
        ),
      ],
      bundler_alias_singleton: [
        lines("Force a single React resolution via bundler alias/dedupe.", "", [
          "Next.js (next.config.js):",
          "```js",
          "module.exports = {",
          "  webpack: (config) => {",
          "    config.resolve.alias = {",
          "      ...(config.resolve.alias || {}),",
          "      react: require.resolve('react'),",
          "      'react-dom': require.resolve('react-dom'),",
          "    };",
          "    return config;",
          "  },",
          "};",
          "```",
          "",
          "Vite:",
          "```ts",
          "export default defineConfig({",
          "  resolve: { dedupe: ['react', 'react-dom'] },",
          "});",
          "```",
        ]),
        lines(
          "Use bundler-level dedupe/alias to ensure the app and library share the same React singleton."
        ),
      ],
    },
    duplicates: [
      { solutionGroup: "peer_deps_and_dedupe", times: 3, problemIndex: 0 },
      { solutionGroup: "bundler_alias_singleton", times: 2, problemIndex: 2 },
    ],
  },

  {
    problemGroup: "react_invalid_hook_rules_violation",
    language: "typescript",
    framework: "react",
    errorSignature: INVALID_HOOK_CALL,
    problems: [
      lines(
        "Invalid hook call because a hook is inside an if statement.",
        `Error: ${INVALID_HOOK_CALL}`,
        "",
        "Example: calling `useEffect` only when `props.open` is true."
      ),
      lines(
        "Invalid hook call when I call `useState` inside an event handler function.",
        `Error: ${INVALID_HOOK_CALL}`,
        "",
        "I tried to create state inside `onClick`."
      ),
      lines(
        "Invalid hook call because a custom hook is called inside a loop.",
        `Error: ${INVALID_HOOK_CALL}`,
        "",
        "`items.forEach(() => useThing())`"
      ),
      lines(
        "Invalid hook call because I call a hook from a plain util function.",
        `Error: ${INVALID_HOOK_CALL}`,
        "",
        "Not a component, not a custom hook, just a helper."
      ),
      lines(
        "Invalid hook call after refactor: hook is now called from inside a callback passed to another function.",
        `Error: ${INVALID_HOOK_CALL}`,
        "",
        "Hook moved into `doWork(() => useMemo(...))`."
      ),
      lines(
        "Invalid hook call because I conditionally return early before the hook runs.",
        `Error: ${INVALID_HOOK_CALL}`,
        "",
        "Sometimes `return null` happens before hooks are called."
      ),
      lines(
        "Invalid hook call because I'm calling a hook in a class component method.",
        `Error: ${INVALID_HOOK_CALL}`,
        "",
        "I tried to use `useEffect` in a class component."
      ),
      lines(
        "Invalid hook call: I accidentally call a hook in a function that isn't named like a component.",
        `Error: ${INVALID_HOOK_CALL}`,
        "",
        "It's a lowercase function that returns JSX sometimes."
      ),
    ],
    solutions: {
      move_hooks_to_top_level: [
        lines(
          "Follow the Rules of Hooks: call hooks unconditionally at the top level of the component or custom hook.",
          "",
          [
            "Bad:",
            "```tsx",
            "if (open) { useEffect(() => {}, []) }",
            "```",
            "",
            "Good:",
            "```tsx",
            "useEffect(() => { if (!open) return; /* ... */ }, [open])",
            "```",
          ]
        ),
        lines(
          "Never call hooks inside conditions/loops/callbacks. Put hooks at the top level and move branching inside the hook."
        ),
      ],
      extract_components_for_conditionals: [
        lines(
          "If you need conditional hook usage, split into components so each component has stable hook order.",
          "",
          [
            "```tsx",
            "function Modal({ open }: { open: boolean }) {",
            "  return open ? <ModalInner /> : null;",
            "}",
            "function ModalInner() {",
            "  useEffect(() => { /* ... */ }, []);",
            "  return <div />;",
            "}",
            "```",
          ]
        ),
        lines(
          "Extract conditional branches into their own components instead of conditionally calling hooks."
        ),
      ],
    },
    duplicates: [
      { solutionGroup: "move_hooks_to_top_level", times: 2, problemIndex: 0 },
    ],
  },

  {
    problemGroup: "stripe_webhook_signature_raw_body_nextjs",
    language: "typescript",
    framework: "nextjs",
    errorSignature: STRIPE_SIGNATURE_ERROR,
    problems: [
      lines(
        "Stripe webhook signature verification fails in Next.js app router.",
        `Error: ${STRIPE_SIGNATURE_ERROR}`,
        "",
        "I call `await req.json()` and then pass that object into `stripe.webhooks.constructEvent`."
      ),
      lines(
        "Next.js Route Handler Stripe webhook fails even though the secret is set.",
        `Error: ${STRIPE_SIGNATURE_ERROR}`,
        "",
        "I'm using `req.json()` instead of raw body."
      ),
      lines(
        "Stripe constructEvent throws signature error in Next.js after adding middleware that parses JSON.",
        `Error: ${STRIPE_SIGNATURE_ERROR}`,
        "",
        "I think the request body is being mutated."
      ),
      lines(
        "Stripe webhook signature fails on Vercel but works locally.",
        `Error: ${STRIPE_SIGNATURE_ERROR}`,
        "",
        "I parse the body and stringify it again before verification."
      ),
      lines(
        "Stripe signature mismatch in Next.js pages API route (not app router).",
        `Error: ${STRIPE_SIGNATURE_ERROR}`,
        "",
        "bodyParser is enabled and I can't access the raw buffer."
      ),
      lines(
        "Stripe webhook verification fails: I'm using `JSON.stringify(await req.json())` for the payload.",
        `Error: ${STRIPE_SIGNATURE_ERROR}`,
        "",
        "I saw an example online but it doesn't work."
      ),
      lines(
        "Stripe signature verification error in Next.js because I log and reformat the request body.",
        `Error: ${STRIPE_SIGNATURE_ERROR}`,
        "",
        "I think whitespace changes break the signature."
      ),
      lines(
        "Stripe webhook fails with 'No signatures found'. Using Next.js 14 route handler.",
        `Error: ${STRIPE_SIGNATURE_ERROR}`,
        "",
        "I need to verify the signature but I'm not sure how to get raw body."
      ),
    ],
    solutions: {
      app_router_use_req_text: [
        lines(
          "In Next.js app router route handlers, read the raw body as text and pass it directly to Stripe.",
          "",
          [
            "```ts",
            "export async function POST(req: Request) {",
            "  const payload = await req.text();",
            "  const sig = req.headers.get('stripe-signature') ?? '';",
            "  const event = stripe.webhooks.constructEvent(payload, sig, process.env.STRIPE_WEBHOOK_SECRET!);",
            "  // ...",
            "}",
            "```",
          ]
        ),
        lines(
          "Do NOT call `req.json()` before verification. Use `req.text()` and verify against the raw payload."
        ),
      ],
      pages_disable_bodyparser_raw: [
        lines(
          "In Next.js pages API routes, disable bodyParser and use the raw buffer for Stripe.",
          "",
          [
            "```ts",
            "export const config = { api: { bodyParser: false } };",
            "```",
            "",
            "Then read the raw request stream and pass the buffer to `constructEvent`.",
          ]
        ),
        lines(
          "Disable Next.js body parsing so Stripe sees the exact raw payload bytes."
        ),
      ],
    },
    duplicates: [
      { solutionGroup: "app_router_use_req_text", times: 3, problemIndex: 0 },
      {
        solutionGroup: "pages_disable_bodyparser_raw",
        times: 2,
        problemIndex: 4,
      },
    ],
  },

  {
    problemGroup: "stripe_webhook_signature_wrong_secret_nextjs",
    language: "typescript",
    framework: "nextjs",
    errorSignature: STRIPE_SIGNATURE_ERROR,
    problems: [
      lines(
        "Stripe webhook signature verification fails but I'm already using raw body.",
        `Error: ${STRIPE_SIGNATURE_ERROR}`,
        "",
        "I use `req.text()` and pass that into `constructEvent`, still fails."
      ),
      lines(
        "Stripe webhook signature mismatch after rotating secrets.",
        `Error: ${STRIPE_SIGNATURE_ERROR}`,
        "",
        "We rotated the signing secret but maybe the env var isn't updated in Vercel."
      ),
      lines(
        "Signature check fails only in production (Vercel). Locally it's fine.",
        `Error: ${STRIPE_SIGNATURE_ERROR}`,
        "",
        "I suspect I'm using the test webhook secret in live mode."
      ),
      lines(
        "Stripe signature verification error: multiple webhook endpoints in Stripe dashboard.",
        `Error: ${STRIPE_SIGNATURE_ERROR}`,
        "",
        "Not sure which signing secret belongs to this endpoint."
      ),
      lines(
        "Stripe constructEvent throws: signing secret might be wrong.",
        `Error: ${STRIPE_SIGNATURE_ERROR}`,
        "",
        "Raw body looks correct, header exists."
      ),
      lines(
        "Stripe webhook signature mismatch because the secret env var is empty on one deployment.",
        `Error: ${STRIPE_SIGNATURE_ERROR}`,
        "",
        "The code uses `process.env.STRIPE_WEBHOOK_SECRET` but it's not set on Preview."
      ),
      lines(
        "Stripe signature mismatch after copying webhook code from another project.",
        `Error: ${STRIPE_SIGNATURE_ERROR}`,
        "",
        "I used the wrong endpoint secret."
      ),
      lines(
        "Webhook verification fails: I'm verifying with STRIPE_SECRET_KEY instead of the webhook signing secret.",
        `Error: ${STRIPE_SIGNATURE_ERROR}`,
        "",
        "I mixed up secrets."
      ),
    ],
    solutions: {
      use_correct_endpoint_secret: [
        lines(
          "Make sure you're using the Webhook Signing Secret for THIS endpoint (starts with `whsec_...`).",
          "",
          [
            "1. In Stripe Dashboard: Developers -> Webhooks -> select the endpoint -> 'Signing secret'.",
            "2. Confirm you're using the correct secret for the environment (test vs live).",
            "3. Update Vercel env vars and redeploy.",
          ]
        ),
        lines(
          "Use `whsec_...` for webhook verification. Test and live endpoints have different signing secrets."
        ),
      ],
      validate_stripe_signature_header: [
        lines(
          "Confirm the request is coming from Stripe and includes a valid `Stripe-Signature` header.",
          "",
          [
            "If you're proxying webhooks through another service, ensure it forwards `Stripe-Signature` unchanged.",
            "If using ngrok/local forwarding, ensure the endpoint URL matches what Stripe is sending to.",
          ]
        ),
        lines(
          "If the signature header isn't forwarded 1:1, verification will fail even with the right secret."
        ),
      ],
    },
    duplicates: [
      {
        solutionGroup: "use_correct_endpoint_secret",
        times: 2,
        problemIndex: 2,
      },
    ],
  },

  {
    problemGroup: "nextjs_window_not_defined_ssr",
    language: "typescript",
    framework: "nextjs",
    errorSignature: WINDOW_NOT_DEFINED,
    problems: [
      lines(
        "Next.js server-side render crashes with window is not defined.",
        `Error: ${WINDOW_NOT_DEFINED}`,
        "",
        "A component reads localStorage during render."
      ),
      lines(
        "window is not defined in Next.js app router because a package touches window at import time.",
        `Error: ${WINDOW_NOT_DEFINED}`,
        "",
        "Importing a browser-only chart library in a Server Component."
      ),
      lines(
        "ReferenceError: window is not defined when running Next.js on Vercel.",
        `Error: ${WINDOW_NOT_DEFINED}`,
        "",
        "We use `window.location` in a helper used by both server and client."
      ),
      lines(
        "Next.js SSR throws window is not defined due to `useLayoutEffect` running on server.",
        `Error: ${WINDOW_NOT_DEFINED}`,
        "",
        "We use a component that assumes DOM exists."
      ),
      lines(
        "window is not defined in Next.js because code runs in getStaticProps/getServerSideProps.",
        `Error: ${WINDOW_NOT_DEFINED}`,
        "",
        "I tried to read `window.navigator` in getServerSideProps."
      ),
      lines(
        "SSR crash: document/window access in Server Component causes window is not defined.",
        `Error: ${WINDOW_NOT_DEFINED}`,
        "",
        "I forgot to mark the component as client."
      ),
      lines(
        "Next.js route handler tries to access window and fails.",
        `Error: ${WINDOW_NOT_DEFINED}`,
        "",
        "Accidentally reused a client helper in server code."
      ),
      lines(
        "Next.js app router: window is not defined when importing a browser-only lib.",
        `Error: ${WINDOW_NOT_DEFINED}`,
        "",
        "The library references `self`/`window` during module initialization."
      ),
    ],
    solutions: {
      dynamic_import_ssr_false: [
        lines(
          "Render browser-only components on the client only using dynamic import (ssr: false).",
          "",
          [
            "```tsx",
            "import dynamic from 'next/dynamic';",
            "const ClientOnly = dynamic(() => import('./ClientOnly'), { ssr: false });",
            "export default function Page() { return <ClientOnly /> }",
            "```",
          ]
        ),
        lines(
          "Use `dynamic(..., { ssr: false })` for components that need `window`/DOM."
        ),
      ],
      use_effect_and_guard: [
        lines("Guard browser APIs and only access them after mount.", "", [
          "```tsx",
          "const [mounted, setMounted] = useState(false);",
          "useEffect(() => setMounted(true), []);",
          "if (!mounted) return null;",
          "const v = window.localStorage.getItem('x');",
          "```",
        ]),
        lines(
          "Move `window`/`document` reads into `useEffect` and keep SSR markup stable."
        ),
      ],
    },
    duplicates: [
      { solutionGroup: "dynamic_import_ssr_false", times: 2, problemIndex: 1 },
    ],
  },

  {
    problemGroup: "jest_window_not_defined_test_env",
    language: "typescript",
    framework: "jest",
    errorSignature: WINDOW_NOT_DEFINED,
    problems: [
      lines(
        "Jest tests fail with window is not defined.",
        `Error: ${WINDOW_NOT_DEFINED}`,
        "",
        "I'm testing a DOM helper but Jest is using node environment."
      ),
      lines(
        "Unit tests crash: ReferenceError window is not defined when running in CI.",
        `Error: ${WINDOW_NOT_DEFINED}`,
        "",
        "Works locally in browser but not in tests."
      ),
      lines(
        "window is not defined in Jest after upgrading config.",
        `Error: ${WINDOW_NOT_DEFINED}`,
        "",
        "Looks like testEnvironment reverted to node."
      ),
      lines(
        "Jest: document/window missing when running React Testing Library tests.",
        `Error: ${WINDOW_NOT_DEFINED}`,
        "",
        "I forgot to use jsdom."
      ),
      lines(
        "Vitest/Jest suite fails with window undefined.",
        `Error: ${WINDOW_NOT_DEFINED}`,
        "",
        "Need DOM globals in tests."
      ),
      lines(
        "Jest fails in a pure node environment with window is not defined.",
        `Error: ${WINDOW_NOT_DEFINED}`,
        "",
        "This is a test config issue, not SSR."
      ),
      lines(
        "Test fails with window is not defined; I import a module that expects DOM in node tests.",
        `Error: ${WINDOW_NOT_DEFINED}`
      ),
      lines(
        "Jest: ReferenceError window is not defined because testEnvironment isn't set.",
        `Error: ${WINDOW_NOT_DEFINED}`
      ),
    ],
    solutions: {
      set_jsdom_environment: [
        lines(
          "Configure Jest to use jsdom for tests that need window/document.",
          "",
          [
            "```js",
            "// jest.config.js",
            "module.exports = {",
            "  testEnvironment: 'jsdom',",
            "};",
            "```",
          ]
        ),
        lines(
          "If you need DOM globals in tests, use `testEnvironment: 'jsdom'`."
        ),
      ],
      per_file_environment: [
        lines(
          "If only a few tests need DOM, set it per file (Vitest) or split projects (Jest).",
          "",
          [
            "Vitest per-file:",
            "```ts",
            '/// <reference types="vitest" />',
            "// @vitest-environment jsdom",
            "```",
          ]
        ),
        lines(
          "Use jsdom only where needed to keep the rest of the suite fast."
        ),
      ],
    },
    duplicates: [
      { solutionGroup: "set_jsdom_environment", times: 2, problemIndex: 0 },
    ],
  },

  {
    problemGroup: "nextjs_module_not_found_fs_client_bundle",
    language: "typescript",
    framework: "nextjs",
    errorSignature: MODULE_NOT_FOUND_FS,
    problems: [
      lines(
        "Next.js build fails: Can't resolve 'fs' when importing a markdown parser in a Client Component.",
        `Error: ${MODULE_NOT_FOUND_FS}`,
        "",
        "I'm importing `gray-matter` in a component with `use client`."
      ),
      lines(
        "Module not found: Can't resolve 'fs' in Next.js app router.",
        `Error: ${MODULE_NOT_FOUND_FS}`,
        "",
        "I imported a server utility into the client."
      ),
      lines(
        "Next.js: Can't resolve fs because a dependency uses fs and I'm bundling it into the browser.",
        `Error: ${MODULE_NOT_FOUND_FS}`,
        "",
        "The import happens in a component that renders on the client."
      ),
      lines(
        "Build error: Module not found fs. Root cause: reading files at runtime in React component.",
        `Error: ${MODULE_NOT_FOUND_FS}`,
        "",
        "I call `fs.readFileSync` in a component."
      ),
      lines(
        "Next.js: Can't resolve fs when importing a package that reads from disk.",
        `Error: ${MODULE_NOT_FOUND_FS}`,
        "",
        "The module is only supposed to run on the server."
      ),
      lines(
        "Module not found: Can't resolve 'path'/'fs' in Next.js when used in client code.",
        `Error: ${MODULE_NOT_FOUND_FS}`
      ),
      lines(
        "Next.js build tries to bundle fs into the browser and fails.",
        `Error: ${MODULE_NOT_FOUND_FS}`
      ),
      lines(
        "Next.js error: Can't resolve fs after adding `use client` to a component.",
        `Error: ${MODULE_NOT_FOUND_FS}`
      ),
    ],
    solutions: {
      move_to_server_component: [
        lines(
          "Only use `fs` in server-only code (Server Components, route handlers, or build-time).",
          "",
          [
            "Fix options:",
            "- Move file reading to a Server Component (remove `use client`).",
            "- Or read files in a route handler and fetch from the client.",
            "- Or precompute at build time and ship JSON to the client.",
          ]
        ),
        lines("`fs` is server-only. Keep it out of client bundles."),
      ],
      split_server_client_modules: [
        lines(
          "Split your module so the client imports a browser-safe entrypoint and the server imports the fs-based one.",
          "",
          [
            "Example:",
            "- `lib/server/readMarkdown.ts` (uses fs)",
            "- `lib/client/renderMarkdown.ts` (no fs)",
          ]
        ),
        lines(
          "Create separate server/client modules so client code never imports fs."
        ),
      ],
    },
    duplicates: [
      { solutionGroup: "move_to_server_component", times: 2, problemIndex: 0 },
    ],
  },

  {
    problemGroup: "nextjs_edge_runtime_node_api_not_supported",
    language: "typescript",
    framework: "nextjs",
    errorSignature: EDGE_NODE_API,
    problems: [
      lines(
        "Next.js route handler fails in Edge Runtime because it uses crypto.",
        `Error: ${EDGE_NODE_API}`,
        "",
        "I set `export const runtime = 'edge'` and then use `crypto`."
      ),
      lines(
        "Middleware fails because Node APIs aren't supported in Edge Runtime.",
        `Error: ${EDGE_NODE_API}`,
        "",
        "I tried to use `fs` inside middleware."
      ),
      lines(
        "Edge runtime error on Vercel: Node.js APIs not supported.",
        `Error: ${EDGE_NODE_API}`,
        "",
        "Using a library that depends on node:crypto."
      ),
      lines(
        "Next.js app router: Edge runtime doesn't support node modules; build succeeds but runtime crashes.",
        `Error: ${EDGE_NODE_API}`,
        "",
        "This only happens after deployment."
      ),
      lines(
        "Edge runtime crash because I used a node-only package in a route handler set to edge.",
        `Error: ${EDGE_NODE_API}`
      ),
      lines(
        "Vercel Edge Function fails due to Node APIs usage (crypto/fs).",
        `Error: ${EDGE_NODE_API}`
      ),
      lines(
        "Next.js: Edge runtime doesn't support Node crypto, but my code imports it.",
        `Error: ${EDGE_NODE_API}`
      ),
      lines(
        "Edge runtime failure: Node APIs not supported; I need to run on Node instead.",
        `Error: ${EDGE_NODE_API}`
      ),
    ],
    solutions: {
      switch_to_node_runtime: [
        lines("Run the handler in Node.js runtime instead of Edge.", "", [
          "```ts",
          "export const runtime = 'nodejs';",
          "```",
          "",
          "Or remove `runtime = 'edge'` and avoid middleware for node-only logic.",
        ]),
        lines("If you need node APIs, use `runtime = 'nodejs'` (not edge)."),
      ],
      replace_node_deps: [
        lines(
          "If you must stay on Edge, remove node-only dependencies and use Web APIs.",
          "",
          [
            "- Use `crypto.subtle` instead of node:crypto when possible.",
            "- Avoid filesystem access entirely in Edge.",
          ]
        ),
        lines("Edge runtime requires Web APIs; remove node-only libraries."),
      ],
    },
    duplicates: [
      { solutionGroup: "switch_to_node_runtime", times: 2, problemIndex: 0 },
    ],
  },

  {
    problemGroup: "ts_paths_vite_alias_missing",
    language: "typescript",
    framework: "vite",
    errorSignature: TS2307_PATHS,
    problems: [
      lines(
        "Vite + TS path alias '@/*' works in editor but build fails with TS2307.",
        `Error: ${TS2307_PATHS}`,
        "",
        "tsconfig has paths, but Vite can't resolve '@'."
      ),
      lines(
        "TS2307 cannot find module '@/components/Button' when running `vite build`.",
        `Error: ${TS2307_PATHS}`,
        "",
        "VSCode resolves it, but Vite doesn't."
      ),
      lines(
        "Vite dev server can't resolve @ alias even though tsconfig paths are set.",
        `Error: ${TS2307_PATHS}`
      ),
      lines(
        "TypeScript paths work for tsc but not for Vite bundling.",
        `Error: ${TS2307_PATHS}`
      ),
      lines(
        "After moving files, Vite no longer resolves '@/..' imports.",
        `Error: ${TS2307_PATHS}`
      ),
      lines(
        "TS path aliases not respected by Vite; getting TS2307 errors.",
        `Error: ${TS2307_PATHS}`
      ),
      lines(
        "Vite + React + TS: Cannot find module '@/...' errors at runtime/build.",
        `Error: ${TS2307_PATHS}`
      ),
      lines(
        "Vite doesn't read tsconfig paths by default; '@' alias unresolved.",
        `Error: ${TS2307_PATHS}`
      ),
    ],
    solutions: {
      add_vite_tsconfig_paths: [
        lines(
          "Install and enable `vite-tsconfig-paths` so Vite respects tsconfig `paths`.",
          "",
          [
            "```ts",
            "import tsconfigPaths from 'vite-tsconfig-paths';",
            "export default defineConfig({ plugins: [tsconfigPaths()] });",
            "```",
          ]
        ),
        lines(
          "Use `vite-tsconfig-paths` (or explicit alias) for @ path resolution."
        ),
      ],
      configure_resolve_alias: [
        lines("Add an explicit alias in Vite config.", "", [
          "```ts",
          "import { resolve } from 'node:path';",
          "export default defineConfig({",
          "  resolve: { alias: { '@': resolve(__dirname, 'src') } },",
          "});",
          "```",
        ]),
        lines("Configure `resolve.alias` so `@` points to your src directory."),
      ],
    },
    duplicates: [
      { solutionGroup: "add_vite_tsconfig_paths", times: 2, problemIndex: 0 },
    ],
  },

  {
    problemGroup: "ts_paths_jest_module_name_mapper_missing",
    language: "typescript",
    framework: "jest",
    errorSignature: TS2307_PATHS,
    problems: [
      lines(
        "Jest tests fail with TS2307 for @ path alias, but app builds fine.",
        `Error: ${TS2307_PATHS}`,
        "",
        "Vite resolves @, but Jest doesn't."
      ),
      lines(
        "TS path alias works in TypeScript but Jest can't find module '@/...'.",
        `Error: ${TS2307_PATHS}`,
        "",
        "Need moduleNameMapper?"
      ),
      lines(
        "Jest can't resolve @ imports even though tsconfig has paths.",
        `Error: ${TS2307_PATHS}`
      ),
      lines(
        "Tests failing after adding @ alias to the project.",
        `Error: ${TS2307_PATHS}`
      ),
      lines(
        "ts-jest doesn't automatically map tsconfig paths; TS2307 in tests.",
        `Error: ${TS2307_PATHS}`
      ),
      lines(
        "Jest runner can't resolve '@/utils/foo' but TypeScript can.",
        `Error: ${TS2307_PATHS}`
      ),
      lines(
        "In CI only: Jest can't find module @/components/Button.",
        `Error: ${TS2307_PATHS}`
      ),
      lines(
        "Jest resolves relative imports but not '@' alias; TS2307.",
        `Error: ${TS2307_PATHS}`
      ),
    ],
    solutions: {
      add_module_name_mapper: [
        lines(
          "Configure `moduleNameMapper` in Jest to mirror tsconfig paths.",
          "",
          [
            "```js",
            "module.exports = {",
            "  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },",
            "};",
            "```",
          ]
        ),
        lines("Jest needs moduleNameMapper for TS path aliases like `@/...`."),
      ],
      ts_jest_paths_to_module_name_mapper: [
        lines("If using ts-jest, generate mappers from tsconfig paths.", "", [
          "```js",
          "const { pathsToModuleNameMapper } = require('ts-jest');",
          "const { compilerOptions } = require('./tsconfig.json');",
          "module.exports = {",
          "  moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths, { prefix: '<rootDir>/' }),",
          "};",
          "```",
        ]),
        lines(
          "Use `pathsToModuleNameMapper` so Jest matches tsconfig path aliases."
        ),
      ],
    },
    duplicates: [
      { solutionGroup: "add_module_name_mapper", times: 2, problemIndex: 0 },
    ],
  },

  {
    problemGroup: "postgres_unique_violation_insert_race",
    language: "sql",
    framework: "postgres",
    errorSignature: PG_UNIQUE_VIOLATION,
    problems: [
      lines(
        "INSERT fails with duplicate key value violates unique constraint under concurrency.",
        `Error: ${PG_UNIQUE_VIOLATION}`,
        "",
        "Two requests try to insert the same user row at the same time."
      ),
      lines(
        "Postgres unique violation when creating a record that might already exist.",
        `Error: ${PG_UNIQUE_VIOLATION}`,
        "",
        "I need idempotent writes."
      ),
      lines(
        "duplicate key value violates unique constraint during upsert-like behavior.",
        `Error: ${PG_UNIQUE_VIOLATION}`,
        "",
        "Currently doing SELECT then INSERT, race condition."
      ),
      lines(
        "Unique constraint violation: I want to insert-or-update but I'm not using ON CONFLICT.",
        `Error: ${PG_UNIQUE_VIOLATION}`
      ),
      lines(
        "Duplicate key error in Postgres because multiple workers insert same job id.",
        `Error: ${PG_UNIQUE_VIOLATION}`
      ),
      lines(
        "duplicate key violates unique constraint in a queue table due to retries.",
        `Error: ${PG_UNIQUE_VIOLATION}`
      ),
      lines(
        "Insert fails with unique violation; need atomic upsert.",
        `Error: ${PG_UNIQUE_VIOLATION}`
      ),
      lines(
        "Postgres unique violation caused by concurrent inserts; fix should be ON CONFLICT.",
        `Error: ${PG_UNIQUE_VIOLATION}`
      ),
    ],
    solutions: {
      use_on_conflict_upsert: [
        lines(
          "Use `INSERT ... ON CONFLICT ... DO UPDATE/DO NOTHING` to make the write atomic.",
          "",
          [
            "```sql",
            "INSERT INTO users (email, name) VALUES ($1, $2)",
            "ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name;",
            "```",
          ]
        ),
        lines("Replace SELECT-then-INSERT with an atomic ON CONFLICT upsert."),
      ],
      catch_and_retry_or_ignore: [
        lines(
          "If duplicates are acceptable, use `ON CONFLICT DO NOTHING` or catch the unique error and fetch the existing row.",
          "",
          [
            "```sql",
            "INSERT INTO jobs (id, payload) VALUES ($1, $2)",
            "ON CONFLICT (id) DO NOTHING;",
            "```",
          ]
        ),
        lines(
          "Handle uniqueness by doing DO NOTHING (or catching the error) and treating it as idempotent."
        ),
      ],
    },
    duplicates: [
      { solutionGroup: "use_on_conflict_upsert", times: 2, problemIndex: 0 },
    ],
  },

  {
    problemGroup: "postgres_unique_index_migration_fails_existing_duplicates",
    language: "sql",
    framework: "postgres",
    errorSignature: PG_UNIQUE_VIOLATION,
    problems: [
      lines(
        "Migration fails when adding a unique index: duplicate key value violates unique constraint.",
        `Error: ${PG_UNIQUE_VIOLATION}`,
        "",
        "We already have duplicate rows, so CREATE UNIQUE INDEX fails."
      ),
      lines(
        "CREATE UNIQUE INDEX fails due to duplicate key values in existing data.",
        `Error: ${PG_UNIQUE_VIOLATION}`,
        "",
        "Need to deduplicate before adding constraint."
      ),
      lines(
        "ALTER TABLE ADD CONSTRAINT UNIQUE fails on production dataset.",
        `Error: ${PG_UNIQUE_VIOLATION}`,
        "",
        "The table contains duplicates. How to fix migration safely?"
      ),
      lines(
        "Postgres unique constraint migration fails: could not create unique index due to duplicates.",
        `Error: ${PG_UNIQUE_VIOLATION}`
      ),
      lines(
        "Adding a unique constraint fails because duplicates exist; need cleanup strategy.",
        `Error: ${PG_UNIQUE_VIOLATION}`
      ),
      lines(
        "We want to enforce uniqueness but existing rows violate it; migration errors with duplicate key.",
        `Error: ${PG_UNIQUE_VIOLATION}`
      ),
      lines(
        "CREATE UNIQUE INDEX CONCURRENTLY fails because duplicates exist.",
        `Error: ${PG_UNIQUE_VIOLATION}`
      ),
      lines(
        "Unique index creation fails on a large table due to duplicates; need a safe rollout.",
        `Error: ${PG_UNIQUE_VIOLATION}`
      ),
    ],
    solutions: {
      dedupe_then_add_constraint: [
        lines(
          "Deduplicate existing rows first, then add the unique index/constraint.",
          "",
          [
            "Approach:",
            "1. Identify duplicates (GROUP BY ... HAVING count(*) > 1).",
            "2. Decide which row to keep (e.g. newest by created_at).",
            "3. Delete/merge duplicates.",
            "4. Add UNIQUE constraint (optionally CONCURRENTLY for indexes).",
          ]
        ),
        lines(
          "You must clean up duplicates before Postgres can enforce a new unique constraint."
        ),
      ],
      partial_unique_index: [
        lines(
          "If you only need uniqueness for a subset, use a partial unique index and backfill over time.",
          "",
          [
            "```sql",
            "CREATE UNIQUE INDEX CONCURRENTLY users_email_unique_active",
            "ON users (email) WHERE deleted_at IS NULL;",
            "```",
          ]
        ),
        lines(
          "Use partial unique indexes when you can't immediately dedupe historical/soft-deleted rows."
        ),
      ],
    },
    duplicates: [
      {
        solutionGroup: "dedupe_then_add_constraint",
        times: 2,
        problemIndex: 0,
      },
    ],
  },
];

export const dedupeHardDataset: DedupeDatasetItem[] =
  groups.flatMap(buildGroup);
