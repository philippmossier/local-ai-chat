import { CheckIcon, CopyIcon } from "lucide-react";
import { useState } from "react";
import Markdown from "react-markdown";
import { Bubble, BubbleContent } from "~/components/ui/bubble";
import { Button } from "~/components/ui/button";
import { Message, MessageContent, MessageFooter } from "~/components/ui/message";
import type { Message as MessageModel } from "~/lib/chat/store";
import { messageTime } from "~/lib/chat/time";
import { decimal } from "~/lib/format";
import { tr } from "~/lib/lang";

/** Model output is untrusted: no remote images (they would be a request), links open in a new tab. */
const markdownComponents = {
  img: ({ alt }: { alt?: string }) => (alt ? <span>{alt}</span> : null),
  a: ({ children, href }: { children?: React.ReactNode; href?: string }) => (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
};

export function ChatMessage({
  message,
  streaming,
}: {
  message: MessageModel;
  streaming: boolean;
}) {
  if (message.role === "user") {
    return (
      <Message align="end">
        <MessageContent>
          <Bubble align="end">
            <BubbleContent className="text-base whitespace-pre-wrap">
              {message.content}
            </BubbleContent>
          </Bubble>
          {message.at && (
            <MessageFooter className="justify-end text-xs text-muted-foreground">
              <SentAt at={message.at} />
            </MessageFooter>
          )}
        </MessageContent>
      </Message>
    );
  }

  const { stats } = message;
  return (
    <Message>
      <MessageContent>
        <Bubble variant="ghost">
          <BubbleContent className="text-base leading-7">
            {message.content ? (
              <div className="md">
                <Markdown components={markdownComponents}>{message.content}</Markdown>
              </div>
            ) : streaming ? (
              <span className="shimmer" role="status">
                {tr("Thinking...", "Denkt nach...")}
              </span>
            ) : null}
          </BubbleContent>
        </Bubble>
        {message.error && (
          <Bubble variant="destructive">
            <BubbleContent>
              {tr(
                `Something went wrong: ${message.error}`,
                `Etwas ist schiefgelaufen: ${message.error}`,
              )}
            </BubbleContent>
          </Bubble>
        )}
        {stats && !streaming && (
          <MessageFooter className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>
              {tr(
                `${decimal(stats.tokensPerSecond)} tokens/s · first word after ${decimal(stats.ttftMs / 1000)} s`,
                `${decimal(stats.tokensPerSecond)} Tokens/s · erstes Wort nach ${decimal(stats.ttftMs / 1000)} s`,
              )}
              {stats.interrupted && ` · ${tr("Stopped", "Gestoppt")}`}
            </span>
            <CopyButton text={message.content} />
          </MessageFooter>
        )}
      </MessageContent>
    </Message>
  );
}

/** "Today 8:13 PM" and friends. "Now" is read once per mount: the label does not need to tick. */
function SentAt({ at }: { at: number }) {
  const [now] = useState(() => Date.now());
  return <>{messageTime(at, now)}</>;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="ghost"
      size="xs"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? (
        <CheckIcon data-icon="inline-start" />
      ) : (
        <CopyIcon data-icon="inline-start" />
      )}
      {copied ? tr("Copied", "Kopiert") : tr("Copy", "Kopieren")}
    </Button>
  );
}
