import { useEffect, useRef, useState } from "react";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
  useMessageScroller,
} from "~/components/ui/message-scroller";
import type { Chat as ChatModel } from "~/lib/chat/store";
import { ChatComposer } from "./chat-composer";
import { ChatGreeting } from "./chat-greeting";
import { ChatMessage } from "./message";

/**
 * When the user sends a message, hold it near the top of the view and let the answer grow below it.
 * The scroller's automatic anchoring did not fire reliably for long threads in the version tested, so the
 * same anchoring is requested explicitly with the scroller's own `scrollToMessage`, which also sizes the
 * reserved space. Nothing here does scroll maths.
 */
function AnchorSentMessage({ lastUserId }: { lastUserId: string | undefined }) {
  const { scrollToMessage } = useMessageScroller();
  const seen = useRef(lastUserId);
  useEffect(() => {
    if (lastUserId && seen.current !== lastUserId)
      scrollToMessage(lastUserId, { align: "start", scrollMargin: 64 });
    seen.current = lastUserId;
  }, [lastUserId, scrollToMessage]);
  return null;
}

/**
 * Messages and the message box. Scrolling is shadcn's MessageScroller: a sent message is anchored near the
 * top, the answer streams in below it without the view chasing it, the viewport fades at its bottom edge,
 * and a jump-to-latest button appears when there is more below. Nothing here touches scroll positions.
 */
export function Chat({
  active,
  generating,
  onSend,
  onStop,
  banner,
  modelLabel,
  onChangeModel,
  ready,
}: {
  active: ChatModel | null;
  generating: boolean;
  onSend: (text: string) => unknown;
  onStop: () => void;
  /** An optional note shown after the last message, e.g. the speed suggestion. */
  banner?: React.ReactNode;
  modelLabel: string;
  onChangeModel: () => void;
  ready: boolean;
}) {
  const [draft, setDraft] = useState("");
  const input = useRef<HTMLTextAreaElement>(null);
  const messages = active?.messages ?? [];

  // Put the cursor in the box when a chat opens, on devices with a keyboard. On a phone this would pop the
  // on-screen keyboard over the conversation.
  useEffect(() => {
    if (window.matchMedia("(pointer: fine)").matches) input.current?.focus();
  }, [active?.id]);

  function send() {
    const text = draft.trim();
    if (!text || generating) return;
    setDraft("");
    onSend(text);
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      {messages.length === 0 ? (
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto">
          <ChatGreeting
            onPick={(prompt) => {
              setDraft(prompt);
              input.current?.focus();
            }}
          />
        </div>
      ) : (
        // One scroller per chat: opening a chat lands on its last exchange.
        <MessageScrollerProvider key={active?.id} defaultScrollPosition="last-anchor">
          <MessageScroller>
            <AnchorSentMessage
              lastUserId={messages.findLast((m) => m.role === "user")?.id}
            />
            <MessageScrollerViewport className="px-4">
              <MessageScrollerContent className="mx-auto w-full max-w-3xl pt-16 pb-6">
                {messages.map((m, i) => (
                  <MessageScrollerItem
                    key={m.id}
                    messageId={m.id}
                    scrollAnchor={m.role === "user"}
                    className="[content-visibility:visible]"
                  >
                    <ChatMessage
                      message={m}
                      streaming={generating && i === messages.length - 1}
                    />
                  </MessageScrollerItem>
                ))}
                {banner && !generating && (
                  <MessageScrollerItem messageId="advice">{banner}</MessageScrollerItem>
                )}
              </MessageScrollerContent>
            </MessageScrollerViewport>
            <MessageScrollerButton />
          </MessageScroller>
        </MessageScrollerProvider>
      )}
      <ChatComposer
        value={draft}
        onChange={setDraft}
        onSend={send}
        onStop={onStop}
        generating={generating}
        textareaRef={input}
        modelLabel={modelLabel}
        onChangeModel={onChangeModel}
        ready={ready}
      />
    </section>
  );
}
