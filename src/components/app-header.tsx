import { ShieldCheckIcon } from "lucide-react";
import { Button } from "~/components/ui/button";
import { tr } from "~/lib/lang";
import { ThemeMenu } from "./theme-menu";

export function Logo() {
  return <span className="font-semibold">{tr("Local AI Chat", "Lokaler KI-Chat")}</span>;
}

/** Theme and the privacy explainer. Always visible, because a non-technical user will not go looking for it. */
export function HeaderActions({ onPrivacy }: { onPrivacy: () => void }) {
  return (
    <div className="flex items-center gap-1">
      <ThemeMenu />
      <Button
        variant="outline"
        size="sm"
        onClick={onPrivacy}
        aria-label={tr("How private is this?", "Wie privat ist das?")}
      >
        <ShieldCheckIcon data-icon="inline-start" />
        <span className="hidden sm:inline">
          {tr("How private is this?", "Wie privat ist das?")}
        </span>
      </Button>
    </div>
  );
}

/** The top bar of the pages before the chat (welcome, model choice, loading). The chat has its own chrome. */
export function AppHeader({ onPrivacy }: { onPrivacy: () => void }) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-2 px-3">
      <Logo />
      <HeaderActions onPrivacy={onPrivacy} />
    </header>
  );
}
