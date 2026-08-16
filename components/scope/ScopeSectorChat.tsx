"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ATC_FREQUENCIES } from "@/lib/atcFrequencies";

type StoredConnection = { callsign?: string };
type ChatRef = { position: string; frequency: string };
type ChatMessage = { id: string; from: string; to: string; text: string; sentAt: number };
type ChatState = {
  chats: ChatRef[];
  active: string | null;
  history: Record<string, ChatMessage[]>;
  unread: Record<string, number>;
};
type ChatPayload = ChatMessage & { kind: "sector-chat" };

const CONNECTION_KEY = "pf24_scope_connection_session_v1";
const STORAGE_KEY = "pf24_scope_sector_chat_v3";
const CHANNEL_NAME = "scope-sector-private-chat-v3";
const MAX_MESSAGES = 200;
const MAX_CHATS = 12;
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

function sanitizeState(value: ChatState | undefined): ChatState {
  if (!value) return emptyState();
  const chats = Array.isArray(value.chats)
    ? value.chats
      .filter((chat) => chat && typeof chat.position === "string" && FREQUENCY_RE.test(String(chat.frequency)))
      .map((chat) => ({ position: normalize(chat.position), frequency: String(chat.frequency).trim() }))
      .filter((chat) => CALLSIGN_RE.test(chat.position) && FREQUENCY_RE.test(chat.frequency))
      .slice(-MAX_CHATS)
    : [];
  const history = value.history && typeof value.history === "object" ? value.history : {};
  const unread = value.unread && typeof value.unread === "object" ? value.unread : {};
  const active = typeof value.active === "string" && chats.some((chat) => chat.position === normalize(value.active))
    ? normalize(value.active)
    : null;
  return { chats, active, history, unread };
}

function loadState(position: string) {
  return position ? sanitizeState(loadAll()[position]) : emptyState();
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

function formatTime(timestamp: number) {
  const date = new Date(timestamp);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`;
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

  const openChat = useCallback((targetPosition: string, frequency: string) => {
    const remote = normalize(targetPosition);
    const freq = frequency.trim();
    const me = positionRef.current;
    if (!me || !remote || remote === me || !ATC_FREQUENCIES[remote] || !FREQUENCY_RE.test(freq)) return;

    updateState((current) => {
      const chats = current.chats.some((chat) => chat.position === remote)
        ? current.chats.map((chat) => chat.position === remote ? { ...chat, frequency: freq } : chat)
        : [...current.chats, { position: remote, frequency: freq }].slice(-MAX_CHATS);
      return { ...current, chats, active: remote, unread: { ...current.unread, [remote]: 0 } };
    });
  }, [updateState]);

  const removeChat = useCallback((remote: string) => {
    updateState((current) => {
      const chats = current.chats.filter((chat) => chat.position !== remote);
      const history = { ...current.history };
      const unread = { ...current.unread };
      delete history[remote];
      delete unread[remote];
      const active = current.active === remote ? chats[chats.length - 1]?.position ?? null : current.active;
      return { ...current, chats, history, unread, active };
    });
  }, [updateState]);

  const sendCurrent = useCallback((raw: string) => {
    const me = positionRef.current;
    const remote = stateRef.current.active;
    const text = raw.trim().slice(0, 500);
    if (!me || !remote || !text) return false;

    const message: ChatMessage = { id: messageId(), from: me, to: remote, text, sentAt: Date.now() };
    updateState((current) => ({
      ...current,
      history: { ...current.history, [remote]: [...(current.history[remote] ?? []), message].slice(-MAX_MESSAGES) },
    }));
    sendBroadcast(message);
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
            const chats = current.chats.some((chat) => chat.position === from)
              ? current.chats.map((chat) => chat.position === from ? { ...chat, frequency } : chat)
              : [...current.chats, { position: from, frequency }].slice(-MAX_CHATS);
            const read = current.active === from && document.visibilityState === "visible";
            return {
              ...current,
              chats,
              history: { ...current.history, [from]: [...history, incoming].slice(-MAX_MESSAGES) },
              unread: { ...current.unread, [from]: read ? 0 : (current.unread[from] ?? 0) + 1 },
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
      openChat(parsed.position, parsed.frequency);
      window.setTimeout(() => findFooter()?.querySelector<HTMLInputElement>("input")?.focus(), 0);
    };

    document.addEventListener("dblclick", onDoubleClick, true);
    return () => document.removeEventListener("dblclick", onDoubleClick, true);
  }, [openChat]);

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

  return createPortal(
    <>
      {state.active && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-[45] h-[76px] bg-[#555c61] font-mono text-[9px] text-[#e8e8e8]">
          <div ref={logRef} className="pointer-events-auto h-full overflow-y-auto px-[5px] py-[5px] leading-[12px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {messages.map((message) => (
              <div key={message.id} className="whitespace-pre-wrap break-words">
                <span className="text-[#bfc8c6]">{formatTime(message.sentAt)} </span>
                <span className={message.from === positionRef.current ? "text-[#e8e8e8]" : "text-[#00efff]"}>{message.from}</span>
                <span>: {message.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {state.chats.length > 0 && (
        <div className="absolute bottom-[9px] left-[4px] z-[65] flex h-[18px] w-[198px] items-center gap-[3px] overflow-x-auto overflow-y-hidden whitespace-nowrap font-mono text-[9px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {state.chats.map((chat) => {
            const selected = state.active === chat.position;
            const unread = (state.unread[chat.position] ?? 0) > 0;
            return (
              <span
                key={chat.position}
                title={`${chat.position} · doble click para eliminar chat`}
                onClick={() => updateState((current) => ({ ...current, active: chat.position, unread: { ...current.unread, [chat.position]: 0 } }))}
                onDoubleClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  removeChat(chat.position);
                }}
                className={`cursor-default select-none px-[2px] leading-[18px] ${unread ? "text-[#00efff]" : selected ? "text-[#111] underline" : "text-[#333]"}`}
              >
                {chat.frequency}
              </span>
            );
          })}
        </div>
      )}
    </>,
    footer,
  );
}
