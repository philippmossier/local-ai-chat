import { CheckIcon, PlusIcon, ShieldCheckIcon, Trash2Icon, XIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "~/components/ui/sidebar";
import type { Chat } from "~/lib/chat/store";
import { messageTime } from "~/lib/chat/time";
import { tr } from "~/lib/lang";

/**
 * The chat history. shadcn's Sidebar is a panel on desktop and a sheet on phones, with its own trigger, Escape
 * handling and focus management. One line per chat (the time is in the tooltip and under the messages).
 * Deleting asks first, in place: the trash icon turns into a tick and a cross on the same row.
 */
export function ChatSidebar({
  chats,
  activeId,
  onSelect,
  onNew,
  onDelete,
}: {
  chats: Chat[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}) {
  const { isMobile, setOpenMobile } = useSidebar();
  const [confirming, setConfirming] = useState<string | null>(null);
  const [now] = useState(() => Date.now()); // tooltip text only: read once per mount

  const visible = chats
    .filter((c) => c.messages.length > 0)
    .sort((a, b) => b.updatedAt - a.updatedAt);
  const closeOnPhone = () => isMobile && setOpenMobile(false);

  return (
    <Sidebar>
      {/* The fold button and logo float over this strip (see SidebarChrome). */}
      <SidebarHeader className="gap-3 pt-14">
        <Button
          className="w-full justify-start"
          onClick={() => {
            onNew();
            closeOnPhone();
          }}
        >
          <PlusIcon data-icon="inline-start" />
          {tr("New chat", "Neuer Chat")}
        </Button>
      </SidebarHeader>
      <Separator />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0">
              {visible.length === 0 && (
                <li className="px-2 py-3 text-muted-foreground">
                  {tr("Your chats will appear here.", "Ihre Chats erscheinen hier.")}
                </li>
              )}
              {visible.map((c) => {
                const asking = confirming === c.id;
                return (
                  <SidebarMenuItem key={c.id}>
                    <SidebarMenuButton
                      isActive={c.id === activeId}
                      title={messageTime(c.updatedAt, now)}
                      onClick={() => {
                        onSelect(c.id);
                        closeOnPhone();
                      }}
                      className={asking ? "pr-20!" : undefined}
                    >
                      <span className="truncate">{c.title}</span>
                    </SidebarMenuButton>
                    {asking ? (
                      <div className="absolute top-1 right-1 flex gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          className="text-destructive hover:text-destructive [&_svg]:size-4"
                          aria-label={tr("Confirm delete", "Löschen bestätigen")}
                          onClick={() => {
                            setConfirming(null);
                            onDelete(c.id);
                          }}
                        >
                          <CheckIcon className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          className="[&_svg]:size-4"
                          aria-label={tr("Cancel", "Abbrechen")}
                          onClick={() => setConfirming(null)}
                        >
                          <XIcon className="size-4" />
                        </Button>
                      </div>
                    ) : (
                      <SidebarMenuAction
                        showOnHover
                        aria-label={tr("Delete chat", "Chat löschen")}
                        onClick={() => setConfirming(c.id)}
                      >
                        <Trash2Icon />
                      </SidebarMenuAction>
                    )}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <p className="flex items-start gap-2 p-2 text-xs text-muted-foreground">
          <ShieldCheckIcon className="mt-0.5 size-4 shrink-0 text-primary" />
          {tr(
            "Chats are stored only in this browser.",
            "Chats werden nur in diesem Browser gespeichert.",
          )}
        </p>
      </SidebarFooter>
    </Sidebar>
  );
}
