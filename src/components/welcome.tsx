import { CheckIcon } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { decimal, formatMB } from "~/lib/format";
import type { Option, Recommendation } from "~/lib/hardware/recommend";
import type { HardwareProfile } from "~/lib/hardware/types";
import { reasonText, tierLabel, trustPoints } from "~/lib/labels";
import { tr } from "~/lib/lang";

export function describeGpu(hw: HardwareProfile): string {
  const g = hw.gpu;
  if (!g.webgpu || g.isFallbackAdapter) return "";
  const vendor = g.vendor ? g.vendor.charAt(0).toUpperCase() + g.vendor.slice(1) : "GPU";
  return [
    vendor,
    g.description && g.description !== g.vendor ? g.description : g.architecture,
  ]
    .filter(Boolean)
    .join(" ");
}

export function Welcome({
  hw,
  reco,
  cached,
  onStart,
  onPicker,
}: {
  hw: HardwareProfile | null;
  reco: Recommendation | null;
  cached: Set<string>;
  onStart: (option: Option) => void;
  onPicker: () => void;
}) {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-10">
      <div className="flex flex-col gap-5">
        <h1 className="text-3xl font-semibold tracking-tight">
          {tr(
            "A private AI assistant that runs on your own computer.",
            "Ein privater KI-Assistent, der auf Ihrem eigenen Computer läuft.",
          )}
        </h1>
        <ul className="flex flex-col gap-2">
          {trustPoints().map((text) => (
            <li key={text} className="flex items-start gap-2">
              <CheckIcon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              {text}
            </li>
          ))}
        </ul>
      </div>

      {!hw || !reco ? (
        <div className="grid gap-4 sm:grid-cols-2" aria-busy>
          <Skeleton className="h-56 rounded-xl" />
          <Skeleton className="h-56 rounded-xl" />
          <p className="sr-only">
            {tr("Checking your computer...", "Ihr Computer wird geprüft...")}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <DeviceCard hw={hw} reco={reco} />
          <RecommendationCard
            reco={reco}
            cached={cached}
            onStart={onStart}
            onPicker={onPicker}
          />
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        {tr(
          "This check happens in your browser. Nothing is sent anywhere.",
          "Diese Prüfung läuft in Ihrem Browser. Es wird nichts versendet.",
        )}
      </p>
    </main>
  );
}

function DeviceCard({ hw, reco }: { hw: HardwareProfile; reco: Recommendation }) {
  const gpu = describeGpu(hw);
  const memory =
    hw.deviceMemoryGB === undefined
      ? tr("not reported by this browser", "von diesem Browser nicht gemeldet")
      : hw.deviceMemoryGB >= 8
        ? tr(`at least ${8} GB`, `mindestens ${8} GB`)
        : `${hw.deviceMemoryGB} GB`;
  const rows: [string, string][] = [
    [
      tr("Graphics", "Grafik"),
      gpu || tr("No graphics acceleration", "Keine Grafikbeschleunigung"),
    ],
    [tr("Memory", "Arbeitsspeicher"), memory],
    [tr("Processor threads", "Prozessor-Threads"), String(hw.cpuThreads)],
    ...(hw.gpu.bandwidthGBs !== undefined
      ? [
          [
            tr("Graphics speed", "Grafik-Geschwindigkeit"),
            tr(
              `${decimal(hw.gpu.bandwidthGBs)} GB/s (measured)`,
              `${decimal(hw.gpu.bandwidthGBs)} GB/s (gemessen)`,
            ),
          ] as [string, string],
        ]
      : []),
    [
      tr("Mode", "Modus"),
      reco.backend.device === "webgpu"
        ? tr("Graphics processor (fast)", "Grafikprozessor (schnell)")
        : tr("Processor (slower)", "Prozessor (langsamer)"),
    ],
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle>{tr("Your computer", "Ihr Computer")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <dl className="flex flex-col gap-1.5 text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="text-right">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="flex flex-col gap-2 text-sm text-muted-foreground">
          {reco.classification.reasons.map((r) => (
            <p key={r}>{reasonText(r, hw.gpu.bandwidthGBs ?? 0)}</p>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function RecommendationCard({
  reco,
  cached,
  onStart,
  onPicker,
}: {
  reco: Recommendation;
  cached: Set<string>;
  onStart: (o: Option) => void;
  onPicker: () => void;
}) {
  const rec = reco.recommended;
  const isCached = rec ? cached.has(rec.model.id) : false;

  return (
    <Card className="ring-2 ring-primary">
      <CardHeader>
        <CardDescription>
          {tr("Recommended for your computer", "Empfohlen für Ihren Computer")}
        </CardDescription>
        {rec && (
          <>
            <CardTitle className="text-2xl">{rec.model.label}</CardTitle>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="secondary">{tierLabel(rec.model.tier)}</Badge>
              {modelMeta(rec)}
            </div>
          </>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-1 text-sm">
        {rec ? (
          <>
            {rec.estimatedTps !== undefined && (
              <p className="text-muted-foreground">
                {tr(
                  `About ${Math.round(rec.estimatedTps)} tokens/s on your device`,
                  `Etwa ${Math.round(rec.estimatedTps)} Tokens/s auf Ihrem Gerät`,
                )}
              </p>
            )}
            <p>
              {isCached
                ? tr("Already on this device", "Bereits auf diesem Gerät")
                : tr(
                    `One-time download: ${formatMB(rec.downloadMB)}`,
                    `Einmaliger Download: ${formatMB(rec.downloadMB)}`,
                  )}
            </p>
            {rec.lowStorage && (
              <p className="text-xs text-destructive">{storageWarning()}</p>
            )}
          </>
        ) : (
          <p className="text-muted-foreground">
            {tr(
              "No model can run on this device.",
              "Auf diesem Gerät kann kein Modell laufen.",
            )}
          </p>
        )}
      </CardContent>
      <CardFooter className="flex flex-col items-stretch gap-2">
        {rec && (
          <Button size="lg" onClick={() => onStart(rec)}>
            {isCached
              ? tr("Start", "Starten")
              : tr("Download and start", "Herunterladen und starten")}
          </Button>
        )}
        {reco.classification.class !== "unsupported" && (
          <Button variant="link" onClick={onPicker}>
            {tr("Choose a different model", "Anderes Modell wählen")}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

export const modelMeta = (o: Option) =>
  tr(
    `${o.model.maker} · ${o.model.params} · ${o.model.languages} languages · ${o.model.license}`,
    `${o.model.maker} · ${o.model.params} · ${o.model.languages} Sprachen · ${o.model.license}`,
  );

export const storageWarning = () =>
  tr(
    "Your browser reports little free storage for this site. The download may fail, but you can try.",
    "Ihr Browser meldet wenig freien Speicher für diese Seite. Der Download könnte scheitern, Sie können es aber versuchen.",
  );
