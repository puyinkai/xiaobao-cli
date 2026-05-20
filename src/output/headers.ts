/**
 * Build the four standard tenant/project headers for downstream calls.
 *
 * HTTP header values must be ByteStrings (latin-1, code points 0–255). Tenant
 * and project **names** are user-supplied display strings and frequently
 * contain Chinese (or any non-latin-1) characters, which would crash
 * Node `fetch` with "Cannot convert argument to a ByteString". We
 * percent-encode the names here; the gateway (OpenContextRelay) decodes them
 * back to UTF-8 before populating outbound `X-Tenant` / `X-Project` headers.
 *
 * IDs stay raw — they are numeric strings, always ASCII.
 *
 * Copied (without `AgentToolResult` wrapper) from
 * openclaw-xiaobao/src/tools/helpers.ts.
 */

import type { ActiveProject } from '../core/project-store';

export function tenantProjectHeaders(active: ActiveProject): Record<string, string> {
  return {
    'X-Tenant-Id': active.tenantId,
    'X-Tenant-Name': encodeURIComponent(active.tenantName),
    'X-Project-Id': active.projectId,
    'X-Project-Name': encodeURIComponent(active.projectName),
  };
}
