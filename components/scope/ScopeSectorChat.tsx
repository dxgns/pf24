"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ATC_FREQUENCIES } from "@/lib/atcFrequencies";

type StoredConnection = { callsign?: string };
type ChatKind = "private" | "public" | "console";
type ChatRef = { position: string; frequency: string; kind: ChatKind; fixed: boolean };
type ChatMessage = { id: string; from: string; to: string; text: string; sentAt: number };
type ChatState = {
  chats: ChatRef[];
  active: string | null;
  history: Record<string, ChatMessage[]>;
  unread: Record<string, number>;
};
type ChatPayload = ChatMessage & { kind: "sector-chat" };

const CONNECTION_KEY = "pf24_scope_connection_session_v1";
const STORAGE_KEY = "pf24_scope_sector_chat_v4";
const CHANNEL_NAME = "scope-sector-private-chat-v4";
const MAX_MESSAGES = 200;
const MAX_PRIVATE_CHATS = 10;
const PUBLIC_CHAT_KEY = "__PF24_PUBLIC_FREQUENCY__";
const CONSOLE_CHAT_KEY = "__PF24_CONSOLE__";
const FREQUENCY_RE = /^\d{3}\.\d{3}$/;
const CALLSIGN_RE = /^[A-Z0-9]+(?:_[A-Z0-9]+)+$/;

function emptyState(): ChatState {
  return { chats: [], active: null, history: {}, unread: {} };
}

function normalize(value?: string | null) {
  return value?.trim().toUpperCase() ?? "";
}

function readPosition() {
  try {
    const stored = JSON.parse(sessionStorage.getItem(CONNECTION_KEY) ?? "null") as StoredConnection | null;
    return normalize(stored?.callsign);
  } catch {
    return "";
  }
}

function loadAll(): Record<string, ChatState> {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, ChatState>
      : {};
  } catch {
    return {};
  }
}

function normalizeChat(chat: Partial<ChatRef>): ChatRef | null {
  const position = typeof chat.position === "string" ? normalize(chat.position) : "";
  const frequency = typeof chat.frequency === "string" ? chat.frequency.trim() : "";

  if (position === PUBLIC_CHAT_KEY) {
    return { position, frequency, kind: "public", fixed: true };
  }
  if (position === CONSOLE_CHAT_KEY) {
    return { position, frequency: "Console", kind: "console", fixed: true };
  }
  if (!CALLSIGN_RE.test(position) || !FREQUENCY_RE.test(frequency) || !ATC_FREQUENCIES[position]) return null;
  return { position, frequency, kind: "private", fixed: false };
}

function sanitizeState(value: ChatState | undefined, ownFrequency: string): ChatState {
  if (!value) {
    const chats = ownFrequency
      ? [
          { position: PUBLIC_CHAT_KEY, frequency: ownFrequency, kind: "public" as const, fixed: true },
          { position: CONSOLE_CHAT_KEY, frequency: "Console", kind: "console" as const, fixed: true },
        ]
      : [];
    return { chats, active: chats[0]?.position ?? null, history: {}, unread: {} };
  }

  const normalizedChats = Array.isArray(value.chats)
    ? value.chats.map((chat) => normalizeChat(chat)).filter((chat): chat is ChatRef => Boolean(chat))
    : [];

  const privateChats: ChatRef[] = [];
  for (const chat of normalizedChats) {
    if (chat.kind !== "private") continue;
    if (!privateChats.some((item) => item.position === chat.position)) privateChats.push(chat);
  }

  const defaults: ChatRef[] = ownFrequency
    ? [
        { position: PUBLIC_CHAT_KEY, frequency: ownFrequency, kind: "public", fixed: true },
        { position: CONSOLE_CHAT_KEY, frequency: "Console", kind: "console", fixed: true },
      ]
    : [];

  const history = value.history && typeof value.history === "object" ? value.history : {};
  const unread = value.unread && typeof value.unread === "object" ? value.unread : {};
  const chats = [...defaults, ...privateChats.filter((chat) => !defaults.some((item) => item.position === chat.position))].slice(0, 2 + MAX_PRIVATE_CHATS);
  const activeValue = typeof value.active === "string" ? normalize(value.active) : "";
  const active = chats.some((chat) => chat.position === activeValue) ? activeValue : chats[0]?.position ?? null;

  return {
    chats,
    active,
    history,
    unread: Object.fromEntries(chats.map((chat) => [chat.position, Math.max(0, Number(unread[chat.position] ?? 0) || 0)])),
  };
}

function loadState(position: string) {
  if (!position) return emptyState();
  return sanitizeState(loadAll()[position], ATC_FREQUENCIES[position] ?? "");
}

function saveState(position: string, state: ChatState) {
  if (!position) return;
  try {
    const all = loadAll();
    all[position] = state;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {}
}

function findFooter() {
  return document.querySelector<HTMLElement>("main.fixed footer");
}

function findFreqWindow() {
  return Array.from(document.querySelectorAll<HTMLElement>("main.fixed > section > div.absolute.z-30"))
    .find((element) => element.firstElementChild?.textContent?.toUpperCase().includes("FREQ")) ?? null;
}

function frequencyRows() {
  const win = findFreqWindow();
  if (!win) return [] as HTMLElement[];
  return Array.from(win.querySelectorAll<HTMLElement>("div.flex.whitespace-nowrap"));
}

function parseFrequencyRow(row: HTMLElement) {
  const spans = Array.from(row.querySelectorAll<HTMLSpanElement>(":scope > span"));
  if (spans.length < 2) return null;
  const position = normalize(spans[0].textContent);
  const frequency = spans[1].textContent?.trim() ?? "";
  if (!CALLSIGN_RE.test(position) || !FREQUENCY_RE.test(frequency)) return null;
  if (!ATC_FREQUENCIES[position]) return null;
  return { position, frequency, frequencySpan: spans[1] };
}

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function messageId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `chat-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function formatFrequency(message: ChatMessage, ownFrequency: string) {
  if (message.from === PUBLIC_CHAT_KEY) return ownFrequency || "---.---";
  return (ATC_FREQUENCIES[normalize(message.from)] ?? ownFrequency) || "---.---";
}

export default function ScopeSectorChat() {
  const [footer, setFooter] = useState<HTMLElement | null>(null);
  const [state, setState] = useState<ChatState>(emptyState);
  const stateRef = useRef<ChatState>(emptyState());
  const positionRef = useRef("");
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const subscribedRef = useRef(false);
  const pendingRef = useRef<ChatMessage[]>([]);
  const logRef = useRef<HTMLDivElement | null>(null);

  const replaceState = useCallback((next: ChatState) => {
    stateRef.current = next;
    setState(next);
    saveState(positionRef.current, next);
  }, []);

  const updateState = useCallback((updater: (current: ChatState) => ChatState) => {
    replaceState(updater(stateRef.current));
  }, [replaceState]);

  const sendBroadcast = useCallback((message: ChatMessage) => {
    if (!channelRef.current || !subscribedRef.current) {
      pendingRef.current.push(message);
      return;
    }
    void channelRef.current.send({
      type: "broadcast",
      event: "message",
      payload: { ...message, kind: "sector-chat" } satisfies ChatPayload,
    }).then((result) => {
      if (result !== "ok") console.error("PF24 sector chat send failed:", result);
    }).catch((error) => console.error("PF24 sector chat send failed:", error));
  }, []);

  const flushPending = useCallback(() => {
    if (!channelRef.current || !subscribedRef.current || pendingRef.current.length === 0) return;
    const queued = pendingRef.current.splice(0, pendingRef.current.length);
    for (const message of queued) sendBroadcast(message);
  }, [sendBroadcast]);

  const ensureChat = useCallback((targetPosition: string, frequency: string) => {
    const remote = normalize(targetPosition);
    const freq = frequency.trim();
    const me = positionRef.current;
    if (!me || !remote || remote === me || !ATC_FREQUENCIES[remote] || !FREQUENCY_RE.test(freq)) return;

    updateState((current) => {
      const exists = current.chats.some((chat) => chat.position === remote);
      const chats: ChatRef[] = exists
        ? current.chats.map((chat) => chat.position === remote ? { ...chat, frequency: freq } : chat)
        : [...current.chats, { position: remote, frequency: freq, kind: "private" as const, fixed: false }].slice(0, 2 + MAX_PRIVATE_CHATS);
      return { ...current, chats, active: remote };
    });
  }, [updateState]);

  const markRead = useCallback((chatId: string) => {
    updateState((current) => ({
      ...current,
      unread: { ...current.unread, [chatId]: 0 },
    }));
  }, [updateState]);

  const removeChat = useCallback((chatId: string) => {
    updateState((current) => {
      const chat = current.chats.find((item) => item.position === chatId);
      if (!chat || chat.fixed) return current;
      const chats = current.chats.filter((item) => item.position !== chatId);
      const history = { ...current.history };
      const unread = { ...current.unread };
      delete history[chatId];
      delete unread[chatId];
      const active = current.active === chatId
        ? chats.find((item) => item.position === PUBLIC_CHAT_KEY)?.position ?? chats[0]?.position ?? null
        : current.active;
      return { ...current, chats, history, unread, active };
    });
  }, [updateState]);

  const sendCurrent = useCallback((raw: string) => {
    const me = positionRef.current;
    const chatId = stateRef.current.active;
    const text = raw.trim().slice(0, 500);
    if (!me || !chatId || !text) return false;

    const chat = stateRef.current.chats.find((item) => item.position === chatId);
    if (!chat) return false;

    const message: ChatMessage = { id: messageId(), from: me, to: chat.position, text, sentAt: Date.now() };
    updateState((current) => ({
      ...current,
      history: { ...current.history, [chatId]: [...(current.history[chatId] ?? []), message].slice(-MAX_MESSAGES) },
    }));

    if (chat.kind === "private") sendBroadcast(message);
    return true;
  }, [sendBroadcast, updateState]);

  useEffect(() => {
    const initial = readPosition();
    positionRef.current = initial;
    const loaded = loadState(initial);
    stateRef.current = loaded;
    setState(loaded);
    setFooter(findFooter());

    const onConnection = (event: Event) => {
      const detail = (event as CustomEvent<{ connected?: boolean; callsign?: string }>).detail;
      if (positionRef.current) saveState(positionRef.current, stateRef.current);
      const next = detail?.connected ? normalize(detail.callsign) || readPosition() : "";
      positionRef.current = next;
      pendingRef.current = [];
      const loadedNext = loadState(next);
      stateRef.current = loadedNext;
      setState(loadedNext);
      setFooter(findFooter());
    };

    const timer = window.setInterval(() => {
      const next = findFooter();
      setFooter((current) => current === next ? current : next);
    }, 300);

    window.addEventListener("pf24-scope-connection-change", onConnection);
    return () => {
      if (positionRef.current) saveState(positionRef.current, stateRef.current);
      window.clearInterval(timer);
      window.removeEventListener("pf24-scope-connection-change", onConnection);
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    let retryTimer: number | null = null;

    const connect = () => {
      if (disposed) return;
      const channel = supabase.channel(CHANNEL_NAME, { config: { broadcast: { self: false } } });
      channelRef.current = channel;
      channel
        .on("broadcast", { event: "message" }, ({ payload }) => {
          const message = payload as Partial<ChatPayload>;
          const me = positionRef.current;
          const from = normalize(message.from);
          const to = normalize(message.to);
          if (!me || message.kind !== "sector-chat" || to !== me || !from || from === me || !message.id || !message.text || !Number.isFinite(Number(message.sentAt))) return;

          const incoming: ChatMessage = {
            id: String(message.id),
            from,
            to: me,
            text: String(message.text).slice(0, 500),
            sentAt: Number(message.sentAt),
          };

          updateState((current) => {
            const history = current.history[from] ?? [];
            if (history.some((item) => item.id === incoming.id)) return current;
            const frequency = ATC_FREQUENCIES[from] ?? "---.---";
            const chats: ChatRef[] = current.chats.some((chat) => chat.position === from)
              ? current.chats.map((chat) => chat.position === from ? { ...chat, frequency } : chat)
              : [...current.chats, { position: from, frequency, kind: "private" as const, fixed: false }].slice(0, 2 + MAX_PRIVATE_CHATS);
            return {
              ...current,
              chats,
              active: from,
              history: { ...current.history, [from]: [...history, incoming].slice(-MAX_MESSAGES) },
              unread: { ...current.unread, [from]: (current.unread[from] ?? 0) + 1 },
            };
          });
        })
        .subscribe((status) => {
          subscribedRef.current = status === "SUBSCRIBED";
          if (status === "SUBSCRIBED") flushPending();
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            subscribedRef.current = false;
            void supabase.removeChannel(channel);
            channelRef.current = null;
            if (!disposed) retryTimer = window.setTimeout(connect, 1500);
          }
        });
    };

    connect();
    return () => {
      disposed = true;
      if (retryTimer !== null) window.clearTimeout(retryTimer);
      subscribedRef.current = false;
      pendingRef.current = [];
      const channel = channelRef.current;
      channelRef.current = null;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [flushPending, updateState]);

  useEffect(() => {
    const onDoubleClick = (event: MouseEvent) => {
      if (event.button !== 0) return;
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      const row = target.closest<HTMLElement>("div.flex.whitespace-nowrap");
      if (!row) return;
      const win = row.closest<HTMLElement>("main.fixed > section > div.absolute.z-30");
      if (!win || !win.firstElementChild?.textContent?.toUpperCase().includes("FREQ")) return;
      const parsed = parseFrequencyRow(row);
      if (!parsed) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      ensureChat(parsed.position, parsed.frequency);
      window.setTimeout(() => findFooter()?.querySelector<HTMLInputElement>("input")?.focus(), 0);
    };

    const onContextMenu = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const row = target?.closest<HTMLElement>("div.flex.whitespace-nowrap");
      if (!row) return;
      const win = row.closest<HTMLElement>("main.fixed > section > div.absolute.z-30");
      if (!win || !win.firstElementChild?.textContent?.toUpperCase().includes("FREQ")) return;
      const parsed = parseFrequencyRow(row);
      if (!parsed || (stateRef.current.unread[parsed.position] ?? 0) <= 0) return;
      event.preventDefault();
      event.stopPropagation();
      markRead(parsed.position);
    };

    document.addEventListener("dblclick", onDoubleClick, true);
    document.addEventListener("contextmenu", onContextMenu, true);
    return () => {
      document.removeEventListener("dblclick", onDoubleClick, true);
      document.removeEventListener("contextmenu", onContextMenu, true);
    };
  }, [ensureChat, markRead]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const input = target instanceof HTMLInputElement && target.closest("main.fixed footer") ? target : null;
      if (!input || !stateRef.current.active) return;

      if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        event.preventDefault();
        event.stopImmediatePropagation();
        logRef.current?.scrollBy({ top: event.key === "ArrowUp" ? -28 : 28, behavior: "auto" });
        return;
      }

      if (event.key !== "Enter" || event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return;
      const value = input.value.trim();
      if (!value) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (sendCurrent(value)) setInputValue(input, "");
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [sendCurrent]);

  useEffect(() => {
    const input = footer?.querySelector<HTMLInputElement>("input");
    if (!input) return;
    const previous = input.style.marginLeft;
    input.style.marginLeft = state.chats.length > 0 ? "210px" : "";
    return () => { input.style.marginLeft = previous; };
  }, [footer, state.chats.length]);

  useEffect(() => {
    const syncUnread = () => {
      const unread = stateRef.current.unread;
      for (const row of frequencyRows()) {
        const parsed = parseFrequencyRow(row);
        if (!parsed) continue;
        const hasUnread = (unread[parsed.position] ?? 0) > 0;
        parsed.frequencySpan.style.setProperty("color", hasUnread ? "#00efff" : "", hasUnread ? "important" : "");
        if (hasUnread) row.dataset.pf24ChatUnread = "true";
        else delete row.dataset.pf24ChatUnread;
      }
    };
    syncUnread();
    const timer = window.setInterval(syncUnread, 350);
    return () => window.clearInterval(timer);
  }, [state.unread]);

  useEffect(() => {
    if (!state.active) return;
    window.requestAnimationFrame(() => {
      if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
    });
  }, [state.active, state.history]);

  if (!footer) return null;
  const messages = state.active ? state.history[state.active] ?? [] : [];
  const activeChat = state.chats.find((chat) => chat.position === state.active) ?? null;
  const activeFrequency = activeChat?.frequency ?? "---.---";
  const activeUnread = activeChat ? (state.unread[activeChat.position] ?? 0) > 0 : false;
  const ownFrequency = positionRef.current ? ATC_FREQUENCIES[positionRef.current] ?? "---.---" : "---.---";

  return createPortal(
    <>
      {state.active && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-[45] h-[76px] bg-[#555c61] font-mono text-[9px] text-[#e8e8e8]">
          <div ref={logRef} className="pointer-events-auto h-full overflow-y-auto px-[5px] py-[5px] leading-[12px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {messages.map((message) => {
              const frequency = formatFrequency(message, ownFrequency);
              return (
                <div key={message.id} className={`whitespace-pre-wrap break-words ${activeUnread ? "text-[#00efff]" : "text-[#e8e8e8]"}`}>
                  <span
                    className="cursor-context-menu"
                    onContextMenu={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      markRead(state.active!);
                    }}
                  >
                    {frequency}:
                  </span>
                  <span> {message.text}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {state.chats.length > 0 && (
        <div className="absolute bottom-[9px] left-[4px] z-[65] flex h-[18px] w-[198px] items-center gap-[3px] overflow-x-auto overflow-y-hidden whitespace-nowrap font-mono text-[9px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {state.chats.map((chat) => {
            const selected = state.active === chat.position;
            const unread = (state.unread[chat.position] ?? 0) > 0;
            const label = chat.kind === "console" ? "Console" : chat.frequency;
            return (
              <span
                key={chat.position}
                title={chat.fixed ? `${label} · chat fijo` : `${label} · doble click para eliminar`}
                onClick={() => updateState((current) => ({ ...current, active: chat.position }))}
                onContextMenu={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  markRead(chat.position);
                }}
                onDoubleClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  removeChat(chat.position);
                }}
                className={`cursor-default select-none px-[2px] leading-[18px] ${unread ? "text-[#00efff]" : selected ? "text-[#111] underline" : "text-[#333]"}`}
              >
                {label}
              </span>
            );
          })}
        </div>
      )}

      <div className="pointer-events-none absolute bottom-0 left-0 z-[64] h-[36px] w-full font-mono text-[9px]">
        <div className="ml-[168px] flex h-[36px] items-center gap-[10px] pl-[2px] text-[#111]">
          <span className="whitespace-nowrap">on {activeFrequency}</span>
        </div>
      </div>
    </>,
    footer,
  );
}
