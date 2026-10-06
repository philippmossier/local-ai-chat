import { describe, expect, it } from "vitest";
import {
  chatReducer,
  deserialize,
  initialState,
  serialize,
  titleFrom,
  toModelMessages,
  type ChatState,
} from "./store";

const stats = {
  tokens: 10,
  tokensPerSecond: 20,
  ttftMs: 300,
  totalMs: 800,
  interrupted: false,
};

function started(): ChatState {
  let s = chatReducer(initialState, { type: "new", id: "c1", now: 1 });
  s = chatReducer(s, {
    type: "send",
    chatId: "c1",
    userId: "u1",
    assistantId: "a1",
    text: "Hello there",
    now: 2,
  });
  return s;
}

describe("chatReducer", () => {
  it("creates a chat and makes it active", () => {
    const s = chatReducer(initialState, { type: "new", id: "c1", now: 1 });
    expect(s.activeId).toBe("c1");
    expect(s.chats[0]).toMatchObject({ id: "c1", title: "", messages: [] });
  });

  it("adds the user message and an empty assistant placeholder, and titles the chat once", () => {
    const s = started();
    expect(s.chats[0]!.messages.map((m) => [m.role, m.content])).toEqual([
      ["user", "Hello there"],
      ["assistant", ""],
    ]);
    expect(s.chats[0]!.title).toBe("Hello there");
    const again = chatReducer(s, {
      type: "send",
      chatId: "c1",
      userId: "u2",
      assistantId: "a2",
      text: "Second",
      now: 3,
    });
    expect(again.chats[0]!.title).toBe("Hello there");
  });

  it("streams tokens into the assistant message and records stats", () => {
    let s = started();
    s = chatReducer(s, { type: "token", chatId: "c1", messageId: "a1", text: "Hi" });
    s = chatReducer(s, { type: "token", chatId: "c1", messageId: "a1", text: " you" });
    s = chatReducer(s, { type: "finish", chatId: "c1", messageId: "a1", stats });
    expect(s.chats[0]!.messages[1]).toMatchObject({ content: "Hi you", stats });
  });

  it("deleting the active chat selects another one", () => {
    let s = started();
    s = chatReducer(s, { type: "new", id: "c2", now: 5 });
    expect(s.activeId).toBe("c2");
    s = chatReducer(s, { type: "delete", id: "c2" });
    expect(s.activeId).toBe("c1");
    s = chatReducer(s, { type: "delete", id: "c1" });
    expect(s).toEqual(initialState);
  });

  it("keeps updatedAt current so the history orders by last use", () => {
    let s = chatReducer(initialState, { type: "new", id: "c1", now: 1 });
    expect(s.chats[0]).toMatchObject({ createdAt: 1, updatedAt: 1 });
    s = chatReducer(s, {
      type: "send",
      chatId: "c1",
      userId: "u1",
      assistantId: "a1",
      text: "Hi",
      now: 50,
    });
    expect(s.chats[0]).toMatchObject({ createdAt: 1, updatedAt: 50 });
  });

  it("clear wipes everything", () => {
    expect(chatReducer(started(), { type: "clear" })).toEqual(initialState);
  });

  it("selecting an unknown chat is ignored", () => {
    const s = started();
    expect(chatReducer(s, { type: "select", id: "nope" })).toBe(s);
  });
});

describe("titleFrom", () => {
  it("flattens whitespace and truncates with an ellipsis", () => {
    expect(titleFrom("  a\n\n b  ")).toBe("a b");
    const long = "x".repeat(100);
    expect(titleFrom(long)).toHaveLength(42);
    expect(titleFrom(long).endsWith("…")).toBe(true);
  });
});

describe("persistence", () => {
  it("round-trips", () => {
    const s = chatReducer(started(), {
      type: "token",
      chatId: "c1",
      messageId: "a1",
      text: "Hi",
    });
    expect(deserialize(serialize(s))).toEqual(s);
  });

  it.each([null, "", "not json", "[]", '{"chats":"nope"}', '{"chats":[{"id":1}]}'])(
    "falls back to an empty state for %j",
    (raw) => {
      expect(deserialize(raw)).toEqual(initialState);
    },
  );

  it("drops malformed chats but keeps valid ones", () => {
    const good = started().chats[0];
    const raw = JSON.stringify({ chats: [good, { id: "bad" }], activeId: "bad" });
    const s = deserialize(raw);
    expect(s.chats).toHaveLength(1);
    expect(s.activeId).toBe("c1");
  });
});

describe("chats saved before updatedAt existed", () => {
  it("fall back to createdAt instead of being dropped", () => {
    const old = { id: "c1", title: "Old", createdAt: 123, messages: [] };
    const s = deserialize(JSON.stringify({ chats: [old], activeId: "c1" }));
    expect(s.chats).toHaveLength(1);
    expect(s.chats[0]!.updatedAt).toBe(123);
  });
});

describe("toModelMessages", () => {
  it("leaves out empty placeholders and failed replies", () => {
    let s = started();
    s = chatReducer(s, { type: "fail", chatId: "c1", messageId: "a1", error: "boom" });
    expect(toModelMessages(s.chats[0]!)).toEqual([
      { role: "user", content: "Hello there" },
    ]);
  });
});

describe("sync from another tab", () => {
  const chat = (id: string, content = "hi") => ({
    id,
    title: id,
    createdAt: 1,
    updatedAt: 1,
    messages: [{ id: `${id}-m`, role: "user" as const, content }],
  });

  it("takes the other tab's chats instead of overwriting them later", () => {
    const local: ChatState = { chats: [chat("a")], activeId: "a" };
    const incoming: ChatState = { chats: [chat("b"), chat("a")], activeId: "b" };
    const next = chatReducer(local, { type: "sync", incoming, keepChatId: null });
    expect(next.chats.map((c) => c.id)).toEqual(["b", "a"]);
    expect(next.activeId).toBe("a"); // the open chat stays this tab's choice
  });

  it("keeps the chat this tab is still writing into", () => {
    const local: ChatState = { chats: [chat("a", "streaming...")], activeId: "a" };
    const incoming: ChatState = { chats: [chat("b"), chat("a", "old")], activeId: "b" };
    const next = chatReducer(local, { type: "sync", incoming, keepChatId: "a" });
    expect(next.chats.find((c) => c.id === "a")!.messages[0]!.content).toBe(
      "streaming...",
    );
    expect(next.chats).toHaveLength(2);
  });

  it("falls back to another chat when the open one was deleted elsewhere", () => {
    const local: ChatState = { chats: [chat("a"), chat("b")], activeId: "a" };
    const incoming: ChatState = { chats: [chat("b")], activeId: "b" };
    expect(
      chatReducer(local, { type: "sync", incoming, keepChatId: null }).activeId,
    ).toBe("b");
  });
});
