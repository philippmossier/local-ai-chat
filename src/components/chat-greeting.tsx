import { SparklesIcon } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/components/ui/empty";
import { starters } from "~/lib/labels";
import { tr } from "~/lib/lang";

/** The empty chat: a short greeting and four starting points. They fill the message box, they do not send. */
export function ChatGreeting({ onPick }: { onPick: (prompt: string) => void }) {
  return (
    <Empty className="border-0">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <SparklesIcon />
        </EmptyMedia>
        <EmptyTitle>{tr("What can I help with?", "Wobei kann ich helfen?")}</EmptyTitle>
        <EmptyDescription>
          {tr(
            "Everything you write here stays on this device.",
            "Alles, was Sie hier schreiben, bleibt auf diesem Gerät.",
          )}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="grid max-w-xl grid-cols-1 gap-2 sm:grid-cols-2">
        {starters().map((s) => (
          <Button
            key={s.label}
            variant="outline"
            className="h-auto justify-start py-3"
            onClick={() => onPick(s.prompt)}
          >
            {s.label}
          </Button>
        ))}
      </EmptyContent>
    </Empty>
  );
}
