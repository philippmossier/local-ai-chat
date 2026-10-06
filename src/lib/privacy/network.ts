import type { ResourceRecord } from "../engine/protocol";

export type HostKind = "app" | "model" | "other";

export interface HostSummary {
  host: string;
  kind: HostKind;
  requests: number;
  bytes: number;
}

export interface NetworkSummary {
  hosts: HostSummary[];
  /** Requests that started after the first message was sent. null until a message was sent. */
  requestsAfterFirstMessage: number | null;
}

const MODEL_HOSTS = [/(^|\.)huggingface\.co$/, /(^|\.)hf\.co$/];

export function classifyHost(host: string, ownHost: string): HostKind {
  if (host === ownHost) return "app";
  if (MODEL_HOSTS.some((re) => re.test(host))) return "model";
  return "other";
}

/**
 * Condenses the browser's own record of network requests. `firstMessageAt` is a wall-clock time in ms
 * (same scale as `ResourceRecord.startedAt`), or null if the user has not sent anything yet.
 */
export function summarizeNetwork(
  records: ResourceRecord[],
  ownHost: string,
  firstMessageAt: number | null,
): NetworkSummary {
  const byHost = new Map<string, HostSummary>();
  for (const r of records) {
    const existing = byHost.get(r.host) ?? {
      host: r.host,
      kind: classifyHost(r.host, ownHost),
      requests: 0,
      bytes: 0,
    };
    existing.requests++;
    existing.bytes += r.bytes;
    byHost.set(r.host, existing);
  }
  const order: Record<HostKind, number> = { model: 0, app: 1, other: 2 };
  const hosts = [...byHost.values()].sort(
    (a, b) => order[a.kind] - order[b.kind] || b.bytes - a.bytes,
  );

  return {
    hosts,
    requestsAfterFirstMessage:
      firstMessageAt === null
        ? null
        : records.filter((r) => r.startedAt >= firstMessageAt).length,
  };
}
