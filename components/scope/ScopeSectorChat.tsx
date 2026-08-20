"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ATC_FREQUENCIES } from "@/lib/atcFrequencies";

type StoredConnection = { callsign?: string };
type ChatKind = "private" | "public" | "traffic" | "console";
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
const STORAGE_KEY = "pf24_scope_sector_chat_v6";
const CHANNEL_NAME = "scope-sector-private-chat-v4";
const MAX_MESSAGES = 200;
const MAX_PRIVATE_CHATS = 10;
const PUBLIC_CHAT_KEY = "__PF24_PUBLIC_FREQUENCY__";
const CONSOLE_CHAT_KEY = "__PF24_CONSOLE__";
const FREQUENCY_RE = /^\d{3}\.\d{3}$/;
const ATC_CALLSIGN_RE = /^[A-Z0-9]+(?:_[A-Z0-9]+)+$/;
const TRAFFIC_CALLSIGN_RE = /^[A-Z0-9]{2,12}$/;

const CONSOLE_CHAT: ChatRef = { position: CONSOLE_CHAT_KEY, frequency: "Console", kind: "console", fixed: true };
const HELP_LINES = [".metar [ICAO]", ".atis [ICAO]", ".chat [FRECUENCIA/CALLSIGN]"];

function normalize(value?: string | null) { return value?.trim().toUpperCase() ?? ""; }
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
function storageKey(position: string) { return position || "__DISCONNECTED__"; }
function loadAll(): Record<string, ChatState> {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, ChatState> : {};
  } catch { return {}; }
}
function saveState(position: string, state: ChatState) {
  try {
    const all = loadAll();
    all[storageKey(position)] = state;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {}
}
function normalizeChat(chat: Partial<ChatRef>): ChatRef | null {
  const position = normalize(chat.position);
  const frequency = typeof chat.frequency === "string" ? chat.frequency.trim() : "";
  if (position === CONSOLE_CHAT_KEY) return CONSOLE_CHAT;
  if (position === PUBLIC_CHAT_KEY && FREQUENCY_RE.test(frequency)) return { position, frequency, kind: "public", fixed: true };
  if (ATC_CALLSIGN_RE.test(position) && FREQUENCY_RE.test(frequency) && ATC_FREQUENCIES[position]) return { position, frequency, kind: "private", fixed: false };
  if (TRAFFIC_CALLSIGN_RE.test(position) && !position.includes("_") && !ATC_FREQUENCIES[position]) return { position, frequency: position, kind: "traffic", fixed: false };
  return null;
}
function defaultConsoleHistory() {
  return [systemMessage("Bienvenido a PFScope."), systemMessage("Ejecuta el comando .ayuda para ver la lista de comandos")];
}
function sanitizeState(value: ChatState | undefined, position: string): ChatState {
  const ownFrequency = position ? ATC_FREQUENCIES[position] ?? "" : "";
  const storedChats = Array.isArray(value?.chats) ? value!.chats.map(normalizeChat).filter((chat): chat is ChatRef => Boolean(chat)) : [];
  const movable = storedChats.filter((chat) => chat.kind === "private" || chat.kind === "traffic").slice(0, MAX_PRIVATE_CHATS);
  const fixed: ChatRef[] = ownFrequency ? [{ position: PUBLIC_CHAT_KEY, frequency: ownFrequency, kind: "public", fixed: true }, CONSOLE_CHAT] : [CONSOLE_CHAT];
  const chats = [...movable, ...fixed];
  const history = value?.history && typeof value.history === "object" ? { ...value.history } : {};
  if (!history[CONSOLE_CHAT_KEY]?.length) history[CONSOLE_CHAT_KEY] = defaultConsoleHistory();
  const unreadSource = value?.unread && typeof value.unread === "object" ? value.unread : {};
  const activeCandidate = normalize(value?.active);
  return {
    chats,
    active: chats.some((chat) => chat.position === activeCandidate) ? activeCandidate : CONSOLE_CHAT_KEY,
    history,
    unread: Object.fromEntries(chats.map((chat) => [chat.position, Math.max(0, Number(unreadSource[chat.position] ?? 0) || 0)])),
  };
}
function loadState(position: string) { return sanitizeState(loadAll()[storageKey(position)], position); }
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
  if (!ATC_CALLSIGN_RE.test(position) || !FREQUENCY_RE.test(frequency) || !ATC_FREQUENCIES[position]) return null;
  return { position, frequency, frequencySpan: spans[1] };
}
function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}
function formatSource(message: ChatMessage, ownFrequency: string) {
  if (message.from === PUBLIC_CHAT_KEY) return ownFrequency || "---.---";
  return ATC_FREQUENCIES[normalize(message.from)] ?? normalize(message.from) ?? ownFrequency;
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
  const updateState = useCallback((updater: (current: ChatState) => ChatState) => replaceState(updater(stateRef.current)), [replaceState]);
  const appendConsole = useCallback((lines: string | string[]) => {
    const items = (Array.isArray(lines) ? lines : [lines]).map(systemMessage);
    updateState((current) => ({
      ...current,
      history: { ...current.history, [CONSOLE_CHAT_KEY]: [...(current.history[CONSOLE_CHAT_KEY] ?? []), ...items].slice(-MAX_MESSAGES) },
    }));
  }, [updateState]);
  const sendBroadcast = useCallback((message: ChatMessage) => {
    if (!channelRef.current || !subscribedRef.current) { pendingRef.current.push(message); return; }
    void channelRef.current.send({ type: "broadcast", event: "message", payload: { ...message, kind: "sector-chat" } satisfies ChatPayload });
  }, []);

  const openAtcChat = useCallback((targetPosition: string, frequency: string) => {
    const remote = normalize(targetPosition);
    const me = positionRef.current;
    if (!me || !remote || remote === me || !ATC_FREQUENCIES[remote] || !FREQUENCY_RE.test(frequency)) return false;
    updateState((current) => {
      const chat: ChatRef = { position: remote, frequency, kind: "private", fixed: false };
      const movable = [chat, ...current.chats.filter((item) => (item.kind === "private" || item.kind === "traffic") && item.position !== remote)].slice(0, MAX_PRIVATE_CHATS);
      const fixed = current.chats.filter((item) => item.kind === "public" || item.kind === "console");
      return { ...current, chats: [...movable, ...fixed], active: remote, unread: { ...current.unread, [remote]: 0 } };
    });
    return true;
  }, [updateState]);

  const openTrafficChat = useCallback((callsign: string) => {
    const remote = normalize(callsign);
    if (!positionRef.current || !TRAFFIC_CALLSIGN_RE.test(remote) || remote.includes("_") || ATC_FREQUENCIES[remote]) return false;
    updateState((current) => {
      const chat: ChatRef = { position: remote, frequency: remote, kind: "traffic", fixed: false };
      const movable = [chat, ...current.chats.filter((item) => (item.kind === "private" || item.kind === "traffic") && item.position !== remote)].slice(0, MAX_PRIVATE_CHATS);
      const fixed = current.chats.filter((item) => item.kind === "public" || item.kind === "console");
      return { ...current, chats: [...movable, ...fixed], active: remote, unread: { ...current.unread, [remote]: 0 } };
    });
    return true;
  }, [updateState]);

  const executeConsole = useCallback(async (raw: string) => {
    const [commandRaw, argumentRaw] = raw.trim().split(/\s+/, 2);
    const command = commandRaw.toLowerCase();
    const argument = normalize(argumentRaw);

    if (command === ".ayuda") {
      appendConsole(HELP_LINES);
      return;
    }
    if (command === ".metar") {
      if (!/^[A-Z0-9]{4}$/.test(argument)) { appendConsole("Uso: .metar [ICAO]"); return; }
      try {
        const response = await fetch(`/api/scope/metar?station=${encodeURIComponent(argument)}`, { cache: "no-store" });
        const data = await response.json() as { raw?: string | null };
        appendConsole(response.ok && data.raw ? data.raw : `METAR no disponible para ${argument}`);
      } catch { appendConsole(`METAR no disponible para ${argument}`); }
      return;
    }
    if (command === ".atis") {
      if (!/^[A-Z0-9]{4}$/.test(argument)) { appendConsole("Uso: .atis [ICAO]"); return; }
      const { data, error } = await supabase
        .from("atis_messages")
        .select("full_text,created_at")
        .eq("airport_icao", argument)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      appendConsole(!error && data?.full_text ? String(data.full_text) : "Sin ATIS activo");
      return;
    }
    if (command === ".chat") {
      if (!argument) { appendConsole("Uso: .chat [FRECUENCIA/CALLSIGN]"); return; }
      if (FREQUENCY_RE.test(argument)) {
        const target = Object.entries(ATC_FREQUENCIES).find(([, frequency]) => frequency === argument)?.[0];
        if (!target || !openAtcChat(target, argument)) appendConsole(`No hay ATC activo para ${argument}`);
        return;
      }
      if (!openTrafficChat(argument)) appendConsole(`No se pudo abrir chat con ${argument}`);
      return;
    }
    appendConsole(`Comando desconocido: ${commandRaw}`);
  }, [appendConsole, openAtcChat, openTrafficChat]);

  const sendCurrent = useCallback((raw: string) => {
    const text = raw.trim().slice(0, 500);
    const chatId = stateRef.current.active;
    const chat = stateRef.current.chats.find((item) => item.position === chatId);
    if (!text || !chat) return false;
    if (chat.kind === "console") { void executeConsole(text); return true; }
    const me = positionRef.current;
    if (!me) return false;
    const message: ChatMessage = { id: messageId(), from: me, to: chat.position, text, sentAt: Date.now() };
    updateState((current) => ({ ...current, history: { ...current.history, [chat.position]: [...(current.history[chat.position] ?? []), message].slice(-MAX_MESSAGES) } }));
    if (chat.kind === "private" || chat.kind === "traffic") sendBroadcast(message);
    return true;
  }, [executeConsole, sendBroadcast, updateState]);

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

  useEffect(() => {
    const initial = readPosition();
    positionRef.current = initial;
    const loaded = loadState(initial);
    stateRef.current = loaded; setState(loaded); setFooter(findFooter());

    const onConnection = (event: Event) => {
      const detail = (event as CustomEvent<{ connected?: boolean; callsign?: string }>).detail;
      saveState(positionRef.current, stateRef.current);
      const previous = positionRef.current;
      const next = detail?.connected ? normalize(detail.callsign) || readPosition() : "";
      positionRef.current = next; pendingRef.current = [];
      const loadedNext = loadState(next);
      loadedNext.history[CONSOLE_CHAT_KEY] = [
        ...(loadedNext.history[CONSOLE_CHAT_KEY] ?? defaultConsoleHistory()),
        systemMessage(next ? `Te haz conectado en ${next}.` : "Te haz desconectado"),
      ].slice(-MAX_MESSAGES);
      loadedNext.active = CONSOLE_CHAT_KEY;
      stateRef.current = loadedNext; setState(loadedNext); saveState(next, loadedNext); setFooter(findFooter());
      if (!next && previous) saveState("", loadedNext);
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
          const knownAtc = Boolean(ATC_FREQUENCIES[from]);
          const chat: ChatRef = knownAtc
            ? { position: from, frequency: ATC_FREQUENCIES[from], kind: "private", fixed: false }
            : { position: from, frequency: from, kind: "traffic", fixed: false };
          const movable = [chat, ...current.chats.filter((item) => (item.kind === "private" || item.kind === "traffic") && item.position !== from)].slice(0, MAX_PRIVATE_CHATS);
          const fixed = current.chats.filter((item) => item.kind === "public" || item.kind === "console");
          const history = current.history[from] ?? [];
          if (history.some((item) => item.id === incoming.id)) return current;
          return {
            ...current,
            chats: [...movable, ...fixed],
            history: { ...current.history, [from]: [...history, incoming].slice(-MAX_MESSAGES) },
            unread: { ...current.unread, [from]: current.active === from ? 0 : (current.unread[from] ?? 0) + 1 },
          };
        });
      }).subscribe((status) => {
        subscribedRef.current = status === "SUBSCRIBED";
        if (status === "SUBSCRIBED" && pendingRef.current.length) pendingRef.current.splice(0).forEach(sendBroadcast);
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
      event.preventDefault(); event.stopImmediatePropagation(); openAtcChat(parsed.position, parsed.frequency);
      window.setTimeout(() => findFooter()?.querySelector<HTMLInputElement>("input")?.focus(), 0);
    };
    document.addEventListener("dblclick", onDoubleClick, true);
    return () => document.removeEventListener("dblclick", onDoubleClick, true);
  }, [openAtcChat]);

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
  const activeLabel = activeChat.kind === "console" ? "Console" : activeChat.kind === "traffic" ? activeChat.position : activeChat.frequency;

  return createPortal(
    <>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[45] h-[76px] bg-[#555c61] font-mono text-[9px] text-[#e8e8e8]">
        <div ref={logRef} data-pf24-keyboard-scroll-only="true" className="pointer-events-auto h-full overflow-y-auto px-[5px] py-[5px] leading-[12px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {messages.map((message) => activeChat.kind === "console" ? (
            <div key={message.id} className="whitespace-pre-wrap break-words text-[#e8e8e8]">{message.text}</div>
          ) : (
            <div key={message.id} className="whitespace-pre-wrap break-words text-[#e8e8e8]"><span>{formatSource(message, ownFrequency)}:</span><span> {message.text}</span></div>
          ))}
        </div>
      </div>

      <div data-pf24-chat-tabs="true" className="absolute left-[8px] top-[-58px] z-[65] flex max-h-[56px] w-[170px] flex-col overflow-hidden font-mono text-[9px] leading-[14px] text-[#d8d8d8]">
        {state.chats.map((chat) => {
          const selected = state.active === chat.position;
          const unread = (state.unread[chat.position] ?? 0) > 0;
          const label = chat.kind === "console" ? "Console" : chat.kind === "traffic" ? chat.position : chat.frequency;
          return <button
            key={chat.position}
            type="button"
            onClick={() => updateState((current) => ({ ...current, active: chat.position, unread: { ...current.unread, [chat.position]: 0 } }))}
            onDoubleClick={(event) => { event.preventDefault(); removeChat(chat.position); }}
            onContextMenu={(event) => { event.preventDefault(); updateState((current) => ({ ...current, unread: { ...current.unread, [chat.position]: 0 } })); }}
            className={`block h-[14px] w-full truncate text-left ${unread ? "text-[#00efff]" : selected ? "text-white" : "text-[#d8d8d8]"}`}
          >{label}</button>;
        })}
      </div>

      <div className="pointer-events-none absolute bottom-0 left-0 z-[64] h-[36px] w-[164px] font-mono text-[9px] text-[#111]">
        <div className="flex h-[36px] items-center justify-end pr-[6px]"><span className="whitespace-nowrap">on {activeLabel}</span></div>
      </div>
    </>,
    footer,
  );
}
