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

export interface ParsedShare {
  frontmatter: ShareFrontmatter;
  content: string;
  filePath: string;
}

export const VALID_SOLUTION_TYPES: SolutionType[] = [
  "fix",
  "workaround",
  "pattern",
  "reference",
  "config",
];

export interface SearchShareResult {
  owner: string;
  repo: string;
  title: string;
  slug: string;
  tags: string[];
  problem: string;
  solution_type: SolutionType;
  verified: boolean;
  url: string;
}

export interface SearchResponse {
  total: number;
  shares: SearchShareResult[];
}
