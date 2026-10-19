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

/**
 * Context headers expected by the MCP BFF when a request reaches it through
 * the MCP gateway.  The older X-Tenant-* headers above are still used by the
 * REST data endpoints; staff tools use this separate contract.
 */
export function mcpProjectHeaders(
  active: ActiveProject,
  userId?: string,
  timeRange?: { start?: string; end?: string },
): Record<string, string> {
  const headers: Record<string, string> = {
    'X-MCP-Tenant-Id': active.tenantId,
    'X-MCP-Project-Id': active.projectId,
    ...(userId ? { 'X-MCP-User-Id': userId } : {}),
  };
  if (timeRange?.start || timeRange?.end) {
    headers['X-MCP-Time-Range'] = JSON.stringify({
      ...(timeRange.start ? { start: timeRange.start } : {}),
      ...(timeRange.end ? { end: timeRange.end } : {}),
    });
  }
  return headers;
}
