import { env } from '../config/env';

export interface RepoFile {
  path: string;
  content: string;
  language: string;
  sizeBytes: number;
  lineCount: number;
  hasComments: boolean;
  priorityScore: number;
}

export interface RepoContext {
  owner: string;
  repo: string;
  branch: string;
  files: RepoFile[];
  totalRepoFiles: number;
  selectedFilesCount: number;
  truncated: boolean;
  repoUrl: string;
}

export interface ParsedGitHubUrl {
  owner: string;
  repo: string;
  branch?: string;
  subfolder?: string;
}

export class GitHubServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400,
    public details?: unknown
  ) {
    super(message);
    this.name = 'GitHubServiceError';
  }
}

const ALLOWED_EXTENSIONS = new Set([
  'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs',
  'py', 'rs', 'go', 'java', 'c', 'cpp', 'h', 'hpp', 'cs', 'rb', 'php',
  'vue', 'svelte', 'astro', 'sql', 'sh', 'bash', 'yaml', 'yml', 'toml', 'json', 'md'
]);

const EXCLUDED_DIR_PATTERNS = [
  'node_modules/', '.git/', 'dist/', 'build/', 'vendor/', '__pycache__/',
  '.next/', '.nuxt/', '.venv/', 'target/', '.turbo/', '.output/', 'coverage/'
];

const EXCLUDED_FILE_PATTERNS = [
  'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lockb',
  '.min.js', '.min.css', '.map', '.wasm', '.png', '.jpg', '.jpeg', '.gif',
  '.svg', '.ico', '.pdf', '.zip', '.tar', '.gz'
];

interface GitHubTreeItem {
  path: string;
  type: string;
  size?: number;
}

interface GitHubTreeResponse {
  tree?: GitHubTreeItem[];
}

export class GitHubService {
  parseGitHubUrl(url: string): ParsedGitHubUrl {
    const cleaned = url.trim().replace(/\/+$/, '');
    const regex = /(?:https?:\/\/)?(?:www\.)?github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)(?:\/(?:tree|blob)\/([^/]+)(?:\/(.+))?)?/;
    const match = cleaned.match(regex);

    if (!match || !match[1] || !match[2]) {
      throw new GitHubServiceError(
        'Invalid GitHub repository URL. Format must be: https://github.com/owner/repository',
        'INVALID_GITHUB_URL',
        400
      );
    }

    const owner = match[1];
    let repo = match[2];
    if (repo.endsWith('.git')) {
      repo = repo.slice(0, -4);
    }

    return {
      owner,
      repo,
      branch: match[3],
      subfolder: match[4],
    };
  }

  isCodeFile(path: string): boolean {
    const lower = path.toLowerCase();

    for (const dir of EXCLUDED_DIR_PATTERNS) {
      if (lower.includes(dir)) return false;
    }

    for (const pat of EXCLUDED_FILE_PATTERNS) {
      if (lower.endsWith(pat)) return false;
    }

    const parts = path.split('.');
    if (parts.length < 2) return false;
    const ext = parts.pop()?.toLowerCase();
    return ext ? ALLOWED_EXTENSIONS.has(ext) : false;
  }

  computePathPriorityScore(path: string, subfolder?: string): number {
    const lower = path.toLowerCase();
    const filename = lower.split('/').pop() || '';
    let score = 2; // base score

    // Tier 10: Core entry points
    if (
      filename === 'main.ts' ||
      filename === 'index.ts' ||
      filename === 'app.ts' ||
      filename === 'server.ts' ||
      filename === 'mod.rs' ||
      filename === 'main.py' ||
      filename === 'main.go' ||
      filename === 'program.cs' ||
      filename === 'app.py'
    ) {
      score = 10;
    }
    // Tier 8: Business logic / Services / Controllers
    else if (
      lower.includes('/services/') ||
      lower.includes('/controllers/') ||
      lower.includes('/handlers/') ||
      lower.includes('/usecases/') ||
      lower.includes('/domain/') ||
      lower.includes('/core/')
    ) {
      score = 8;
    }
    // Tier 7: Routes & Database / Schema
    else if (
      lower.includes('/routes/') ||
      lower.includes('/api/') ||
      lower.includes('/endpoints/') ||
      lower.includes('/db/') ||
      lower.includes('/schema/') ||
      lower.includes('/models/') ||
      lower.includes('/entities/') ||
      lower.includes('.routes.') ||
      lower.includes('.controller.')
    ) {
      score = 7;
    }
    // Tier 5: Utilities & Helpers
    else if (
      lower.includes('/utils/') ||
      lower.includes('/helpers/') ||
      lower.includes('/lib/') ||
      lower.includes('/common/') ||
      lower.includes('/shared/')
    ) {
      score = 5;
    }
    // Tier 4: Config / Setup
    else if (
      lower.includes('/config/') ||
      lower.includes('config.') ||
      lower.includes('env.') ||
      filename === 'dockerfile'
    ) {
      score = 4;
    }
    // Tier 3: Tests
    else if (
      lower.includes('/test/') ||
      lower.includes('/tests/') ||
      lower.includes('/__tests__/') ||
      lower.includes('.test.') ||
      lower.includes('.spec.')
    ) {
      score = 3;
    }

    // Nesting bonus: 3+ levels deep indicates substantive module architecture
    const depth = path.split('/').length;
    if (depth >= 3) {
      score += 1;
    }

    // Subfolder preference bonus
    if (subfolder && lower.startsWith(subfolder.toLowerCase())) {
      score += 4;
    }

    return score;
  }

  detectComments(content: string): boolean {
    return (
      content.includes('//') ||
      content.includes('/*') ||
      content.includes('#') ||
      content.includes('"""') ||
      content.includes('<!--')
    );
  }

  detectLanguage(path: string): string {
    const ext = path.split('.').pop()?.toLowerCase();
    const map: Record<string, string> = {
      ts: 'typescript',
      tsx: 'typescript',
      js: 'javascript',
      jsx: 'javascript',
      py: 'python',
      rs: 'rust',
      go: 'go',
      java: 'java',
      cs: 'csharp',
      cpp: 'cpp',
      c: 'c',
      rb: 'ruby',
      php: 'php',
      sql: 'sql',
      sh: 'bash',
      yaml: 'yaml',
      yml: 'yaml',
      json: 'json',
      md: 'markdown',
    };
    return (ext && map[ext]) || 'text';
  }

  async fetchRepoContext(
    url: string,
    options?: {
      maxFiles?: number;
      maxTotalBytes?: number;
      subfolder?: string;
    }
  ): Promise<RepoContext> {
    const { owner, repo, branch: requestedBranch, subfolder } = this.parseGitHubUrl(url);
    const maxFiles = options?.maxFiles ?? 6;
    const maxTotalBytes = options?.maxTotalBytes ?? 15000; // ~15KB safe token budget (approx 3,500 - 4,000 tokens)

    const headers: Record<string, string> = {
      'User-Agent': 'QuizForge-Code-Reviewer',
      Accept: 'application/vnd.github+json',
    };

    if (env.GITHUB_TOKEN && env.GITHUB_TOKEN.trim().length > 0 && !env.GITHUB_TOKEN.startsWith('ghp_your_')) {
      headers.Authorization = `Bearer ${env.GITHUB_TOKEN}`;
    }

    // Determine target branch (try requested or 'main' or 'master')
    let activeBranch = requestedBranch || 'main';
    let treeData: GitHubTreeResponse | null = null;

    try {
      const treeRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/git/trees/${activeBranch}?recursive=1`,
        { headers }
      );

      if (treeRes.status === 404 && !requestedBranch) {
        // Fallback to 'master'
        activeBranch = 'master';
        const fallbackRes = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/git/trees/${activeBranch}?recursive=1`,
          { headers }
        );
        if (fallbackRes.ok) {
          treeData = (await fallbackRes.json()) as GitHubTreeResponse;
        } else {
          throw new GitHubServiceError(
            `Repository '${owner}/${repo}' not found or branch does not exist.`,
            'REPO_NOT_FOUND',
            404
          );
        }
      } else if (!treeRes.ok) {
        const errorText = await treeRes.text();
        if (treeRes.status === 403 || treeRes.status === 429) {
          throw new GitHubServiceError(
            'GitHub API rate limit exceeded. Please configure GITHUB_TOKEN in .env or try again later.',
            'GITHUB_RATE_LIMIT',
            429
          );
        }
        if (treeRes.status === 404) {
          throw new GitHubServiceError(
            `Repository '${owner}/${repo}' or branch '${activeBranch}' was not found. Verify repository is public.`,
            'REPO_NOT_FOUND',
            404
          );
        }
        throw new GitHubServiceError(
          `Failed to fetch GitHub repository tree: ${treeRes.statusText}`,
          'GITHUB_API_ERROR',
          treeRes.status,
          errorText
        );
      } else {
        treeData = (await treeRes.json()) as GitHubTreeResponse;
      }
    } catch (err: unknown) {
      if (err instanceof GitHubServiceError) throw err;
      throw new GitHubServiceError(
        `Network error accessing GitHub API: ${err instanceof Error ? err.message : String(err)}`,
        'GITHUB_NETWORK_ERROR',
        502,
        err
      );
    }

    const rawTree = (treeData as GitHubTreeResponse | null)?.tree;
    if (!rawTree || !Array.isArray(rawTree)) {
      throw new GitHubServiceError(
        'GitHub repository returned an empty or invalid directory tree.',
        'EMPTY_REPO',
        400
      );
    }

    // 1. Filter to valid code files
    const codeCandidates = rawTree.filter(
      (item: GitHubTreeItem) => item.type === 'blob' && item.path && this.isCodeFile(item.path)
    );

    if (codeCandidates.length === 0) {
      throw new GitHubServiceError(
        'No compatible source code files found in repository.',
        'NO_CODE_FILES',
        400
      );
    }

    // 2. Score candidates by path priority
    interface ScoredCandidate {
      path: string;
      size: number;
      score: number;
    }

    const scored: ScoredCandidate[] = codeCandidates.map((c: GitHubTreeItem) => ({
      path: c.path,
      size: c.size || 2000,
      score: this.computePathPriorityScore(c.path, subfolder),
    }));

    // Sort descending by priority score
    scored.sort((a, b) => b.score - a.score);

    // 3. Selection with Bias Guard:
    // Core (Tier >= 7) vs Secondary (Tier <= 5)
    const coreCandidates = scored.filter((s) => s.score >= 7);
    const secondaryCandidates = scored.filter((s) => s.score < 7);

    const selectedList: ScoredCandidate[] = [];
    const minSecondaryCount = Math.max(1, Math.floor(maxFiles * 0.2)); // 20% bias-guard

    // Take secondary files first up to quota
    for (const item of secondaryCandidates) {
      if (selectedList.length >= minSecondaryCount) break;
      selectedList.push(item);
    }

    // Fill remaining slots with highest-score core files
    for (const item of coreCandidates) {
      if (selectedList.length >= maxFiles) break;
      if (!selectedList.some((s) => s.path === item.path)) {
        selectedList.push(item);
      }
    }

    // If still have room, add remaining secondary files
    for (const item of secondaryCandidates) {
      if (selectedList.length >= maxFiles) break;
      if (!selectedList.some((s) => s.path === item.path)) {
        selectedList.push(item);
      }
    }

    // 4. Fetch raw content for selected files in parallel (batched)
    const fetchedFiles: RepoFile[] = [];
    let accumulatedBytes = 0;
    let truncated = false;

    for (const target of selectedList) {
      if (accumulatedBytes >= maxTotalBytes && fetchedFiles.length >= 2) {
        truncated = true;
        break;
      }

      try {
        const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${activeBranch}/${target.path}`;
        const rawRes = await fetch(rawUrl, {
          headers: {
            'User-Agent': 'QuizForge-Code-Reviewer',
            ...(headers.Authorization ? { Authorization: headers.Authorization } : {}),
          },
        });

        if (!rawRes.ok) continue;

        const rawContent = await rawRes.text();
        if (!rawContent || rawContent.trim().length === 0) continue;

        // Truncate long files to max 90 lines or 2,500 chars to respect on-demand LLM token-per-minute limits
        let content = rawContent;
        const allLines = rawContent.split('\n');
        if (allLines.length > 90) {
          content = allLines.slice(0, 90).join('\n') + '\n// ... [remaining lines omitted for brevity]';
        }
        if (content.length > 2500) {
          content = content.slice(0, 2500) + '\n// ... [truncated]';
        }

        if (accumulatedBytes + content.length > maxTotalBytes && fetchedFiles.length >= 2) {
          truncated = true;
          break;
        }

        const lines = content.split('\n');
        const lineCount = lines.length;
        const hasComments = this.detectComments(content);

        // Content-based score bonuses:
        // +2 for files with comments (author intent tests)
        // +1 for medium size (30 - 150 lines)
        let finalScore = target.score;
        if (hasComments) finalScore += 2;
        if (lineCount >= 30 && lineCount <= 150) finalScore += 1;

        accumulatedBytes += content.length;

        fetchedFiles.push({
          path: target.path,
          content,
          language: this.detectLanguage(target.path),
          sizeBytes: content.length,
          lineCount,
          hasComments,
          priorityScore: finalScore,
        });

        if (fetchedFiles.length >= maxFiles) {
          break;
        }
      } catch {
        // Continue if single file fetch fails
      }
    }

    // Final sort: highest priority scored files at the top
    fetchedFiles.sort((a, b) => b.priorityScore - a.priorityScore);

    if (fetchedFiles.length === 0) {
      throw new GitHubServiceError(
        'Failed to download source file contents from repository.',
        'FILE_DOWNLOAD_FAILED',
        502
      );
    }

    return {
      owner,
      repo,
      branch: activeBranch,
      files: fetchedFiles,
      totalRepoFiles: codeCandidates.length,
      selectedFilesCount: fetchedFiles.length,
      truncated: truncated || fetchedFiles.length < codeCandidates.length,
      repoUrl: `https://github.com/${owner}/${repo}`,
    };
  }
}

export const gitHubService = new GitHubService();
