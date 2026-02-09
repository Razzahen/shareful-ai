const GITHUB_API = "https://api.github.com";
const SHARE_PATH_RE = /^shares\/([^/]+)\/SHARE\.md$/;

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

export async function discoverShareSlugs(
  owner: string,
  repo: string
): Promise<string[]> {
  const url = `${GITHUB_API}/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) {
    return [];
  }
  const data = await res.json();
  const slugs: string[] = [];
  for (const item of data.tree) {
    const match = item.path.match(SHARE_PATH_RE);
    if (match) {
      slugs.push(match[1]);
    }
  }
  return slugs;
}

export async function fetchDefaultBranchSha(
  owner: string,
  repo: string
): Promise<string | null> {
  const url = `${GITHUB_API}/repos/${owner}/${repo}/commits/HEAD`;
  const res = await fetch(url, {
    headers: { ...headers(), Accept: "application/vnd.github.sha" },
  });
  if (!res.ok) {
    return null;
  }
  return res.text();
}

export async function fetchFileContent(
  owner: string,
  repo: string,
  path: string
): Promise<string | null> {
  const url = `${GITHUB_API}/repos/${owner}/${repo}/contents/${path}`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) {
    return null;
  }
  const data = await res.json();
  return Buffer.from(data.content, "base64").toString("utf-8");
}

export async function fetchShareMd(
  owner: string,
  repo: string,
  slug: string
): Promise<string> {
  const content = await fetchFileContent(
    owner,
    repo,
    `shares/${slug}/SHARE.md`
  );
  if (content === null) {
    throw new Error(
      `Failed to fetch SHARE.md for ${slug} from ${owner}/${repo}`
    );
  }
  return content;
}
