export type SolutionType =
  | "fix"
  | "workaround"
  | "pattern"
  | "reference"
  | "config";

export interface ShareFrontmatter {
  title: string;
  slug: string;
  tags: string[];
  problem: string;
  solution_type: SolutionType;
  verified?: boolean;
  created?: string;
  updated?: string;
  ai_provider?: "claude" | "gpt" | "gemini";
  environment?: {
    language?: string;
    framework?: string;
    version?: string;
  };
  related?: string[];
}

export interface Share extends ShareFrontmatter {
  owner: string;
  repo: string;
  content: string;
  url: string;
}

export interface ShareWithStats extends Share {
  views: number;
  outcome: { success: number; failure: number };
  verifications: number;
  successRate: number | null;
  install_count: number;
  first_seen_at: string;
  indexed_by: string;
}

export interface RepoEntry {
  owner: string;
  repo: string;
  indexed_at: string;
}

export interface Reputation {
  score: number;
  shares_count: number;
  total_views: number;
  avg_success_rate: number;
}

export interface ContributorProfile extends Reputation {
  username: string;
  shares: ShareWithStats[];
}
