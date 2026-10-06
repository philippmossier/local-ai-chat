import { Button } from "~/components/ui/button";
import { Progress } from "~/components/ui/progress";
import { Spinner } from "~/components/ui/spinner";
import { formatBytes } from "~/lib/format";
import type { Option } from "~/lib/hardware/recommend";
import { tr } from "~/lib/lang";

export function Loading({
  option,
  loaded,
  total,
  phase,
  fromCache,
  onCancel,
}: {
  option: Option;
  loaded: number;
  total: number;
  phase: "loading" | "warming";
  /** Already on this device: no download to show, just the short start-up. */
  fromCache: boolean;
  onCancel: () => void;
}) {
  // File sizes are only known once each file starts, so prefer the catalog's total for a steady bar.
  const expected = Math.max(total, option.downloadMB * 1e6);
  const pct =
    phase === "warming" ? 100 : Math.min(99, Math.round((loaded / expected) * 100));
  if (fromCache)
    return (
      <main className="flex min-h-[60dvh] flex-col items-center justify-center gap-3 px-4 text-center">
        <Spinner className="size-6" />
        <p className="text-sm text-muted-foreground">
          {tr(
            `Starting ${option.model.label}...`,
            `${option.model.label} wird gestartet...`,
          )}
        </p>
      </main>
    );
  return (
    <main className="mx-auto flex max-w-xl flex-col items-center gap-6 px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold">
        {tr(
          `Downloading ${option.model.label}`,
          `${option.model.label} wird heruntergeladen`,
        )}
      </h1>
      <Progress value={pct} className="w-full" />
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        {phase === "warming" ? (
          <>
            <Spinner />
            {tr(
              "Preparing the model for your hardware...",
              "Das Modell wird für Ihre Hardware vorbereitet...",
            )}
          </>
        ) : (
          tr(
            `${formatBytes(loaded)} of ${formatBytes(expected)}`,
            `${formatBytes(loaded)} von ${formatBytes(expected)}`,
          )
        )}
      </p>
      <p className="text-sm text-muted-foreground">
        {tr(
          "This happens only once. The model is stored in your browser and stays on your device.",
          "Das passiert nur einmal. Das Modell wird in Ihrem Browser gespeichert und bleibt auf Ihrem Gerät.",
        )}
      </p>
      <Button variant="link" onClick={onCancel}>
        {tr("Cancel", "Abbrechen")}
      </Button>
    </main>
  );
}
