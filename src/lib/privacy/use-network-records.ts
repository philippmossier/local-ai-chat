import { useEffect, useRef, useState } from "react";
import type { ResourceRecord } from "../engine/protocol";
import { subscribeResources } from "../engine/singleton";

/** Collects every network request made by the page and by the engine worker, as the browser recorded them. */
export function useNetworkRecords(): ResourceRecord[] {
  const [records, setRecords] = useState<ResourceRecord[]>([]);
  const seen = useRef(new Set<string>());

  useEffect(() => {
    const add = (incoming: ResourceRecord[]) => {
      const fresh = incoming.filter((r) => {
        const key = `${r.source}|${r.url}|${r.startedAt}`;
        if (seen.current.has(key)) return false;
        seen.current.add(key);
        return true;
      });
      if (fresh.length > 0) setRecords((prev) => [...prev, ...fresh]);
    };

    const observer = new PerformanceObserver((list) => {
      add(
        list.getEntries().map((e) => {
          const r = e as PerformanceResourceTiming;
          return {
            url: r.name,
            host: new URL(r.name, location.href).host,
            bytes: r.transferSize || r.encodedBodySize || 0,
            startedAt: performance.timeOrigin + r.startTime,
            source: "page" as const,
          };
        }),
      );
    });
    observer.observe({ type: "resource", buffered: true });
    const unsubscribe = subscribeResources(add);
    return () => {
      observer.disconnect();
      unsubscribe();
    };
  }, []);

  return records;
}
