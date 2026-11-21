import * as cheerio from 'cheerio';
import crypto from 'node:crypto';
import { NormalizedDocument, DocumentChunk } from '@quiz-forge/shared';
import { ssrfProtectionService } from './ssrf-protection.service';

export class URLIngestionError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code: string
  ) {
    super(message);
    this.name = 'URLIngestionError';
  }
}

export type FetchFunction = typeof fetch;

export class URLIngestionAdapter {
  private readonly maxResponseSizeBytes = 5 * 1024 * 1024; // 5 MB
  private readonly requestTimeoutMs = 10000; // 10 seconds
  private customFetch: FetchFunction | null = null;

  setFetchFn(fetchFn: FetchFunction | null): void {
    this.customFetch = fetchFn;
  }

  private getFetchFn(): FetchFunction {
    return this.customFetch || globalThis.fetch;
  }

  async ingest(rawUrl: string): Promise<NormalizedDocument> {
    // 1. Initial SSRF & format check
    let currentUrl = rawUrl;
    await ssrfProtectionService.validateUrl(currentUrl);

    // 2. Safe fetch with manual redirect loop & re-validation
    const fetchFn = this.getFetchFn();
    let response: Response | null = null;
    const maxRedirects = 3;
    let redirectCount = 0;

    while (redirectCount <= maxRedirects) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.requestTimeoutMs);

      try {
        response = await fetchFn(currentUrl, {
          method: 'GET',
          redirect: 'manual',
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 QuizForge/1.0',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.5',
          },
        });
      } catch (err: unknown) {
        clearTimeout(timeoutId);
        if (err instanceof Error && err.name === 'AbortError') {
          throw new URLIngestionError(
            `Request to '${currentUrl}' timed out after ${this.requestTimeoutMs / 1000} seconds.`,
            504,
            'REQUEST_TIMEOUT'
          );
        }
        throw new URLIngestionError(
          `Failed to connect to '${currentUrl}': ${err instanceof Error ? err.message : String(err)}`,
          502,
          'NETWORK_ERROR'
        );
      } finally {
        clearTimeout(timeoutId);
      }

      // Handle redirect
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) {
          throw new URLIngestionError('Redirect response missing Location header.', 502, 'INVALID_REDIRECT');
        }

        const nextUrl = new URL(location, currentUrl).toString();
        // Re-validate target URL with SSRF defense before following!
        await ssrfProtectionService.validateUrl(nextUrl);
        currentUrl = nextUrl;
        redirectCount++;
        continue;
      }

      break;
    }

    if (!response || !response.ok) {
      throw new URLIngestionError(
        `Failed to retrieve URL '${currentUrl}'. Server responded with HTTP ${response?.status || 'unknown'}.`,
        response?.status && response.status < 500 ? 400 : 502,
        'UPSTREAM_HTTP_ERROR'
      );
    }

    // 3. Content-Type Check
    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    if (
      !contentType.includes('text/html') &&
      !contentType.includes('application/xhtml+xml') &&
      !contentType.includes('text/plain')
    ) {
      throw new URLIngestionError(
        `Unsupported content type '${contentType}'. Only HTML and text web pages are supported.`,
        400,
        'UNSUPPORTED_CONTENT_TYPE'
      );
    }

    // 4. Content size check & body extraction
    const rawBuffer = Buffer.from(await response.arrayBuffer());
    if (rawBuffer.length > this.maxResponseSizeBytes) {
      throw new URLIngestionError(
        `Web page response size (${(rawBuffer.length / (1024 * 1024)).toFixed(2)} MB) exceeds maximum allowed limit of 5 MB.`,
        400,
        'RESPONSE_TOO_LARGE'
      );
    }

    const html = rawBuffer.toString('utf-8');
    const sha256 = crypto.createHash('sha256').update(rawBuffer).digest('hex');

    // 5. HTML Content Normalization & Readability Extraction
    return this.normalizeHtml(html, currentUrl, rawBuffer.length, sha256);
  }

  normalizeHtml(
    html: string,
    sourceUrl: string,
    fileSizeBytes: number,
    checksumSha256: string
  ): NormalizedDocument {
    const $ = cheerio.load(html);

    // Remove noise, scripts, ads, styles, navigation, footer
    $(
      'script, style, svg, noscript, iframe, nav, header, footer, aside, form, button, input, dialog, [role="navigation"], [role="banner"], [role="contentinfo"], .ad, .ads, .sidebar, .comments'
    ).remove();

    // Extract Title
    let title =
      $('meta[property="og:title"]').attr('content') ||
      $('title').text().trim() ||
      $('h1').first().text().trim();

    title = title.replace(/\s+/g, ' ').trim();
    if (!title) {
      try {
        const u = new URL(sourceUrl);
        title = u.hostname + u.pathname;
      } catch {
        title = 'Web Article';
      }
    }

    // Select primary content container if present, else body
    const primaryContent = $('article, main, [role="main"], .post-content, .article-content, .entry-content, #content');
    const root = primaryContent.length > 0 ? primaryContent.first() : $('body');

    // Structure text with headers
    const textBlocks: string[] = [];
    root.find('h1, h2, h3, h4, p, li, blockquote').each((_, el) => {
      const text = $(el).text().replace(/\s+/g, ' ').trim();
      if (text.length > 0) {
        const tag = el.tagName.toLowerCase();
        if (tag.startsWith('h')) {
          textBlocks.push(`\n### ${text}\n`);
        } else {
          textBlocks.push(text);
        }
      }
    });

    const cleanedText = textBlocks.join('\n\n').trim();

    if (cleanedText.length < 50) {
      throw new URLIngestionError(
        'The target web page contains insufficient extractable article text (< 50 characters). It may rely on client-side JavaScript rendering or be behind authentication/paywalls.',
        400,
        'INSUFFICIENT_TEXT'
      );
    }

    // 6. Semantic Chunking (~1,500 characters per chunk)
    const chunks: DocumentChunk[] = [];
    const paragraphs = cleanedText.split(/\n\s*\n/);
    let currentChunk = '';
    let chunkIndex = 0;

    for (const para of paragraphs) {
      const trimmed = para.trim();
      if (!trimmed) continue;

      if ((currentChunk + '\n\n' + trimmed).length > 1500 && currentChunk.length > 200) {
        chunks.push({
          id: `chunk_${chunkIndex}`,
          orderIndex: chunkIndex,
          content: currentChunk.trim(),
          tokenEstimate: Math.ceil(currentChunk.length / 4),
        });
        chunkIndex++;
        currentChunk = trimmed;
      } else {
        currentChunk = currentChunk ? `${currentChunk}\n\n${trimmed}` : trimmed;
      }
    }

    if (currentChunk.trim().length > 0) {
      chunks.push({
        id: `chunk_${chunkIndex}`,
        orderIndex: chunkIndex,
        content: currentChunk.trim(),
        tokenEstimate: Math.ceil(currentChunk.length / 4),
      });
    }

    const totalTokenEstimate = chunks.reduce((sum, c) => sum + c.tokenEstimate, 0);

    return {
      id: crypto.randomUUID(),
      sourceType: 'url',
      sourceIdentifier: sourceUrl,
      title: title.slice(0, 200),
      metadata: {
        mimeType: 'text/html',
        fileSizeBytes,
        extractedAt: Date.now(),
        checksumSha256,
      },
      chunks,
      totalTokenEstimate,
    };
  }
}

export const urlIngestionAdapter = new URLIngestionAdapter();
