export type SolutionType = 'fix' | 'workaround' | 'pattern' | 'reference' | 'config';

export interface ShareFrontmatter {
  title: string;
  slug: string;
  tags: string[];
  problem: string;
  solution_type: SolutionType;
  verified?: boolean;
  created?: string;
  updated?: string;
  ai_provider?: 'claude' | 'gpt' | 'gemini';
  environment?: {
    language?: string;
    framework?: string;
    version?: string;
  };
  related?: string[];
}

export interface Share {
  frontmatter: ShareFrontmatter;
  content: string;
  filePath: string;
}

export interface ShareManifestEntry {
  slug: string;
  title: string;
  tags: string[];
  problem: string;
  solution_type: SolutionType;
}

export interface ShareManifest {
  version: number;
  owner: string;
  shares: ShareManifestEntry[];
}
