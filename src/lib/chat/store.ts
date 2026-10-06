import type { GenerationStats } from "../engine/protocol";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** When the message was sent (ms). Absent on chats saved before it existed. */
  at?: number;
  stats?: GenerationStats;
  error?: string;
}

export interface Chat {
  id: string;
  title: string;
  createdAt: number;
  /** Last time a message was sent. Orders the history, newest first. */
  updatedAt: number;
  messages: Message[];
}

export interface ChatState {
  chats: Chat[];
  activeId: string | null;
}

export type ChatAction =
  | { type: "new"; id: string; now: number }
  | { type: "select"; id: string }
  | { type: "delete"; id: string }
  | { type: "clear" }
  /** Another tab saved its chats. `keepChatId` is a chat this tab is still writing an answer into. */
  | { type: "sync"; incoming: ChatState; keepChatId: string | null }
  | {
      type: "send";
      chatId: string;
      userId: string;
      assistantId: string;
      text: string;
      now: number;
    }
  | { type: "token"; chatId: string; messageId: string; text: string }
  | { type: "finish"; chatId: string; messageId: string; stats: GenerationStats }
  | { type: "fail"; chatId: string; messageId: string; error: string };

export const initialState: ChatState = { chats: [], activeId: null };

const TITLE_LENGTH = 42;

export function titleFrom(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length <= TITLE_LENGTH ? flat : `${flat.slice(0, TITLE_LENGTH - 1)}…`;
}

const mapChat = (state: ChatState, id: string, fn: (c: Chat) => Chat): ChatState => ({
  ...state,
  chats: state.chats.map((c) => (c.id === id ? fn(c) : c)),
});

const mapMessage = (
  state: ChatState,
  chatId: string,
  messageId: string,
  fn: (m: Message) => Message,
) =>
  mapChat(state, chatId, (c) => ({
    ...c,
    messages: c.messages.map((m) => (m.id === messageId ? fn(m) : m)),
  }));

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case "new":
      return {
        chats: [
          {
            id: action.id,
            title: "",
            createdAt: action.now,
            updatedAt: action.now,
            messages: [],
          },
          ...state.chats,
        ],
        activeId: action.id,
      };
    case "select":
      return state.chats.some((c) => c.id === action.id)
        ? { ...state, activeId: action.id }
        : state;
    case "delete": {
      const chats = state.chats.filter((c) => c.id !== action.id);
      return {
        chats,
        activeId: state.activeId === action.id ? (chats[0]?.id ?? null) : state.activeId,
      };
    }
    case "clear":
      return initialState;
    case "sync": {
      const kept = action.keepChatId
        ? state.chats.find((c) => c.id === action.keepChatId)
        : undefined;
      const incoming = action.incoming.chats;
      const chats = !kept
        ? incoming
        : incoming.some((c) => c.id === kept.id)
          ? incoming.map((c) => (c.id === kept.id ? kept : c))
          : [kept, ...incoming];
      // The open chat is this tab's choice; fall back only when it no longer exists.
      const activeId = chats.some((c) => c.id === state.activeId)
        ? state.activeId
        : (chats[0]?.id ?? null);
      return { chats, activeId };
    }
    case "send":
      return mapChat(state, action.chatId, (c) => ({
        ...c,
        title: c.title || titleFrom(action.text),
        updatedAt: action.now,
        messages: [
          ...c.messages,
          { id: action.userId, role: "user", content: action.text, at: action.now },
          { id: action.assistantId, role: "assistant", content: "", at: action.now },
        ],
      }));
    case "token":
      return mapMessage(state, action.chatId, action.messageId, (m) => ({
        ...m,
        content: m.content + action.text,
      }));
    case "finish":
      return mapMessage(state, action.chatId, action.messageId, (m) => ({
        ...m,
        stats: action.stats,
      }));
    case "fail":
      return mapMessage(state, action.chatId, action.messageId, (m) => ({
        ...m,
        error: action.error,
      }));
  }
}

// ---- persistence ------------------------------------------------------------------------------

export const STORAGE_KEY = "local-ai-chat:v1";

export function serialize(state: ChatState): string {
  return JSON.stringify(state);
}

/** Never throws: a corrupt or foreign value in storage must not stop the app from starting. */
export function deserialize(raw: string | null): ChatState {
  if (!raw) return initialState;
  try {
    const data = JSON.parse(raw) as Partial<ChatState>;
    if (!data || !Array.isArray(data.chats)) return initialState;
    const chats = data.chats.filter(isChat).map((c) => ({
      ...c,
      updatedAt: typeof c.updatedAt === "number" ? c.updatedAt : c.createdAt,
    }));
    const activeId = chats.some((c) => c.id === data.activeId)
      ? (data.activeId ?? null)
      : (chats[0]?.id ?? null);
    return { chats, activeId };
  } catch {
    return initialState;
  }
}

/** `updatedAt` is optional on disk: chats saved before it existed fall back to `createdAt`. */
function isChat(
  value: unknown,
): value is Omit<Chat, "updatedAt"> & { updatedAt?: number } {
  const c = value as Chat;
  return (
    !!c &&
    typeof c.id === "string" &&
    typeof c.title === "string" &&
    typeof c.createdAt === "number" &&
    Array.isArray(c.messages) &&
    c.messages.every(
      (m) =>
        m &&
        typeof m.id === "string" &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string",
    )
  );
}

/** The messages to send to the model: finished turns only, no empty placeholders or failed replies. */
export function toModelMessages(
  chat: Chat,
): { role: "user" | "assistant"; content: string }[] {
  return chat.messages
    .filter((m) => m.content.trim() !== "" && !m.error)
    .map((m) => ({ role: m.role, content: m.content }));
}
