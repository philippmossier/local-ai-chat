import { describe, expect, it } from "vitest";
import type { ResourceRecord } from "../engine/protocol";
import { classifyHost, summarizeNetwork } from "./network";

const rec = (
  host: string,
  bytes: number,
  startedAt: number,
  source: "page" | "worker" = "worker",
): ResourceRecord => ({
  url: `https://${host}/x`,
  host,
  bytes,
  startedAt,
  source,
});

describe("classifyHost", () => {
  it.each([
    ["chat.example.com", "chat.example.com", "app"],
    ["huggingface.co", "chat.example.com", "model"],
    ["cdn-lfs.huggingface.co", "chat.example.com", "model"],
    ["cas-bridge.xethub.hf.co", "chat.example.com", "model"],
    ["evilhuggingface.co", "chat.example.com", "other"],
    ["cdn.jsdelivr.net", "chat.example.com", "other"],
  ] as const)("%s -> %s", (host, own, expected) => {
    expect(classifyHost(host, own)).toBe(expected);
  });
});

describe("summarizeNetwork", () => {
  const own = "chat.example.com";
  const records = [
    rec("chat.example.com", 1_000, 100, "page"),
    rec("huggingface.co", 500, 200),
    rec("cdn-lfs.hf.co", 570_000_000, 210),
    rec("cdn-lfs.hf.co", 1_000, 220),
  ];

  it("groups by host, model hosts first, biggest first", () => {
    const { hosts } = summarizeNetwork(records, own, null);
    expect(hosts.map((h) => [h.host, h.kind, h.requests])).toEqual([
      ["cdn-lfs.hf.co", "model", 2],
      ["huggingface.co", "model", 1],
      ["chat.example.com", "app", 1],
    ]);
    expect(hosts[0]!.bytes).toBe(570_001_000);
  });

  it("has no counter until a message was sent", () => {
    expect(summarizeNetwork(records, own, null).requestsAfterFirstMessage).toBeNull();
  });

  it("counts zero when nothing happened after the first message", () => {
    expect(summarizeNetwork(records, own, 1_000).requestsAfterFirstMessage).toBe(0);
  });

  it("counts every request after the first message, whoever it went to", () => {
    const later = [...records, rec("tracker.example.net", 10, 1_500)];
    expect(summarizeNetwork(later, own, 1_000).requestsAfterFirstMessage).toBe(1);
  });
});
