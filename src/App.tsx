import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { AdviceBanner } from "./components/advice-banner";
import { AppHeader, HeaderActions } from "./components/app-header";
import { Chat } from "./components/chat";
import { ChatSidebar } from "./components/chat-sidebar";
import { Loading } from "./components/loading";
import { ModelPicker } from "./components/model-picker";
import { PrivacyPanel } from "./components/privacy-panel";
import { SidebarChrome } from "./components/sidebar-chrome";
import { Alert, AlertDescription, AlertTitle } from "./components/ui/alert";
import { Button } from "./components/ui/button";
import { SidebarInset, SidebarProvider } from "./components/ui/sidebar";
import { Spinner } from "./components/ui/spinner";
import { toast } from "./components/ui/toast";
import { Welcome } from "./components/welcome";
import {
  chatReducer,
  deserialize,
  serialize,
  STORAGE_KEY,
  toModelMessages,
} from "./lib/chat/store";
import { getEngine, resetEngine } from "./lib/engine/singleton";
import { adviseFromSpeed, type SpeedAdvice } from "./lib/hardware/advice";
import { classify } from "./lib/hardware/classify";
import { detectHardware } from "./lib/hardware/detect";
import { pickBackend, recommend, type Option } from "./lib/hardware/recommend";
import type { HardwareProfile } from "./lib/hardware/types";
import { tr } from "./lib/lang";
import { CATALOG } from "./lib/models/catalog";
import { readSeenModels, unseenModels, writeSeenModels } from "./lib/models/seen";
import { useNetworkRecords } from "./lib/privacy/use-network-records";
import { isModelCached, markModelComplete, PREFS } from "./lib/privacy/wipe";

type Stage =
  | { name: "welcome" }
  | { name: "picker" }
  | {
      name: "loading";
      option: Option;
      loaded: number;
      total: number;
      phase: "loading" | "warming";
    }
  | { name: "failed"; option: Option; message: string }
  | { name: "chat"; option: Option };

const SYSTEM_PROMPT =
  "You are a helpful, honest assistant running privately on the user's own device. Keep answers concise and reply in the language the user writes in. Write plain text and Markdown only: no LaTeX, write formulas like H2O or CO2 in plain characters.";

type Advice = Exclude<SpeedAdvice, { kind: "ok" }> & { tokensPerSecond: number };

export function App() {
  const [hw, setHw] = useState<HardwareProfile | null>(null);
  const [cached, setCached] = useState<Set<string>>(new Set());
  const [stage, setStage] = useState<Stage>({ name: "welcome" });
  const [chat, dispatch] = useReducer(chatReducer, undefined, () =>
    deserialize(localStorage.getItem(STORAGE_KEY)),
  );
  const [generating, setGenerating] = useState(false);
  const [advice, setAdvice] = useState<Advice | null>(null);
  /** The model currently loaded in the engine, if any. Lets "back" from the picker return to the chat. */
  const [loaded, setLoaded] = useState<Option | null>(null);
  const dismissed = useRef(new Set<string>());
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [firstMessageAt, setFirstMessageAt] = useState<number | null>(null);
  const cancelled = useRef(false);
  const records = useNetworkRecords();

  const reco = useMemo(() => (hw ? recommend(hw, cached) : null), [hw, cached]);

  // Hardware check and "which models are already on this device".
  useEffect(() => {
    let alive = true;
    (async () => {
      const profile = await detectHardware();
      // Cached means cached in the weight format this device will load (q4f16 and q4 are different files).
      const { dtype } = pickBackend(profile, classify(profile).class);
      const have = new Set<string>();
      for (const m of CATALOG)
        if (await isModelCached(m.repo, m.revision, dtype)) have.add(m.id);
      if (alive) {
        setHw(profile);
        setCached(have);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // A returning visitor with a downloaded model goes straight to the chat instead of the model choice.
  const resumed = useRef(false);
  /** True until we know whether a returning visitor is resumed, so the welcome page does not flash first. */
  const [checking, setChecking] = useState(() => !!localStorage.getItem(PREFS.MODEL_KEY));
  useEffect(() => {
    if (resumed.current || !reco || stage.name !== "welcome") return;
    resumed.current = true;
    const savedId = localStorage.getItem(PREFS.MODEL_KEY);
    const option = reco.options.find(
      (o) => o.model.id === savedId && cached.has(o.model.id) && o.fit !== "not-advised",
    );
    setChecking(false);
    if (option) void startModel(option);
  }, [reco, cached, stage.name]);

  // After an update that added models, say so once, with a way to look at them. Not on a first visit.
  const announced = useRef(false);
  useEffect(() => {
    if (announced.current || !reco || stage.name !== "chat") return;
    announced.current = true;
    const ids = CATALOG.map((m) => m.id);
    const fresh = reco.options.filter(
      (o) =>
        unseenModels(readSeenModels(), ids).includes(o.model.id) &&
        o.fit !== "not-advised" &&
        !cached.has(o.model.id),
    );
    writeSeenModels(ids);
    if (fresh.length === 0) return;
    toast.add({
      title: tr("New models available", "Neue Modelle verfügbar"),
      description: fresh.map((o) => o.model.label).join(", "),
      timeout: 0,
      actionProps: {
        children: tr("Switch model", "Modell wechseln"),
        onClick: () => setStage({ name: "picker" }),
      },
    });
  }, [reco, cached, stage.name]);

  /** The answer being written, if any, and the chat it goes into. */
  const inFlight = useRef<Promise<void> | null>(null);
  const writingChat = useRef<string | null>(null);
  /** Set when the state change came from another tab: writing it back would bounce between tabs. */
  const fromOtherTab = useRef(false);

  // Another tab saved or deleted chats. Without this, each tab overwrites the other's chats with its own
  // copy, and "delete everything" in one tab is undone by the next save in another.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.storageArea !== localStorage) return;
      if (e.key !== null && e.key !== STORAGE_KEY) return;
      fromOtherTab.current = true;
      if (e.key === null || e.newValue === null) {
        // Wiped in another tab: stop writing into a chat that no longer exists.
        if (writingChat.current) getEngine().interrupt();
        // Forget it too, or the next sync (the wiping tab saves its empty state) would keep it alive.
        writingChat.current = null;
        dispatch({ type: "clear" });
      } else {
        dispatch({
          type: "sync",
          incoming: deserialize(e.newValue),
          keepChatId: writingChat.current,
        });
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Persist chats, but not on every streamed token.
  useEffect(() => {
    if (fromOtherTab.current) {
      fromOtherTab.current = false;
      return;
    }
    if (generating) return;
    try {
      localStorage.setItem(STORAGE_KEY, serialize(chat));
    } catch {
      // storage full or blocked: chats simply will not survive a reload
    }
  }, [chat, generating]);

  async function startModel(option: Option) {
    // Loading frees the current model: finish (stop) the answer that uses it first.
    if (inFlight.current) {
      getEngine().interrupt();
      await inFlight.current;
    }
    cancelled.current = false;
    setAdvice(null);
    setLoaded(null);
    setStage({ name: "loading", option, loaded: 0, total: 0, phase: "loading" });
    try {
      await getEngine().load(option.model, option.backend, {
        onProgress: (loaded, total) =>
          setStage((s) => (s.name === "loading" ? { ...s, loaded, total } : s)),
        onPhase: (phase) => setStage((s) => (s.name === "loading" ? { ...s, phase } : s)),
      });
      localStorage.setItem(PREFS.MODEL_KEY, option.model.id);
      markModelComplete(option.model.repo, option.model.revision, option.backend.dtype);
      setCached((c) => new Set(c).add(option.model.id));
      setLoaded(option);
      setStage({ name: "chat", option });
    } catch (err) {
      if (cancelled.current) return;
      setStage({
        name: "failed",
        option,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  function cancelLoad() {
    cancelled.current = true;
    resetEngine();
    setStage({ name: "welcome" });
  }

  // Token updates are batched to one render per frame: models can emit faster than the screen refreshes.
  const buffer = useRef("");
  const frame = useRef(0);

  function send(text: string): string | undefined {
    if (stage.name !== "chat" || generating) return;
    const option = stage.option;
    const chatId = chat.activeId ?? crypto.randomUUID();
    if (!chat.activeId) dispatch({ type: "new", id: chatId, now: Date.now() });
    const history = chat.chats.find((c) => c.id === chatId);
    const assistantId = crypto.randomUUID();
    const userId = crypto.randomUUID();
    dispatch({
      type: "send",
      chatId,
      userId,
      assistantId,
      text,
      now: Date.now(),
    });
    setFirstMessageAt((v) => v ?? performance.timeOrigin + performance.now());
    setGenerating(true);
    writingChat.current = chatId;

    const flush = () => {
      frame.current = 0;
      if (!buffer.current) return;
      dispatch({ type: "token", chatId, messageId: assistantId, text: buffer.current });
      buffer.current = "";
    };

    inFlight.current = (async () => {
      try {
        const messages = [
          { role: "system" as const, content: SYSTEM_PROMPT },
          ...(history ? toModelMessages(history) : []),
          { role: "user" as const, content: text },
        ];
        const stats = await getEngine().generate(messages, (piece) => {
          buffer.current += piece;
          if (!frame.current) frame.current = requestAnimationFrame(flush);
        });
        cancelAnimationFrame(frame.current);
        flush();
        dispatch({ type: "finish", chatId, messageId: assistantId, stats });

        if (reco && !stats.interrupted && !dismissed.current.has(option.model.id)) {
          const result = adviseFromSpeed(
            stats.tokensPerSecond,
            stats.tokens,
            option.model,
            reco.options,
          );
          setAdvice(
            result.kind === "ok"
              ? null
              : { ...result, tokensPerSecond: stats.tokensPerSecond },
          );
        }
      } catch (err) {
        cancelAnimationFrame(frame.current);
        flush();
        dispatch({
          type: "fail",
          chatId,
          messageId: assistantId,
          error: err instanceof Error ? err.message : String(err),
        });
      } finally {
        setGenerating(false);
        writingChat.current = null;
        inFlight.current = null;
      }
    })();
    return userId;
  }

  function switchTo(modelId: string) {
    const option = reco?.options.find((o) => o.model.id === modelId);
    if (option) void startModel(option);
  }

  const active = chat.chats.find((c) => c.id === chat.activeId) ?? null;
  const lighter = (option: Option) => {
    const i = CATALOG.findIndex((m) => m.id === option.model.id);
    return i > 0
      ? reco?.options.find((o) => o.model.id === CATALOG[i - 1]!.id)
      : undefined;
  };

  const privacy = (
    <PrivacyPanel
      open={showPrivacy}
      onOpenChange={setShowPrivacy}
      records={records}
      firstMessageAt={firstMessageAt}
      onWiped={() => {
        resetEngine();
        setLoaded(null);
        dispatch({ type: "clear" });
        setCached(new Set());
        setStage({ name: "welcome" });
      }}
    />
  );

  const newChat = () => {
    if (!active || active.messages.length > 0)
      dispatch({ type: "new", id: crypto.randomUUID(), now: Date.now() });
  };

  // The chat screen has a history sidebar (a sheet on phones); every other screen is a plain page.
  // A model that is already on the device shows the chat straight away and finishes starting in the background.
  const shown =
    stage.name === "chat"
      ? stage.option
      : stage.name === "loading" && cached.has(stage.option.model.id)
        ? stage.option
        : null;
  if (shown) {
    return (
      <SidebarProvider className="h-dvh min-h-0">
        <ChatSidebar
          chats={chat.chats}
          activeId={chat.activeId}
          onSelect={(id) => dispatch({ type: "select", id })}
          onNew={newChat}
          onDelete={(id) => dispatch({ type: "delete", id })}
        />
        <SidebarChrome onNew={newChat} />
        <SidebarInset className="relative min-h-0">
          <div className="absolute top-2 right-3 z-20">
            <HeaderActions onPrivacy={() => setShowPrivacy(true)} />
          </div>
          <Chat
            active={active}
            ready={stage.name === "chat"}
            modelLabel={shown.model.label}
            onChangeModel={() => setStage({ name: "picker" })}
            generating={generating}
            onSend={send}
            onStop={() => getEngine().interrupt()}
            banner={
              advice && (
                <AdviceBanner
                  advice={advice}
                  tokensPerSecond={advice.tokensPerSecond}
                  onDismiss={() => {
                    dismissed.current.add(shown.model.id);
                    setAdvice(null);
                  }}
                  onSwitch={() => switchTo(advice.suggest.id)}
                />
              )
            }
          />
        </SidebarInset>
        {privacy}
      </SidebarProvider>
    );
  }

  return (
    <div className="flex h-dvh flex-col">
      <AppHeader onPrivacy={() => setShowPrivacy(true)} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        {stage.name === "welcome" && checking && (
          <main className="flex min-h-[60dvh] items-center justify-center">
            <Spinner className="size-6" />
          </main>
        )}
        {stage.name === "welcome" && !checking && (
          <Welcome
            hw={hw}
            reco={reco}
            cached={cached}
            onStart={startModel}
            onPicker={() => setStage({ name: "picker" })}
          />
        )}
        {stage.name === "picker" && reco && (
          <ModelPicker
            options={reco.options}
            cached={cached}
            onPick={startModel}
            onBack={() =>
              setStage(loaded ? { name: "chat", option: loaded } : { name: "welcome" })
            }
          />
        )}
        {stage.name === "loading" && (
          <Loading
            option={stage.option}
            loaded={stage.loaded}
            total={stage.total}
            phase={stage.phase}
            fromCache={cached.has(stage.option.model.id)}
            onCancel={cancelLoad}
          />
        )}
        {stage.name === "failed" && (
          <main className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-16">
            <Alert variant="destructive">
              <AlertTitle>
                {tr(
                  "The model could not be loaded",
                  "Das Modell konnte nicht geladen werden",
                )}
              </AlertTitle>
              <AlertDescription>{stage.message}</AlertDescription>
            </Alert>
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => startModel(stage.option)}>
                {tr("Try again", "Erneut versuchen")}
              </Button>
              {lighter(stage.option) && (
                <Button
                  variant="outline"
                  onClick={() => startModel(lighter(stage.option)!)}
                >
                  {tr("Try a lighter model", "Leichteres Modell versuchen")}
                </Button>
              )}
            </div>
          </main>
        )}
      </div>
      {privacy}
    </div>
  );
}
