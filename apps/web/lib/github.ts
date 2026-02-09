import type { ShareManifest } from "./types";

const GITHUB_API = "https://api.github.com";

function headers(): HeadersInit {
  const h: HeadersInit = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "shareful-indexer",
  };
  if (process.env.GITHUB_TOKEN) {
    h.Authorization = `token ${process.env.GITHUB_TOKEN}`;
  }
  return h;
}

export async function fetchManifest(
  owner: string,
  repo: string
): Promise<ShareManifest> {
  const url = `${GITHUB_API}/repos/${owner}/${repo}/contents/shareful.json`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) {
    throw new Error(
      `Failed to fetch shareful.json from ${owner}/${repo}: ${res.status}`
    );
  }
  const data = await res.json();
  const content = Buffer.from(data.content, "base64").toString("utf-8");
  return JSON.parse(content) as ShareManifest;
}

export async function fetchShareMd(
  owner: string,
  repo: string,
  slug: string
): Promise<string> {
  const url = `${GITHUB_API}/repos/${owner}/${repo}/contents/shares/${slug}/SHARE.md`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) {
    throw new Error(
      `Failed to fetch SHARE.md for ${slug} from ${owner}/${repo}: ${res.status}`
    );
  }
  const data = await res.json();
  return Buffer.from(data.content, "base64").toString("utf-8");
}

export async function repoExists(
  owner: string,
  repo: string
): Promise<boolean> {
  const url = `${GITHUB_API}/repos/${owner}/${repo}`;
  const res = await fetch(url, { headers: headers() });
  return res.ok;
}

export async function manifestExists(
  owner: string,
  repo: string
): Promise<boolean> {
  const url = `${GITHUB_API}/repos/${owner}/${repo}/contents/shareful.json`;
  const res = await fetch(url, { headers: headers() });
  return res.ok;
}
