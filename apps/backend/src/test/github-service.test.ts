import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GitHubService, GitHubServiceError } from '../services/github.service';

describe('GitHubService', () => {
  let service: GitHubService;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    service = new GitHubService();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('URL Parsing', () => {
    it('parses standard repository URL', () => {
      const parsed = service.parseGitHubUrl('https://github.com/facebook/react');
      expect(parsed.owner).toBe('facebook');
      expect(parsed.repo).toBe('react');
      expect(parsed.branch).toBeUndefined();
      expect(parsed.subfolder).toBeUndefined();
    });

    it('strips .git suffix from repository name', () => {
      const parsed = service.parseGitHubUrl('https://github.com/torvalds/linux.git');
      expect(parsed.owner).toBe('torvalds');
      expect(parsed.repo).toBe('linux');
    });

    it('parses branch and subfolder from URL', () => {
      const parsed = service.parseGitHubUrl('https://github.com/vercel/next.js/tree/canary/packages/next');
      expect(parsed.owner).toBe('vercel');
      expect(parsed.repo).toBe('next.js');
      expect(parsed.branch).toBe('canary');
      expect(parsed.subfolder).toBe('packages/next');
    });

    it('throws GitHubServiceError on invalid URL', () => {
      expect(() => service.parseGitHubUrl('https://gitlab.com/owner/repo')).toThrow(GitHubServiceError);
      expect(() => service.parseGitHubUrl('not-a-url')).toThrow(GitHubServiceError);
    });
  });

  describe('Code File Filtering', () => {
    it('accepts valid code files across major programming languages', () => {
      expect(service.isCodeFile('src/index.ts')).toBe(true);
      expect(service.isCodeFile('components/Button.tsx')).toBe(true);
      expect(service.isCodeFile('server.py')).toBe(true);
      expect(service.isCodeFile('main.rs')).toBe(true);
      expect(service.isCodeFile('app.go')).toBe(true);
      expect(service.isCodeFile('schema.sql')).toBe(true);
      expect(service.isCodeFile('deploy.sh')).toBe(true);
    });

    it('rejects binary, lock, and dependency files', () => {
      expect(service.isCodeFile('node_modules/pkg/index.js')).toBe(false);
      expect(service.isCodeFile('.git/HEAD')).toBe(false);
      expect(service.isCodeFile('dist/bundle.min.js')).toBe(false);
      expect(service.isCodeFile('package-lock.json')).toBe(false);
      expect(service.isCodeFile('pnpm-lock.yaml')).toBe(false);
      expect(service.isCodeFile('assets/logo.png')).toBe(false);
      expect(service.isCodeFile('binary.wasm')).toBe(false);
    });
  });

  describe('Tiered Priority Scoring Algorithm', () => {
    it('awards highest score (10) to core entry points', () => {
      expect(service.computePathPriorityScore('src/main.ts')).toBe(10);
      expect(service.computePathPriorityScore('src/index.ts')).toBe(10);
      expect(service.computePathPriorityScore('app.ts')).toBe(10);
      expect(service.computePathPriorityScore('server.ts')).toBe(10);
    });

    it('awards high score (8) to business logic and services', () => {
      expect(service.computePathPriorityScore('src/services/auth.service.ts')).toBeGreaterThanOrEqual(8);
      expect(service.computePathPriorityScore('src/controllers/user.controller.ts')).toBeGreaterThanOrEqual(8);
    });

    it('awards high score (7) to routes and database schemas', () => {
      expect(service.computePathPriorityScore('src/routes/quiz.routes.ts')).toBeGreaterThanOrEqual(7);
      expect(service.computePathPriorityScore('src/db/schema/users.ts')).toBeGreaterThanOrEqual(7);
    });

    it('awards moderate score (5) to utilities and helpers', () => {
      expect(service.computePathPriorityScore('src/utils/shuffle.ts')).toBeGreaterThanOrEqual(5);
    });

    it('awards lower score (3-4) to config and tests', () => {
      expect(service.computePathPriorityScore('config.json')).toBe(4);
      expect(service.computePathPriorityScore('src/test/auth.test.ts')).toBeLessThanOrEqual(4);
    });

    it('adds nesting bonus for deep architectural components', () => {
      const shallow = service.computePathPriorityScore('helper.ts');
      const deep = service.computePathPriorityScore('src/lib/network/helper.ts');
      expect(deep).toBeGreaterThan(shallow);
    });
  });

  describe('Comment Detection', () => {
    it('detects inline and block comments across languages', () => {
      expect(service.detectComments('// Single line comment')).toBe(true);
      expect(service.detectComments('/* Block comment */')).toBe(true);
      expect(service.detectComments('# Python / Bash comment')).toBe(true);
      expect(service.detectComments('"""Docstring"""')).toBe(true);
      expect(service.detectComments('const a = 10;')).toBe(false);
    });
  });
});
