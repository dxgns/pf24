"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ATC_FREQUENCIES } from "@/lib/atcFrequencies";

type StoredConnection = { callsign?: string };
type ChatKind = "private" | "public" | "console";
type ChatRef = { position: string; frequency: string; kind: ChatKind; fixed: boolean };
type ChatMessage = { id: string; from: string; to: string; text: string; sentAt: number; system?: boolean };
type ChatState = {
  chats: ChatRef[];
  active: string | null;
  history: Record<string, ChatMessage[]>;
  unread: Record<string, number>;
};
type ChatPayload = ChatMessage & { kind: "sector-chat" };

const CONNECTION_KEY = "pf24_scope_connection_session_v1";
const STORAGE_KEY = "pf24_scope_sector_chat_v5";
const CHANNEL_NAME = "scope-sector-private-chat-v4";
const MAX_MESSAGES = 200;
const MAX_PRIVATE_CHATS = 10;
const PUBLIC_CHAT_KEY = "__PF24_PUBLIC_FREQUENCY__";
const CONSOLE_CHAT_KEY = "__PF24_CONSOLE__";
const FREQUENCY_RE = /^\d{3}\.\d{3}$/;
const CALLSIGN_RE = /^[A-Z0-9]+(?:_[A-Z0-9]+)+$/;

const CONSOLE_CHAT: ChatRef = { position: CONSOLE_CHAT_KEY, frequency: "Console", kind: "console", fixed: true };

function normalize(value?: string | null) {
  return value?.trim().toUpperCase() ?? "";
}

function messageId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `chat-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function systemMessage(text: string): ChatMessage {
  return { id: messageId(), from: CONSOLE_CHAT_KEY, to: CONSOLE_CHAT_KEY, text, sentAt: Date.now(), system: true };
}

function readPosition() {
  try {
    const stored = JSON.parse(sessionStorage.getItem(CONNECTION_KEY) ?? "null") as StoredConnection | null;
    return normalize(stored?.callsign);
  } catch { return ""; }
}

function loadAll(): Record<string, ChatState> {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, ChatState> : {};
  } catch { return {}; }
}

function storageKey(position: string) { return position || "__DISCONNECTED__"; }

function normalizeChat(chat: Partial<ChatRef>): ChatRef | null {
  const position = typeof chat.position === "string" ? normalize(chat.position) : "";
  const frequency = typeof chat.frequency === "string" ? chat.frequency.trim() : "";
  if (position === CONSOLE_CHAT_KEY) return CONSOLE_CHAT;
  if (position === PUBLIC_CHAT_KEY && FREQUENCY_RE.test(frequency)) return { position, frequency, kind: "public", fixed: true };
  if (!CALLSIGN_RE.test(position) || !FREQUENCY_RE.test(frequency) || !ATC_FREQUENCIES[position]) return null;
  return { position, frequency, kind: "private", fixed: false };
}

function defaultConsoleHistory(): ChatMessage[] {
  return [
    systemMessage("Bienvenido a PFScope."),
    systemMessage("Ejecuta el comando .ayuda para ver la lista de comandos"),
  ];
}

function sanitizeState(value: ChatState | undefined, position: string): ChatState {
  const ownFrequency = position ? ATC_FREQUENCIES[position] ?? "" : "";
  const storedChats = Array.isArray(value?.chats)
    ? value!.chats.map(normalizeChat).filter((chat): chat is ChatRef => Boolean(chat))
    : [];

  const privateChats = storedChats.filter((chat) => chat.kind === "private").slice(0, MAX_PRIVATE_CHATS);
  const fixedChats: ChatRef[] = ownFrequency
    ? [{ position: PUBLIC_CHAT_KEY, frequency: ownFrequency, kind: "public", fixed: true }, CONSOLE_CHAT]
    : [CONSOLE_CHAT];
  const chats = [...privateChats, ...fixedChats];
  const history = value?.history && typeof value.history === "object" ? { ...value.history } : {};
  if (!history[CONSOLE_CHAT_KEY]?.length) history[CONSOLE_CHAT_KEY] = defaultConsoleHistory();
  const unreadSource = value?.unread && typeof value.unread === "object" ? value.unread : {};
  const activeCandidate = typeof value?.active === "string" ? normalize(value.active) : "";
  const active = chats.some((chat) => chat.position === activeCandidate) ? activeCandidate : CONSOLE_CHAT_KEY;

  return {
    chats,
    active,
    history,
    unread: Object.fromEntries(chats.map((chat) => [chat.position, Math.max(0, Number(unreadSource[chat.position] ?? 0) || 0)])),
  };
}

function loadState(position: string) {
  return sanitizeState(loadAll()[storageKey(position)], position);
}

function saveState(position: string, state: ChatState) {
  try {
    const all = loadAll();
    all[storageKey(position)] = state;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {}
}

function findFooter() { return document.querySelector<HTMLElement>("main.fixed footer"); }
function findFreqWindow() {
  return Array.from(document.querySelectorAll<HTMLElement>("main.fixed > section > div.absolute.z-30"))
    .find((element) => element.firstElementChild?.textContent?.toUpperCase().includes("FREQ")) ?? null;
}
function frequencyRows() {
  const win = findFreqWindow();
  return win ? Array.from(win.querySelectorAll<HTMLElement>("div.flex.whitespace-nowrap")) : [];
}
function parseFrequencyRow(row: HTMLElement) {
  const spans = Array.from(row.querySelectorAll<HTMLSpanElement>(":scope > span"));
  if (spans.length < 2) return null;
  const position = normalize(spans[0].textContent);
  const frequency = spans[1].textContent?.trim() ?? "";
  if (!CALLSIGN_RE.test(position) || !FREQUENCY_RE.test(frequency) || !ATC_FREQUENCIES[position]) return null;
  return { position, frequency, frequencySpan: spans[1] };
}
function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}
function formatFrequency(message: ChatMessage, ownFrequency: string) {
  if (message.from === PUBLIC_CHAT_KEY) return ownFrequency || "---.---";
  return ATC_FREQUENCIES[normalize(message.from)] ?? ownFrequency ?? "---.---";
}

export default function ScopeSectorChat() {
  const [footer, setFooter] = useState<HTMLElement | null>(null);
  const [state, setState] = useState<ChatState>(() => sanitizeState(undefined, ""));
  const stateRef = useRef(state);
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
    if (!channelRef.current || !subscribedRef.current) { pendingRef.current.push(message); return; }
    void channelRef.current.send({ type: "broadcast", event: "message", payload: { ...message, kind: "sector-chat" } satisfies ChatPayload });
  }, []);

  const ensureChat = useCallback((targetPosition: string, frequency: string) => {
    const remote = normalize(targetPosition);
    const me = positionRef.current;
    if (!me || !remote || remote === me || !ATC_FREQUENCIES[remote] || !FREQUENCY_RE.test(frequency)) return;
    updateState((current) => {
      const existing = current.chats.find((chat) => chat.position === remote);
      const chat: ChatRef = existing ? { ...existing, frequency } : { position: remote, frequency, kind: "private", fixed: false };
      const privateChats = [chat, ...current.chats.filter((item) => item.kind === "private" && item.position !== remote)].slice(0, MAX_PRIVATE_CHATS);
      const fixed = current.chats.filter((item) => item.kind !== "private");
      return { ...current, chats: [...privateChats, ...fixed], active: remote, unread: { ...current.unread, [remote]: 0 } };
    });
  }, [updateState]);

  const markRead = useCallback((chatId: string) => {
    updateState((current) => ({ ...current, unread: { ...current.unread, [chatId]: 0 } }));
  }, [updateState]);

  const removeChat = useCallback((chatId: string) => {
    updateState((current) => {
      const chat = current.chats.find((item) => item.position === chatId);
      if (!chat || chat.fixed) return current;
      const chats = current.chats.filter((item) => item.position !== chatId);
      const history = { ...current.history }; delete history[chatId];
      const unread = { ...current.unread }; delete unread[chatId];
      return { ...current, chats, history, unread, active: current.active === chatId ? CONSOLE_CHAT_KEY : current.active };
    });
  }, [updateState]);

  const sendCurrent = useCallback((raw: string) => {
    const text = raw.trim().slice(0, 500);
    const chatId = stateRef.current.active;
    const chat = stateRef.current.chats.find((item) => item.position === chatId);
    if (!text || !chat) return false;

    if (chat.kind === "console") return false;
    const me = positionRef.current;
    if (!me) return false;
    const message: ChatMessage = { id: messageId(), from: me, to: chat.position, text, sentAt: Date.now() };
    updateState((current) => ({ ...current, history: { ...current.history, [chatId!]: [...(current.history[chatId!] ?? []), message].slice(-MAX_MESSAGES) } }));
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
      saveState(positionRef.current, stateRef.current);
      const next = detail?.connected ? normalize(detail.callsign) || readPosition() : "";
      positionRef.current = next;
      pendingRef.current = [];
      const loadedNext = loadState(next);
      if (next) {
        loadedNext.history[CONSOLE_CHAT_KEY] = [
          ...loadedNext.history[CONSOLE_CHAT_KEY],
          systemMessage(`Te haz conectado en ${next}.`),
        ].slice(-MAX_MESSAGES);
        loadedNext.active = CONSOLE_CHAT_KEY;
      }
      stateRef.current = loadedNext;
      setState(loadedNext);
      saveState(next, loadedNext);
      setFooter(findFooter());
    };

    const timer = window.setInterval(() => setFooter((current) => findFooter() ?? current), 300);
    window.addEventListener("pf24-scope-connection-change", onConnection);
    return () => {
      saveState(positionRef.current, stateRef.current);
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
      channel.on("broadcast", { event: "message" }, ({ payload }) => {
        const message = payload as Partial<ChatPayload>;
        const me = positionRef.current;
        const from = normalize(message.from); const to = normalize(message.to);
        if (!me || message.kind !== "sector-chat" || to !== me || !from || from === me || !message.id || !message.text) return;
        const incoming: ChatMessage = { id: String(message.id), from, to: me, text: String(message.text).slice(0, 500), sentAt: Number(message.sentAt) || Date.now() };
        updateState((current) => {
          const frequency = ATC_FREQUENCIES[from] ?? "---.---";
          const chat: ChatRef = { position: from, frequency, kind: "private", fixed: false };
          const privateChats = [chat, ...current.chats.filter((item) => item.kind === "private" && item.position !== from)].slice(0, MAX_PRIVATE_CHATS);
          const fixed = current.chats.filter((item) => item.kind !== "private");
          const history = current.history[from] ?? [];
          if (history.some((item) => item.id === incoming.id)) return current;
          return {
            ...current,
            chats: [...privateChats, ...fixed],
            history: { ...current.history, [from]: [...history, incoming].slice(-MAX_MESSAGES) },
            unread: { ...current.unread, [from]: current.active === from ? 0 : (current.unread[from] ?? 0) + 1 },
          };
        });
      }).subscribe((status) => {
        subscribedRef.current = status === "SUBSCRIBED";
        if (status === "SUBSCRIBED" && pendingRef.current.length) {
          const queued = pendingRef.current.splice(0); queued.forEach(sendBroadcast);
        }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          subscribedRef.current = false; void supabase.removeChannel(channel); channelRef.current = null;
          if (!disposed) retryTimer = window.setTimeout(connect, 1500);
        }
      });
    };
    connect();
    return () => {
      disposed = true; if (retryTimer !== null) window.clearTimeout(retryTimer);
      subscribedRef.current = false; pendingRef.current = [];
      const channel = channelRef.current; channelRef.current = null; if (channel) void supabase.removeChannel(channel);
    };
  }, [sendBroadcast, updateState]);

  useEffect(() => {
    const onDoubleClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const row = target?.closest<HTMLElement>("div.flex.whitespace-nowrap");
      if (!row || !row.closest<HTMLElement>("main.fixed > section > div.absolute.z-30")?.firstElementChild?.textContent?.toUpperCase().includes("FREQ")) return;
      const parsed = parseFrequencyRow(row); if (!parsed) return;
      event.preventDefault(); event.stopImmediatePropagation();
      ensureChat(parsed.position, parsed.frequency);
      window.setTimeout(() => findFooter()?.querySelector<HTMLInputElement>("input")?.focus(), 0);
    };
    document.addEventListener("dblclick", onDoubleClick, true);
    return () => document.removeEventListener("dblclick", onDoubleClick, true);
  }, [ensureChat]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target instanceof HTMLInputElement ? event.target : null;
      if (!target || !target.closest("main.fixed footer")) return;
      if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        event.preventDefault(); event.stopImmediatePropagation();
        logRef.current?.scrollBy({ top: event.key === "ArrowUp" ? -28 : 28, behavior: "auto" });
        return;
      }
      if (event.key !== "Enter" || event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return;
      const value = target.value.trim(); if (!value) return;
      event.preventDefault(); event.stopImmediatePropagation();
      if (sendCurrent(value)) setInputValue(target, "");
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [sendCurrent]);

  useEffect(() => {
    const input = footer?.querySelector<HTMLInputElement>("input");
    if (!input) return;
    const previous = input.style.marginLeft; input.style.marginLeft = "170px";
    return () => { input.style.marginLeft = previous; };
  }, [footer]);

  useEffect(() => {
    const syncFreqColors = () => {
      for (const row of frequencyRows()) {
        const parsed = parseFrequencyRow(row); if (!parsed) continue;
        parsed.frequencySpan.style.setProperty("color", "#ffff00", "important");
      }
    };
    syncFreqColors(); const timer = window.setInterval(syncFreqColors, 250);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!state.active) return;
    window.requestAnimationFrame(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; });
  }, [state.active, state.history]);

  if (!footer) return null;
  const activeChat = state.chats.find((chat) => chat.position === state.active) ?? CONSOLE_CHAT;
  const messages = state.history[activeChat.position] ?? [];
  const ownFrequency = positionRef.current ? ATC_FREQUENCIES[positionRef.current] ?? "---.---" : "---.---";
  const activeFrequency = activeChat.kind === "console" ? "Console" : activeChat.frequency;

  return createPortal(
    <>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[45] h-[76px] bg-[#555c61] font-mono text-[9px] text-[#e8e8e8]">
        <div ref={logRef} data-pf24-keyboard-scroll-only="true" className="pointer-events-auto h-full overflow-y-auto px-[5px] py-[5px] leading-[12px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {messages.map((message) => activeChat.kind === "console" ? (
            <div key={message.id} className="whitespace-pre-wrap break-words text-[#e8e8e8]">{message.text}</div>
          ) : (
            <div key={message.id} className="whitespace-pre-wrap break-words text-[#e8e8e8]">
              <span>{formatFrequency(message, ownFrequency)}:</span><span> {message.text}</span>
            </div>
          ))}
        </div>
      </div>

      <div data-pf24-chat-tabs="true" className="absolute left-[8px] top-[-58px] z-[65] flex max-h-[56px] w-[170px] flex-col overflow-hidden font-mono text-[9px] leading-[14px] text-[#d8d8d8]">
        {state.chats.map((chat) => {
          const selected = state.active === chat.position;
          const unread = (state.unread[chat.position] ?? 0) > 0;
          const label = chat.kind === "console" ? "Console" : chat.frequency;
          return <button
            key={chat.position}
            type="button"
            onClick={() => { updateState((current) => ({ ...current, active: chat.position, unread: { ...current.unread, [chat.position]: 0 } })); }}
            onDoubleClick={(event) => { event.preventDefault(); removeChat(chat.position); }}
            onContextMenu={(event) => { event.preventDefault(); markRead(chat.position); }}
            className={`block h-[14px] w-full truncate text-left ${unread ? "text-[#00efff]" : selected ? "text-white" : "text-[#d8d8d8]"}`}
          >{label}</button>;
        })}
      </div>

      <div className="pointer-events-none absolute bottom-0 left-0 z-[64] h-[36px] w-[164px] font-mono text-[9px] text-[#111]">
        <div className="flex h-[36px] items-center justify-end pr-[6px]"><span className="whitespace-nowrap">on {activeFrequency}</span></div>
      </div>
    </>,
    footer,
  );
}
