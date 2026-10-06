import { ArrowLeftIcon } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "~/components/ui/item";
import { formatMB } from "~/lib/format";
import type { Option } from "~/lib/hardware/recommend";
import { fitLabel, tierLabel } from "~/lib/labels";
import { tr } from "~/lib/lang";
import { modelMeta, storageWarning } from "./welcome";

const fitBadge = {
  recommended: "default",
  good: "secondary",
  slow: "outline",
  "not-advised": "destructive",
} as const;

export function ModelPicker({
  options,
  cached,
  onPick,
  onBack,
}: {
  options: Option[];
  cached: Set<string>;
  onPick: (o: Option) => void;
  onBack: () => void;
}) {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10">
      <div className="flex flex-col items-start gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeftIcon data-icon="inline-start" />
          {tr("Back", "Zurück")}
        </Button>
        <h1 className="text-2xl font-semibold">
          {tr("Choose a different model", "Anderes Modell wählen")}
        </h1>
      </div>
      <ItemGroup className="gap-3">
        {options.map((o) => {
          const isCached = cached.has(o.model.id);
          const risky = o.fit === "not-advised";
          return (
            <Item key={o.model.id} variant="outline" className="sm:flex-nowrap">
              <ItemContent>
                <ItemTitle>
                  {o.model.label}
                  <Badge variant="secondary">{tierLabel(o.model.tier)}</Badge>
                  <Badge variant={fitBadge[o.fit]}>{fitLabel(o.fit)}</Badge>
                </ItemTitle>
                <ItemDescription>{modelMeta(o)}</ItemDescription>
                <p className="text-sm">
                  {isCached
                    ? tr("Already on this device", "Bereits auf diesem Gerät")
                    : tr(
                        `One-time download: ${formatMB(o.downloadMB)}`,
                        `Einmaliger Download: ${formatMB(o.downloadMB)}`,
                      )}
                  {o.estimatedTps !== undefined && (
                    <span className="text-muted-foreground">
                      {" · "}
                      {tr(
                        `About ${Math.round(o.estimatedTps)} tokens/s`,
                        `Etwa ${Math.round(o.estimatedTps)} Tokens/s`,
                      )}
                    </span>
                  )}
                </p>
                {o.lowStorage && (
                  <p className="text-xs text-destructive">{storageWarning()}</p>
                )}
              </ItemContent>
              <ItemActions className="max-sm:w-full">
                <Button
                  className="max-sm:w-full sm:w-48"
                  variant={risky ? "outline" : "default"}
                  onClick={() => onPick(o)}
                >
                  {risky
                    ? tr("Try anyway", "Trotzdem versuchen")
                    : isCached
                      ? tr("Start", "Starten")
                      : tr("Download and start", "Herunterladen und starten")}
                </Button>
              </ItemActions>
            </Item>
          );
        })}
      </ItemGroup>
    </main>
  );
}
