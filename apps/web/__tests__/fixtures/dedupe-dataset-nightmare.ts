import { dedupeHardDataset } from "./dedupe-dataset-hard";

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

const PG_ECONNREFUSED = "connect ECONNREFUSED 127.0.0.1:5432";

const PIP_SSL_VERIFY_FAILED =
  "SSLError: [SSL: CERTIFICATE_VERIFY_FAILED] certificate verify failed";

const JWT_INVALID_SIGNATURE = "JsonWebTokenError: invalid signature";

const ERR_MODULE_NOT_FOUND = "Error [ERR_MODULE_NOT_FOUND]: Cannot find module";

const MOD_NOT_FOUND_DOTENV = "ModuleNotFoundError: No module named 'dotenv'";

const NEXT_HYDRATION_FAILED =
  "Hydration failed because the initial UI does not match what was rendered on the server.";

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
    problemGroup: "node_pg_econnrefused_postgres_not_running",
    language: "typescript",
    framework: "pg",
    errorSignature: PG_ECONNREFUSED,
    problems: [
      lines(
        "Node API cannot connect to local Postgres.",
        `Error: ${PG_ECONNREFUSED}`,
        "",
        "I run `npm run dev` and it fails instantly. `psql` to localhost:5432 also fails."
      ),
      lines(
        "connect ECONNREFUSED 127.0.0.1:5432 after reboot.",
        `Error: ${PG_ECONNREFUSED}`,
        "",
        "I use Homebrew Postgres. It worked yesterday."
      ),
      lines(
        "Tests fail with ECONNREFUSED to Postgres.",
        `Error: ${PG_ECONNREFUSED}`,
        "",
        "CI/local both fail. Looks like nothing is listening on 5432."
      ),
      lines(
        "Postgres connection refused even with correct DATABASE_URL.",
        `Error: ${PG_ECONNREFUSED}`,
        "",
        "`lsof -i :5432` shows nothing. I think the service is down."
      ),
      lines(
        "ECONNREFUSED to 127.0.0.1:5432 in a plain Node script using pg.",
        `Error: ${PG_ECONNREFUSED}`,
        "",
        "This is not Docker. Just local dev."
      ),
      lines(
        "Local API can't reach postgres: connection refused.",
        `Error: ${PG_ECONNREFUSED}`,
        "",
        "Maybe port is wrong or service isn't started."
      ),
      lines(
        "ECONNREFUSED when running migrations.",
        `Error: ${PG_ECONNREFUSED}`,
        "",
        "The database isn't reachable on localhost."
      ),
      lines(
        "pg client can't connect to 127.0.0.1:5432. It feels like Postgres is stopped.",
        `Error: ${PG_ECONNREFUSED}`
      ),
    ],
    solutions: {
      start_postgres_service: [
        lines("Start Postgres and verify the port is listening.", "", [
          "macOS (Homebrew): `brew services start postgresql` (or `postgresql@14`)",
          "Linux (systemd): `sudo systemctl start postgresql`",
          "Docker: ensure the container is running and ports are published",
          "Verify: `lsof -i :5432` or `pg_isready -h 127.0.0.1 -p 5432`",
        ]),
        lines(
          "The error is a TCP refusal: nothing is accepting connections on 127.0.0.1:5432."
        ),
      ],
      check_host_port: [
        lines(
          "Double-check host/port and that you're pointing at the right DB.",
          "",
          [
            "1. Confirm `DATABASE_URL` uses the expected host and port.",
            "2. If Postgres runs on a non-default port, update it (e.g. 5433).",
            "3. If you have multiple Postgres installs, ensure you're starting the one you connect to.",
          ]
        ),
        lines(
          "ECONNREFUSED often means the service is down or you're targeting the wrong port."
        ),
      ],
    },
    duplicates: [
      { solutionGroup: "start_postgres_service", times: 3, problemIndex: 0 },
      { solutionGroup: "check_host_port", times: 1, problemIndex: 1 },
    ],
  },

  {
    problemGroup: "node_pg_econnrefused_docker_localhost",
    language: "typescript",
    framework: "pg",
    errorSignature: PG_ECONNREFUSED,
    problems: [
      lines(
        "ECONNREFUSED to 127.0.0.1:5432 when my Node app runs in Docker.",
        `Error: ${PG_ECONNREFUSED}`,
        "",
        "Postgres is running on my host machine, but the container tries localhost."
      ),
      lines(
        "Dockerized Next.js API can't connect to Postgres: connect ECONNREFUSED 127.0.0.1:5432.",
        `Error: ${PG_ECONNREFUSED}`,
        "",
        "I used DATABASE_URL with localhost. Works on my machine, fails in container."
      ),
      lines(
        "ECONNREFUSED from container to postgres service.",
        `Error: ${PG_ECONNREFUSED}`,
        "",
        "I'm running postgres in another container in docker-compose."
      ),
      lines(
        "Container can't reach DB on localhost:5432.",
        `Error: ${PG_ECONNREFUSED}`,
        "",
        "I think localhost points to the container itself."
      ),
      lines(
        "In docker-compose, API tries to connect to 127.0.0.1 and gets refused.",
        `Error: ${PG_ECONNREFUSED}`,
        "",
        "The postgres container is named `db`."
      ),
      lines(
        "ECONNREFUSED connecting to 127.0.0.1:5432 inside Docker.",
        `Error: ${PG_ECONNREFUSED}`,
        "",
        "Need to connect to host or service name, not localhost."
      ),
      lines(
        "My app works locally but not in Docker: pg connects to localhost and refuses.",
        `Error: ${PG_ECONNREFUSED}`
      ),
      lines(
        "Docker container can't connect to Postgres with localhost:5432, connection refused.",
        `Error: ${PG_ECONNREFUSED}`
      ),
    ],
    solutions: {
      use_service_name_in_compose: [
        lines(
          "In docker-compose, use the Postgres service name as the host (not 127.0.0.1).",
          "",
          [
            "Example:",
            "- Postgres service name: `db`",
            "- Use `postgres://user:pass@db:5432/mydb`",
            "",
            "Containers resolve service names via the compose network.",
          ]
        ),
        lines("Use the compose service name (e.g. `db`) as the hostname."),
      ],
      connect_to_host_from_container: [
        lines(
          "If Postgres is on your host machine, connect via a host-reachable address.",
          "",
          [
            "macOS/Windows Docker Desktop: use `host.docker.internal`",
            "Linux: use the host IP or set up `--network=host` (not recommended for compose apps)",
            "",
            "Example: `postgres://user:pass@host.docker.internal:5432/mydb`",
          ]
        ),
        lines(
          "From inside Docker, `127.0.0.1` is the container. Use `host.docker.internal` or a service name."
        ),
      ],
    },
    duplicates: [
      {
        solutionGroup: "use_service_name_in_compose",
        times: 2,
        problemIndex: 4,
      },
      {
        solutionGroup: "connect_to_host_from_container",
        times: 2,
        problemIndex: 0,
      },
    ],
  },

  {
    problemGroup: "pip_ssl_verify_failed_corporate_proxy",
    language: "python",
    framework: "pip",
    errorSignature: PIP_SSL_VERIFY_FAILED,
    problems: [
      lines(
        "pip install fails at work with SSL certificate verify failed.",
        `Error: ${PIP_SSL_VERIFY_FAILED}`,
        "",
        "We're behind a corporate proxy (Zscaler). Works on my home network."
      ),
      lines(
        "pip can't download packages: CERTIFICATE_VERIFY_FAILED.",
        `Error: ${PIP_SSL_VERIFY_FAILED}`,
        "",
        "Company laptop, traffic is inspected. Browser works, pip doesn't."
      ),
      lines(
        "SSL verify failed when running pip on a corporate network.",
        `Error: ${PIP_SSL_VERIFY_FAILED}`,
        "",
        "I suspect MITM proxy / custom CA."
      ),
      lines(
        "pip fails in CI runner inside corp network: certificate verify failed.",
        `Error: ${PIP_SSL_VERIFY_FAILED}`,
        "",
        "We have an internal root CA."
      ),
      lines(
        "pip install errors with SSL CERTIFICATE_VERIFY_FAILED behind proxy.",
        `Error: ${PIP_SSL_VERIFY_FAILED}`,
        "",
        "I can curl with `--cacert corp.pem`."
      ),
      lines(
        "SSL verification error with pip only on VPN.",
        `Error: ${PIP_SSL_VERIFY_FAILED}`,
        "",
        "VPN does HTTPS inspection."
      ),
      lines(
        "pip: certificate verify failed, likely because proxy replaces certs.",
        `Error: ${PIP_SSL_VERIFY_FAILED}`
      ),
      lines(
        "pip can't connect through corporate proxy without trusting corp CA.",
        `Error: ${PIP_SSL_VERIFY_FAILED}`
      ),
    ],
    solutions: {
      install_corporate_ca: [
        lines(
          "Install the corporate root CA and point pip/requests at it.",
          "",
          [
            "1. Get the corporate CA PEM from IT.",
            "2. Add it to your OS trust store (preferred).",
            "3. Or set one of:",
            "- `PIP_CERT=/path/to/corp-ca.pem`",
            "- `REQUESTS_CA_BUNDLE=/path/to/corp-ca.pem`",
            "",
            "Avoid `--trusted-host` unless you understand the security tradeoff.",
          ]
        ),
        lines(
          "The proxy is intercepting TLS. You need to trust the corporate CA in your environment."
        ),
      ],
      pip_config_cert: [
        lines("Configure pip to use your CA bundle via config.", "", [
          "Example `pip.ini` / `pip.conf`:",
          "```ini",
          "[global]",
          "cert = /path/to/corp-ca.pem",
          "```",
        ]),
        lines("Set pip's `cert` config to your corporate CA bundle."),
      ],
    },
    duplicates: [
      { solutionGroup: "install_corporate_ca", times: 2, problemIndex: 0 },
    ],
  },

  {
    problemGroup: "pip_ssl_verify_failed_outdated_cert_store",
    language: "python",
    framework: "pip",
    errorSignature: PIP_SSL_VERIFY_FAILED,
    problems: [
      lines(
        "pip install fails with CERTIFICATE_VERIFY_FAILED on an old Ubuntu server.",
        `Error: ${PIP_SSL_VERIFY_FAILED}`,
        "",
        "No corporate proxy. This is a legacy VM."
      ),
      lines(
        "CERTIFICATE_VERIFY_FAILED when installing packages on a fresh Python install.",
        `Error: ${PIP_SSL_VERIFY_FAILED}`,
        "",
        "I think CA certificates are missing/outdated on this machine."
      ),
      lines(
        "pip SSL verify failed after OS update, no proxy involved.",
        `Error: ${PIP_SSL_VERIFY_FAILED}`,
        "",
        "Other tools also complain about cert chain."
      ),
      lines(
        "pip can't verify SSL certs on a minimal container image.",
        `Error: ${PIP_SSL_VERIFY_FAILED}`,
        "",
        "Probably missing `ca-certificates`."
      ),
      lines(
        "CERTIFICATE_VERIFY_FAILED when running pip inside alpine container.",
        `Error: ${PIP_SSL_VERIFY_FAILED}`
      ),
      lines(
        "pip SSL error on a server with outdated root certs.",
        `Error: ${PIP_SSL_VERIFY_FAILED}`
      ),
      lines(
        "pip install fails due to missing CA bundle.",
        `Error: ${PIP_SSL_VERIFY_FAILED}`
      ),
      lines(
        "SSL verify failed in pip when CA certificates aren't installed.",
        `Error: ${PIP_SSL_VERIFY_FAILED}`
      ),
    ],
    solutions: {
      install_ca_certificates: [
        lines("Install/update the OS CA certificates and retry.", "", [
          "Debian/Ubuntu: `sudo apt-get update && sudo apt-get install -y ca-certificates`",
          "Alpine: `apk add --no-cache ca-certificates`",
          "Then rerun pip.",
        ]),
        lines(
          "On minimal images/old hosts, pip fails because the system CA bundle is missing or outdated."
        ),
      ],
      upgrade_certifi: [
        lines(
          "Upgrade certifi (and pip) to refresh Python's cert bundle.",
          "",
          ["```bash", "python -m pip install -U pip certifi", "```"]
        ),
        lines(
          "Updating `certifi` can fix SSL verification failures in Python."
        ),
      ],
    },
    duplicates: [
      { solutionGroup: "install_ca_certificates", times: 2, problemIndex: 3 },
    ],
  },

  {
    problemGroup: "jwt_invalid_signature_wrong_secret",
    language: "typescript",
    framework: "jsonwebtoken",
    errorSignature: JWT_INVALID_SIGNATURE,
    problems: [
      lines(
        "jsonwebtoken verify fails with invalid signature after deploy.",
        `Error: ${JWT_INVALID_SIGNATURE}`,
        "",
        "Works locally. In prod, every request fails. We load JWT_SECRET from env."
      ),
      lines(
        "JWT invalid signature between two services.",
        `Error: ${JWT_INVALID_SIGNATURE}`,
        "",
        "Service A signs tokens, service B verifies. Likely different secrets."
      ),
      lines(
        "Invalid signature when verifying JWT in Next.js API route.",
        `Error: ${JWT_INVALID_SIGNATURE}`,
        "",
        "I think I'm using the wrong secret key on this environment."
      ),
      lines(
        "jsonwebtoken: invalid signature because JWT_SECRET is empty on Preview deployment.",
        `Error: ${JWT_INVALID_SIGNATURE}`
      ),
      lines(
        "JWT invalid signature after rotating secrets; some instances still use old value.",
        `Error: ${JWT_INVALID_SIGNATURE}`
      ),
      lines(
        "invalid signature when verifying token; I accidentally used a different env var name.",
        `Error: ${JWT_INVALID_SIGNATURE}`
      ),
      lines(
        "All JWTs fail signature verification in production, likely secret mismatch.",
        `Error: ${JWT_INVALID_SIGNATURE}`
      ),
      lines(
        "jsonwebtoken verify throws invalid signature due to wrong secret string.",
        `Error: ${JWT_INVALID_SIGNATURE}`
      ),
    ],
    solutions: {
      ensure_same_secret: [
        lines(
          "Ensure the signer and verifier use the exact same secret value (and encoding).",
          "",
          [
            "1. Confirm `JWT_SECRET` is set and identical across services/environments.",
            "2. Beware whitespace/newlines in secrets (copy/paste).",
            "3. After changing env vars, redeploy all instances.",
          ]
        ),
        lines(
          "This error usually means you're verifying with the wrong secret."
        ),
      ],
      validate_env_loading: [
        lines("Validate env loading and avoid mixing up secrets/keys.", "", [
          "- Log whether the secret is present (never log the value).",
          "- Ensure you're not using a different key (e.g. API key) for JWT verification.",
          "- If using multiple issuers, verify you're picking the right secret per issuer.",
        ]),
        lines("Most production-only cases are env/config mismatch."),
      ],
    },
    duplicates: [
      { solutionGroup: "ensure_same_secret", times: 2, problemIndex: 0 },
    ],
  },

  {
    problemGroup: "jwt_invalid_signature_algorithm_or_key_mismatch",
    language: "typescript",
    framework: "jsonwebtoken",
    errorSignature: JWT_INVALID_SIGNATURE,
    problems: [
      lines(
        "JWT invalid signature when verifying RS256 token with a shared secret.",
        `Error: ${JWT_INVALID_SIGNATURE}`,
        "",
        "Token header says alg=RS256, but my code uses `jwt.verify(token, process.env.JWT_SECRET)`."
      ),
      lines(
        "jsonwebtoken invalid signature with Auth0 tokens (RS256).",
        `Error: ${JWT_INVALID_SIGNATURE}`,
        "",
        "I think I need to verify with a public key / JWKS, not an HS secret."
      ),
      lines(
        "Invalid signature: using the wrong key type for the token.",
        `Error: ${JWT_INVALID_SIGNATURE}`,
        "",
        "Issuer uses RS256 but I'm passing a string secret."
      ),
      lines(
        "JWT verify fails: algorithm mismatch (HS256 vs RS256).",
        `Error: ${JWT_INVALID_SIGNATURE}`
      ),
      lines(
        "jsonwebtoken invalid signature because I'm verifying with the wrong public key.",
        `Error: ${JWT_INVALID_SIGNATURE}`,
        "",
        "I copied the wrong cert from JWKS."
      ),
      lines(
        "invalid signature for RS256 token; need JWKS fetching and algorithm restriction.",
        `Error: ${JWT_INVALID_SIGNATURE}`
      ),
      lines(
        "JWT invalid signature due to key mismatch, not env secret mismatch.",
        `Error: ${JWT_INVALID_SIGNATURE}`
      ),
      lines(
        "jsonwebtoken invalid signature because verifier key doesn't match signing key.",
        `Error: ${JWT_INVALID_SIGNATURE}`
      ),
    ],
    solutions: {
      verify_with_public_key: [
        lines(
          "Verify RS256 tokens with the issuer's public key (or JWKS), and restrict algorithms.",
          "",
          [
            "```ts",
            "jwt.verify(token, publicKeyPem, { algorithms: ['RS256'] });",
            "```",
            "",
            "If the issuer rotates keys, fetch the right key from JWKS based on `kid`.",
          ]
        ),
        lines("RS256 tokens require a public key, not a shared secret."),
      ],
      set_correct_algorithm: [
        lines(
          "Make sure the verifier expects the same algorithm as the issuer.",
          "",
          [
            "- Inspect the JWT header (`alg`, `kid`).",
            "- Configure verification to match (`HS256` vs `RS256`).",
            "- Use the matching secret/private key/public key accordingly.",
          ]
        ),
        lines("Algorithm/key mismatch can surface as `invalid signature`."),
      ],
    },
    duplicates: [
      { solutionGroup: "verify_with_public_key", times: 2, problemIndex: 0 },
    ],
  },

  {
    problemGroup: "node_esm_err_module_not_found_missing_extension",
    language: "typescript",
    framework: "node",
    errorSignature: ERR_MODULE_NOT_FOUND,
    problems: [
      lines(
        "Node ESM build crashes: cannot find module when importing a local file without extension.",
        `Error: ${ERR_MODULE_NOT_FOUND}`,
        "",
        "package.json has `type: module`. After `tsc` build, `node dist/index.js` fails.",
        "",
        "Example:",
        "```ts",
        "import './utils'; // utils.ts -> dist/utils.js",
        "```"
      ),
      lines(
        "ERR_MODULE_NOT_FOUND after switching to ESM.",
        `Error: ${ERR_MODULE_NOT_FOUND}`,
        "",
        "Imports like `./foo` worked in CJS, now Node wants the `.js` extension."
      ),
      lines(
        "Cannot find module when running compiled TypeScript in Node ESM.",
        `Error: ${ERR_MODULE_NOT_FOUND}`,
        "",
        "The file exists in dist, but the import doesn't include `.js`."
      ),
      lines(
        "Node ESM: ERR_MODULE_NOT_FOUND for relative imports without file extensions.",
        `Error: ${ERR_MODULE_NOT_FOUND}`
      ),
      lines(
        "ESM runtime cannot resolve `./bar` because output file is bar.js.",
        `Error: ${ERR_MODULE_NOT_FOUND}`
      ),
      lines(
        "ERR_MODULE_NOT_FOUND after build: need explicit `.js` in import paths.",
        `Error: ${ERR_MODULE_NOT_FOUND}`
      ),
      lines(
        "Node ESM fails to load relative import without extension.",
        `Error: ${ERR_MODULE_NOT_FOUND}`
      ),
      lines(
        "TypeScript + Node ESM: module not found unless I add `.js` extensions.",
        `Error: ${ERR_MODULE_NOT_FOUND}`
      ),
    ],
    solutions: {
      add_js_extensions: [
        lines(
          "Add `.js` extensions in ESM import specifiers (in source).",
          "",
          [
            "```ts",
            "import './utils.js';",
            "```",
            "",
            "TypeScript will still resolve `utils.ts` at compile time, but the emitted JS import is correct.",
          ]
        ),
        lines("In Node ESM, relative imports must include extensions."),
      ],
      use_bundler_or_node_resolution: [
        lines(
          "Use a bundler (or configure your tooling) so runtime resolution matches your source imports.",
          "",
          [
            "Options:",
            "- Bundle with esbuild/tsup/rollup and emit a single file.",
            "- (Not recommended) `--experimental-specifier-resolution=node` for Node.",
          ]
        ),
        lines(
          "Bundling avoids ESM specifier rules and makes imports deterministic."
        ),
      ],
    },
    duplicates: [
      { solutionGroup: "add_js_extensions", times: 2, problemIndex: 0 },
    ],
  },

  {
    problemGroup: "node_esm_err_module_not_found_tsconfig_paths_runtime",
    language: "typescript",
    framework: "node",
    errorSignature: ERR_MODULE_NOT_FOUND,
    problems: [
      lines(
        "Node runtime cannot resolve TS path alias after build (ERR_MODULE_NOT_FOUND).",
        `Error: ${ERR_MODULE_NOT_FOUND}`,
        "",
        "In tsconfig I have:",
        "```json",
        '{ "compilerOptions": { "baseUrl": ".", "paths": { "@/*": ["src/*"] } } }',
        "```",
        "But `node dist/index.js` can't resolve `@/utils/logger`."
      ),
      lines(
        "ERR_MODULE_NOT_FOUND for `@/` imports in Node, but TypeScript compiles fine.",
        `Error: ${ERR_MODULE_NOT_FOUND}`,
        "",
        "The alias works in the editor and in `tsc`, but not at runtime."
      ),
      lines(
        "Cannot find module '@/config' when running compiled JS in Node.",
        `Error: ${ERR_MODULE_NOT_FOUND}`,
        "",
        "This is a tsconfig paths issue, not a missing file extension."
      ),
      lines(
        "Node can't resolve tsconfig paths; ERR_MODULE_NOT_FOUND for @ alias.",
        `Error: ${ERR_MODULE_NOT_FOUND}`
      ),
      lines(
        "Runtime fails after build because @ path alias isn't applied by Node.",
        `Error: ${ERR_MODULE_NOT_FOUND}`
      ),
      lines(
        "ERR_MODULE_NOT_FOUND for aliased imports; Node doesn't read tsconfig paths.",
        `Error: ${ERR_MODULE_NOT_FOUND}`
      ),
      lines(
        "TypeScript paths work, Node runtime can't resolve alias imports.",
        `Error: ${ERR_MODULE_NOT_FOUND}`
      ),
      lines(
        "Node ESM/CJS runtime can't resolve `@/...` without an imports map/bundler.",
        `Error: ${ERR_MODULE_NOT_FOUND}`
      ),
    ],
    solutions: {
      avoid_ts_paths_in_runtime: [
        lines(
          "Don't rely on tsconfig `paths` at runtime. Use relative imports or a bundler.",
          "",
          [
            "Fix options:",
            "- Replace `@/x` with relative paths.",
            "- Bundle your app (esbuild/tsup) so aliases resolve at build time.",
          ]
        ),
        lines(
          "tsconfig `paths` is a TypeScript feature; Node won't resolve it automatically."
        ),
      ],
      use_imports_map: [
        lines(
          "If you need aliases in Node ESM, use `package.json` imports (or a loader).",
          "",
          [
            "```json",
            "{",
            '  "imports": {',
            '    "#/*": "./dist/*"',
            "  }",
            "}",
            "```",
            "",
            "Then import `#/*` instead of `@/*`.",
          ]
        ),
        lines("Use an imports map-style alias that Node actually supports."),
      ],
    },
    duplicates: [
      {
        solutionGroup: "avoid_ts_paths_in_runtime",
        times: 2,
        problemIndex: 0,
      },
    ],
  },

  {
    problemGroup: "python_modulenotfound_dotenv_missing_in_runtime_env",
    language: "python",
    framework: "python",
    errorSignature: MOD_NOT_FOUND_DOTENV,
    problems: [
      lines(
        "Python crashes on import: No module named 'dotenv'.",
        `Error: ${MOD_NOT_FOUND_DOTENV}`,
        "",
        "I didn't install anything yet; just cloned the repo and ran `python main.py`."
      ),
      lines(
        "ModuleNotFoundError for dotenv when running my script.",
        `Error: ${MOD_NOT_FOUND_DOTENV}`,
        "",
        "pip freeze doesn't show python-dotenv."
      ),
      lines(
        "No module named dotenv in a new virtualenv.",
        `Error: ${MOD_NOT_FOUND_DOTENV}`
      ),
      lines(
        "Python: import dotenv fails because dependency isn't installed.",
        `Error: ${MOD_NOT_FOUND_DOTENV}`
      ),
      lines(
        "ModuleNotFoundError dotenv after pulling changes; requirements not updated locally.",
        `Error: ${MOD_NOT_FOUND_DOTENV}`
      ),
      lines(
        "No module named 'dotenv' - missing python-dotenv package.",
        `Error: ${MOD_NOT_FOUND_DOTENV}`
      ),
      lines(
        "dotenv import error in Python because package isn't installed.",
        `Error: ${MOD_NOT_FOUND_DOTENV}`
      ),
      lines(
        "Python import fails for dotenv on a clean machine.",
        `Error: ${MOD_NOT_FOUND_DOTENV}`
      ),
      lines(
        "I installed python-dotenv but still get No module named 'dotenv'.",
        `Error: ${MOD_NOT_FOUND_DOTENV}`,
        "",
        "`pip install python-dotenv` succeeds, but running `python app.py` still fails."
      ),
      lines(
        "ModuleNotFoundError dotenv even though pip says it's installed.",
        `Error: ${MOD_NOT_FOUND_DOTENV}`,
        "",
        "I have multiple Python versions. Might be installing to one and running another."
      ),
      lines(
        "dotenv import fails in VSCode but works in terminal (or vice versa).",
        `Error: ${MOD_NOT_FOUND_DOTENV}`,
        "",
        "Looks like interpreter mismatch."
      ),
      lines(
        "No module named dotenv because I'm not using the virtualenv I installed into.",
        `Error: ${MOD_NOT_FOUND_DOTENV}`
      ),
      lines(
        "I ran `pip install` but my script still can't import dotenv; wrong env.",
        `Error: ${MOD_NOT_FOUND_DOTENV}`
      ),
      lines(
        "ModuleNotFoundError dotenv due to pip/python mismatch (system python vs venv).",
        `Error: ${MOD_NOT_FOUND_DOTENV}`
      ),
      lines(
        "python-dotenv is installed, but `python` is not the same env as `pip`.",
        `Error: ${MOD_NOT_FOUND_DOTENV}`
      ),
      lines(
        "Wrong interpreter: installed dependency in one env, running in another.",
        `Error: ${MOD_NOT_FOUND_DOTENV}`
      ),
    ],
    solutions: {
      install_python_dotenv: [
        lines("Install the dependency in your environment.", "", [
          "```bash",
          "python -m pip install python-dotenv",
          "```",
          "Or add it to `requirements.txt` / `pyproject.toml` and install deps.",
        ]),
        lines("Install `python-dotenv` so `import dotenv` works."),
      ],
      install_project_requirements: [
        lines("Install project requirements before running.", "", [
          "- `python -m pip install -r requirements.txt`",
          "- or `pip install -e .` / `poetry install` depending on the project",
        ]),
        lines(
          "This is a missing dependency; install the project's requirements."
        ),
      ],
      use_python_m_pip: [
        lines(
          "Install into the interpreter you're actually running by using `python -m pip`.",
          "",
          [
            "```bash",
            "python -m pip install python-dotenv",
            'python -c "import dotenv; print(dotenv.__file__)"',
            "```",
          ]
        ),
        lines("Use `python -m pip` to avoid pip/python environment mismatch."),
      ],
      activate_correct_venv: [
        lines("Activate/select the correct virtualenv/interpreter.", "", [
          "- Activate venv: `source .venv/bin/activate` (macOS/Linux) or `.venv\\\\Scripts\\\\activate` (Windows)",
          "- In VSCode: select the interpreter for the workspace",
          "- Verify: `which python` and `python -m pip -V`",
        ]),
        lines(
          "This is almost always running the wrong Python interpreter/venv."
        ),
      ],
    },
    duplicates: [
      { solutionGroup: "install_python_dotenv", times: 2, problemIndex: 0 },
      { solutionGroup: "activate_correct_venv", times: 2, problemIndex: 8 },
    ],
  },

  {
    problemGroup: "nextjs_hydration_failed_nondeterministic_render",
    language: "typescript",
    framework: "nextjs",
    errorSignature: NEXT_HYDRATION_FAILED,
    problems: [
      lines(
        "Next.js hydration failed because I render Date.now() in a component.",
        `Error: ${NEXT_HYDRATION_FAILED}`,
        "",
        "Server renders one timestamp, client renders another, causing mismatch."
      ),
      lines(
        "Hydration mismatch when using Math.random() in render.",
        `Error: ${NEXT_HYDRATION_FAILED}`
      ),
      lines(
        "Hydration failed because I format a date with the user's locale/timezone in render.",
        `Error: ${NEXT_HYDRATION_FAILED}`,
        "",
        "Server timezone differs from client."
      ),
      lines(
        "Next.js: hydration error caused by non-deterministic rendering (random/id/time).",
        `Error: ${NEXT_HYDRATION_FAILED}`
      ),
      lines(
        "Hydration failed due to rendering a UUID at render time on both server and client.",
        `Error: ${NEXT_HYDRATION_FAILED}`
      ),
      lines(
        "Hydration mismatch because render output depends on current time.",
        `Error: ${NEXT_HYDRATION_FAILED}`
      ),
      lines(
        "Hydration failed: SSR markup differs because of Date/Random usage.",
        `Error: ${NEXT_HYDRATION_FAILED}`
      ),
      lines(
        "Next.js hydration issue due to non-determinism in initial render.",
        `Error: ${NEXT_HYDRATION_FAILED}`
      ),
    ],
    solutions: {
      compute_client_only: [
        lines(
          "Compute non-deterministic values on the client after mount (or pass deterministic data from the server).",
          "",
          [
            "```tsx",
            "const [now, setNow] = useState<number | null>(null);",
            "useEffect(() => setNow(Date.now()), []);",
            "return <span>{now ?? ''}</span>;",
            "```",
          ]
        ),
        lines(
          "Avoid Date.now()/Math.random() in SSR render output; compute it after mount."
        ),
      ],
      render_placeholder_then_update: [
        lines("Render stable SSR markup and update after hydration.", "", [
          "- SSR: show a placeholder/skeleton",
          "- Client: compute and replace the content in `useEffect`",
        ]),
        lines(
          "Keep server markup deterministic, then update the UI client-side."
        ),
      ],
    },
    duplicates: [
      { solutionGroup: "compute_client_only", times: 2, problemIndex: 0 },
    ],
  },

  {
    problemGroup: "nextjs_hydration_failed_invalid_html_nesting",
    language: "typescript",
    framework: "nextjs",
    errorSignature: NEXT_HYDRATION_FAILED,
    problems: [
      lines(
        "Hydration failed due to invalid HTML nesting (nested <a> tags).",
        `Error: ${NEXT_HYDRATION_FAILED}`,
        "",
        "I use Next.js <Link> and also wrap an <a> around it, so I end up with <a><a>...</a></a>."
      ),
      lines(
        "Next.js hydration mismatch because of nested <button> elements.",
        `Error: ${NEXT_HYDRATION_FAILED}`
      ),
      lines(
        "Hydration failed: invalid DOM structure differs between server/client.",
        `Error: ${NEXT_HYDRATION_FAILED}`,
        "",
        "There is a warning about invalid HTML in the console."
      ),
      lines(
        "Hydration error caused by incorrect HTML markup (block element inside <p>).",
        `Error: ${NEXT_HYDRATION_FAILED}`
      ),
      lines(
        "Hydration mismatch: server renders different markup due to invalid nesting rules.",
        `Error: ${NEXT_HYDRATION_FAILED}`
      ),
      lines(
        "Next.js hydration failed; console warns about validateDOMNesting.",
        `Error: ${NEXT_HYDRATION_FAILED}`
      ),
      lines(
        "Hydration failed due to nested anchors from Link + <a> usage.",
        `Error: ${NEXT_HYDRATION_FAILED}`
      ),
      lines(
        "Hydration mismatch coming from invalid HTML structure in JSX.",
        `Error: ${NEXT_HYDRATION_FAILED}`
      ),
    ],
    solutions: {
      fix_invalid_nesting: [
        lines(
          "Fix the HTML structure so server/client render identical valid markup.",
          "",
          [
            "- Remove nested anchors/buttons.",
            "- In Next.js, don't wrap <Link> with an extra <a> unless needed by your Next version.",
            "- Fix validateDOMNesting warnings first; they often cause hydration issues.",
          ]
        ),
        lines(
          "Invalid markup can make hydration fail even if data is the same."
        ),
      ],
      remove_conditional_markup_diff: [
        lines(
          "Ensure your server and client render the same element structure on first paint.",
          "",
          [
            "If markup changes based on environment, move that change to `useEffect` or dynamic import.",
          ]
        ),
        lines(
          "Hydration requires the same initial element tree between SSR and the client."
        ),
      ],
    },
    duplicates: [
      { solutionGroup: "fix_invalid_nesting", times: 2, problemIndex: 0 },
    ],
  },
];

export const dedupeNightmareDataset: DedupeDatasetItem[] = [
  ...dedupeHardDataset,
  ...groups.flatMap(buildGroup),
];
