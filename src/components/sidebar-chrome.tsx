import { PlusIcon } from "lucide-react";
import { Button } from "~/components/ui/button";
import { SidebarTrigger, useSidebar } from "~/components/ui/sidebar";
import { tr } from "~/lib/lang";
import { Logo } from "./app-header";

/**
 * The fold button never moves (top left). Next to it: the logo and name while the history is open, and a
 * "new chat" button once it is folded away (always on phones), so a chat can still be started from the minimal view.
 */
export function SidebarChrome({ onNew }: { onNew: () => void }) {
  const { state, isMobile } = useSidebar();
  const open = !isMobile && state === "expanded";
  return (
    <div className="fixed top-2 left-2 z-20 flex h-10 items-center gap-2">
      <SidebarTrigger
        className="size-9"
        aria-label={tr("Show or hide chat history", "Chat-Verlauf ein- oder ausblenden")}
      />
      <div key={String(open)} className="animate-in fade-in duration-200">
        {open ? (
          <Logo />
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="size-9"
            onClick={onNew}
            aria-label={tr("New chat", "Neuer Chat")}
          >
            <PlusIcon />
          </Button>
        )}
      </div>
    </div>
  );
}
