import dns from 'node:dns/promises';
import { isIP } from 'node:net';

export class SSRFError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code: string
  ) {
    super(message);
    this.name = 'SSRFError';
  }
}

export class SSRFProtectionService {
  private readonly allowedProtocols = new Set(['http:', 'https:']);

  private isPrivateIPv4(ip: string): boolean {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
      return true; // malformed treated as dangerous
    }
    const a = parts[0]!;
    const b = parts[1]!;
    const c = parts[2]!;

    // 0.0.0.0/8 - Current network
    if (a === 0) return true;
    // 127.0.0.0/8 - Loopback
    if (a === 127) return true;
    // 10.0.0.0/8 - RFC1918 Private Class A
    if (a === 10) return true;
    // 172.16.0.0/12 - RFC1918 Private Class B (172.16.0.0 to 172.31.255.255)
    if (a === 172 && b >= 16 && b <= 31) return true;
    // 192.168.0.0/16 - RFC1918 Private Class C
    if (a === 192 && b === 168) return true;
    // 169.254.0.0/16 - Link-local & Cloud Metadata (169.254.169.254)
    if (a === 169 && b === 254) return true;
    // 100.64.0.0/10 - Shared Address Space / CGNAT
    if (a === 100 && b >= 64 && b <= 127) return true;
    // 192.0.0.0/24, 192.0.2.0/24 (TEST-NET-1)
    if (a === 192 && b === 0) return true;
    // 198.51.100.0/24 (TEST-NET-2)
    if (a === 198 && b === 51 && c === 100) return true;
    // 203.0.113.0/24 (TEST-NET-3)
    if (a === 203 && b === 0 && c === 113) return true;
    // 224.0.0.0/4 - Multicast & 240.0.0.0/4 - Reserved
    if (a >= 224) return true;

    return false;
  }

  private isPrivateIPv6(ip: string): boolean {
    const lower = ip.toLowerCase();
    // ::1 loopback and :: unspecified
    if (lower === '::1' || lower === '::') return true;

    // IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1)
    if (lower.startsWith('::ffff:')) {
      const ipv4 = lower.substring(7);
      return this.isPrivateIPv4(ipv4);
    }

    // fe80::/10 link-local unicast (starts with fe8, fe9, fea, feb)
    if (/^fe[89ab]/i.test(lower)) return true;

    // fc00::/7 unique local addresses (ULA, starts with fc or fd)
    if (/^f[cd]/i.test(lower)) return true;

    // ff00::/8 multicast
    if (lower.startsWith('ff')) return true;

    return false;
  }

  isPrivateIp(ip: string): boolean {
    if (ip.includes(':')) {
      return this.isPrivateIPv6(ip);
    }
    return this.isPrivateIPv4(ip);
  }

  async validateUrl(rawUrl: string): Promise<{ parsedUrl: URL; resolvedIps: string[] }> {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(rawUrl);
    } catch {
      throw new SSRFError(
        'Invalid URL format. Please provide a well-formed absolute URL (e.g. https://example.com/article).',
        400,
        'INVALID_URL'
      );
    }

    // 1. Strict Protocol Enforcement (HTTP/HTTPS only)
    if (!this.allowedProtocols.has(parsedUrl.protocol)) {
      throw new SSRFError(
        `Disallowed protocol '${parsedUrl.protocol}'. Only 'http:' and 'https:' are permitted.`,
        400,
        'DISALLOWED_PROTOCOL'
      );
    }

    // 2. Reject credentials in URL
    if (parsedUrl.username || parsedUrl.password) {
      throw new SSRFError(
        'URLs containing embedded user credentials are not permitted.',
        400,
        'CREDENTIALS_IN_URL'
      );
    }

    const hostname = parsedUrl.hostname.toLowerCase();

    // 3. Blacklist loopback and internal hostname strings
    if (
      hostname === 'localhost' ||
      hostname.endsWith('.localhost') ||
      hostname === 'local' ||
      hostname.endsWith('.local') ||
      hostname === 'ip6-localhost' ||
      hostname === 'ip6-loopback'
    ) {
      throw new SSRFError(
        `Access to internal or loopback host '${hostname}' is prohibited.`,
        400,
        'SSRF_BLOCKED'
      );
    }

    // 4. If hostname is directly an IP literal, validate before DNS
    if (isIP(hostname)) {
      if (this.isPrivateIp(hostname)) {
        throw new SSRFError(
          `Direct access to private or reserved IP address '${hostname}' is strictly blocked.`,
          400,
          'SSRF_BLOCKED'
        );
      }
      return { parsedUrl, resolvedIps: [hostname] };
    }

    // 5. DNS Pre-lookup & Anti-DNS-Rebinding IP verification
    let resolvedAddresses: Array<{ address: string; family: number }>;
    try {
      resolvedAddresses = await dns.lookup(hostname, { all: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new SSRFError(
        `DNS resolution failed for hostname '${hostname}': ${msg}`,
        400,
        'DNS_LOOKUP_FAILED'
      );
    }

    if (!resolvedAddresses || resolvedAddresses.length === 0) {
      throw new SSRFError(
        `No IP addresses could be resolved for host '${hostname}'.`,
        400,
        'DNS_NO_RECORDS'
      );
    }

    const resolvedIps: string[] = [];
    for (const record of resolvedAddresses) {
      resolvedIps.push(record.address);
      if (this.isPrivateIp(record.address)) {
        throw new SSRFError(
          `Host '${hostname}' resolves to a prohibited internal IP address (${record.address}). Access blocked by SSRF defense.`,
          400,
          'SSRF_BLOCKED'
        );
      }
    }

    return { parsedUrl, resolvedIps };
  }
}

export const ssrfProtectionService = new SSRFProtectionService();
