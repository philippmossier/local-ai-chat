import { ArrowUpIcon, ChevronDownIcon, CpuIcon, SquareIcon } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "~/components/ui/input-group";
import { Spinner } from "~/components/ui/spinner";
import { useIsMobile } from "~/hooks/use-mobile";
import { tr } from "~/lib/lang";

/**
 * The message box. Enter sends, Shift+Enter breaks the line (said once, in the placeholder). The textarea grows
 * with its text (field-sizing). The running model and the way to change it sit in the box, as in other chat apps.
 */
export function ChatComposer({
  value,
  onChange,
  onSend,
  onStop,
  generating,
  textareaRef,
  modelLabel,
  onChangeModel,
  ready,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onStop: () => void;
  generating: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  modelLabel: string;
  onChangeModel: () => void;
  /** False while the model is still starting: typing works, sending waits. */
  ready: boolean;
}) {
  const compact = useIsMobile();
  const canSend = value.trim().length > 0 && !generating && ready;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <InputGroup className="h-auto rounded-2xl border-0 bg-card shadow-sm dark:bg-card">
        <label htmlFor="composer" className="sr-only">
          {tr("Message", "Nachricht")}
        </label>
        <InputGroupTextarea
          id="composer"
          ref={textareaRef}
          rows={1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              if (canSend) onSend();
            }
          }}
          placeholder={
            !ready
              ? tr("Starting the model...", "Modell wird gestartet...")
              : compact
                ? tr(
                    "Ask anything. It stays on this device.",
                    "Fragen Sie alles. Es bleibt auf diesem Gerät.",
                  )
                : tr(
                    "Ask anything. It stays on this device (Shift+Enter for a new line)",
                    "Fragen Sie alles. Es bleibt auf diesem Gerät (Umschalt+Enter für eine neue Zeile)",
                  )
          }
          className="max-h-52 min-h-0 pl-[17px] text-base"
        />
        <InputGroupAddon align="block-end">
          <Button
            variant="ghost"
            size="sm"
            className="max-w-[60%] text-muted-foreground"
            disabled={!ready || generating}
            onClick={onChangeModel}
            title={tr("Change model", "Modell wechseln")}
          >
            {ready ? (
              <CpuIcon data-icon="inline-start" />
            ) : (
              <Spinner data-icon="inline-start" />
            )}
            <span className="truncate">{modelLabel}</span>
            <ChevronDownIcon data-icon="inline-end" />
          </Button>
          {generating ? (
            <InputGroupButton
              variant="default"
              size="icon-sm"
              className="ml-auto rounded-full"
              onClick={onStop}
              aria-label={tr("Stop", "Stopp")}
            >
              <SquareIcon />
            </InputGroupButton>
          ) : (
            <InputGroupButton
              variant="default"
              size="icon-sm"
              className="ml-auto rounded-full"
              disabled={!canSend}
              onClick={onSend}
              aria-label={tr("Send", "Senden")}
            >
              <ArrowUpIcon />
            </InputGroupButton>
          )}
        </InputGroupAddon>
      </InputGroup>
      <p className="pt-2 text-center text-xs text-muted-foreground">
        {tr(
          "Small models make mistakes. Check important answers.",
          "Kleine Modelle machen Fehler. Wichtige Antworten bitte prüfen.",
        )}
      </p>
    </div>
  );
}
