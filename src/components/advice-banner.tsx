import { GaugeIcon } from "lucide-react";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { decimal } from "~/lib/format";
import type { SpeedAdvice } from "~/lib/hardware/advice";
import { tr } from "~/lib/lang";

/** One-time suggestion after the first answer: this model is too slow, or the machine could run a stronger one. */
export function AdviceBanner({
  advice,
  tokensPerSecond,
  onSwitch,
  onDismiss,
}: {
  advice: Exclude<SpeedAdvice, { kind: "ok" }>;
  tokensPerSecond: number;
  onSwitch: () => void;
  onDismiss: () => void;
}) {
  const model = advice.suggest.label;
  const tps = decimal(tokensPerSecond);
  return (
    <Alert>
      <GaugeIcon />
      <AlertTitle>
        {advice.kind === "too-slow"
          ? tr(
              `This model is slow on your computer (${tps} tokens/s)`,
              `Dieses Modell ist auf Ihrem Computer langsam (${tps} Tokens/s)`,
            )
          : tr(
              `Your computer is fast (${tps} tokens/s)`,
              `Ihr Computer ist schnell (${tps} Tokens/s)`,
            )}
      </AlertTitle>
      <AlertDescription>
        {advice.kind === "too-slow"
          ? tr(
              `${model} would feel much faster.`,
              `Mit ${model} wäre es deutlich flotter.`,
            )
          : tr(
              `${model} would give better answers.`,
              `${model} würde bessere Antworten liefern.`,
            )}
      </AlertDescription>
      <AlertAction className="flex gap-2">
        <Button size="sm" onClick={onSwitch}>
          {tr(`Switch to ${model}`, `Zu ${model} wechseln`)}
        </Button>
        <Button size="sm" variant="ghost" onClick={onDismiss}>
          {tr("Not now", "Jetzt nicht")}
        </Button>
      </AlertAction>
    </Alert>
  );
}
