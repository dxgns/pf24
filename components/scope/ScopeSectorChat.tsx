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
  histories: Record<string, ChatMessage[]>;
  unread: Record<string, number>;
};

type ChatPayload = ChatMessage & { kind: "sector-chat" };

const CONNECTION_KEY = "pf24_scope_connection_session_v1";
const STORAGE_KEY = "pf24_scope_sector_chat_v1";
const CHANNEL_NAME = "scope-sector-private-chat-v1";
const MAX_MESSAGES_PER_CHAT = 200;

function emptyState(): ChatState {
  return { chats: [], active: null, histories: {}, unread: {} };
}

function readPosition() {
  try {
    const stored = JSON.parse(sessionStorage.getItem(CONNECTION_KEY) ?? "null") as StoredConnection | null;
    return stored?.callsign?.trim().toUpperCase() ?? "";
  } catch {
    return "";
  }
}

function readAllStored(): Record<string, ChatState> {
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
      .filter((chat) => chat && typeof chat.position === "string" && typeof chat.frequency === "string")
      .map((chat) => ({ position: chat.position.trim().toUpperCase(), frequency: chat.frequency.trim() }))
      .filter((chat) => chat.position && chat.frequency)
    : [];
  const histories = value.histories && typeof value.histories === "object" ? value.histories : {};
  const unread = value.unread && typeof value.unread === "object" ? value.unread : {};
  const active = typeof value.active === "string" && chats.some((chat) => chat.position === value.active)
    ? value.active
    : null;
  return { chats, active, histories, unread };
}

function loadState(position: string) {
  if (!position) return emptyState();
  return sanitizeState(readAllStored()[position]);
}

function persistState(position: string, state: ChatState) {
  if (!position) return;
  const all = readAllStored();
  all[position] = state;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

function findFooter() {
  return document.querySelector<HTMLElement>("main.fixed footer");
}

function findFreqWindow() {
  return Array.from(document.querySelectorAll<HTMLElement>("main.fixed > section > div.absolute.z-30"))
    .find((element) => element.firstElementChild?.textContent?.trim().toUpperCase().includes("FREQ")) ?? null;
}

function controlledInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function messageTime(timestamp: number) {
  const date = new Date(timestamp);
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  const s = String(date.getSeconds()).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function newId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `chat-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function ScopeSectorChat() {
  const [footer, setFooter] = useState<HTMLElement | null>(null);
  const [state, setState] = useState<ChatState>(() => emptyState());
  const stateRef = useRef<ChatState>(emptyState());
  const positionRef = useRef("");
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const subscribedRef = useRef(false);
  const logRef = useRef<HTMLDivElement | null>(null);

  const replaceState = useCallback((next: ChatState, persist = true) => {
    stateRef.current = next;
    setState(next);
    if (persist) persistState(positionRef.current, next);
  }, []);

  const updateState = useCallback((updater: (current: ChatState) => ChatState) => {
    replaceState(updater(stateRef.current));
  }, [replaceState]);

  const openChat = useCallback((targetPosition: string, frequency: string) => {
    const remote = targetPosition.trim().toUpperCase();
    const freq = frequency.trim();
    const here = positionRef.current;
    if (!here || !remote || remote === here || !freq || freq === "---.---") return;
    updateState((current) => {
      const exists = current.chats.some((chat) => chat.position === remote);
      const chats = exists
        ? current.chats.map((chat) => chat.position === remote ? { ...chat, frequency: freq } : chat)
        : [...current.chats, { position: remote, frequency: freq }];
      return {
        ...current,
        chats,
        active: remote,
        unread: { ...current.unread, [remote]: 0 },
      };
    });
  }, [updateState]);

  const sendCurrent = useCallback((raw: string) => {
    const here = positionRef.current;
    const current = stateRef.current;
    const remote = current.active;
    const text = raw.trim().slice(0, 500);
    if (!here || !remote || !text) return false;

    const message: ChatMessage = { id: newId(), from: here, to: remote, text, sentAt: Date.now() };
    updateState((value) => ({
      ...value,
      histories: {
        ...value.histories,
        [remote]: [...(value.histories[remote] ?? []), message].slice(-MAX_MESSAGES_PER_CHAT),
      },
    }));

    const channel = channelRef.current;
    if (channel && subscribedRef.current) {
      void channel.send({
        type: "broadcast",
        event: "message",
        payload: { ...message, kind: "sector-chat" } satisfies ChatPayload,
      }).then((result) => {
        if (result !== "ok") console.error("PF24 Scope sector chat send failed:", result);
      }).catch((error) => console.error("PF24 Scope sector chat send failed:", error));
    }
    return true;
  }, [updateState]);

  useEffect(() => {
    const initial = readPosition();
    positionRef.current = initial;
    const loaded = loadState(initial);
    stateRef.current = loaded;
    setState(loaded);
    setFooter(findFooter());

    const onConnection = (event: Event) => {
      const detail = (event as CustomEvent<{ connected?: boolean; callsign?: string }>).detail;
      const previous = positionRef.current;
      if (previous) persistState(previous, stateRef.current);
      const next = detail?.connected ? (detail.callsign?.trim().toUpperCase() || readPosition()) : "";
      positionRef.current = next;
      const loadedNext = loadState(next);
      stateRef.current = loadedNext;
      setState(loadedNext);
      setFooter(findFooter());
    };

    const locate = window.setInterval(() => {
      const next = findFooter();
      setFooter((current) => current === next ? current : next);
    }, 500);

    window.addEventListener("pf24-scope-connection-change", onConnection);
    return () => {
      if (positionRef.current) persistState(positionRef.current, stateRef.current);
      window.clearInterval(locate);
      window.removeEventListener("pf24-scope-connection-change", onConnection);
    };
  }, []);

  useEffect(() => {
    const channel = supabase.channel(CHANNEL_NAME, { config: { broadcast: { self: false } } });
    channelRef.current = channel;
    channel.on("broadcast", { event: "message" }, ({ payload }) => {
      const message = payload as ChatPayload;
      const here = positionRef.current;
      if (!here || !message || message.kind !== "sector-chat" || message.to !== here || message.from === here) return;
      const remote = message.from.trim().toUpperCase();
      if (!remote || !message.id || !message.text) return;

      updateState((current) => {
        const history = current.histories[remote] ?? [];
        if (history.some((item) => item.id === message.id)) return current;
        const frequency = ATC_FREQUENCIES[remote] ?? "---.---";
        const chats = current.chats.some((chat) => chat.position === remote)
          ? current.chats.map((chat) => chat.position === remote ? { ...chat, frequency } : chat)
          : [...current.chats, { position: remote, frequency }];
        const isReadNow = current.active === remote && document.visibilityState === "visible";
        return {
          ...current,
          chats,
          histories: {
            ...current.histories,
            [remote]: [...history, message].slice(-MAX_MESSAGES_PER_CHAT),
          },
          unread: {
            ...current.unread,
            [remote]: isReadNow ? 0 : (current.unread[remote] ?? 0) + 1,
          },
        };
      });
    }).subscribe((status) => {
      subscribedRef.current = status === "SUBSCRIBED";
    });

    return () => {
      subscribedRef.current = false;
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [updateState]);

  useEffect(() => {
    const onDoubleClick = (event: MouseEvent) => {
      if (event.button !== 0) return;
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      const win = target.closest<HTMLElement>("main.fixed > section > div.absolute.z-30");
      if (!win || !win.firstElementChild?.textContent?.trim().toUpperCase().includes("FREQ")) return;
      const row = target.closest<HTMLElement>("div.flex.whitespace-nowrap");
      if (!row) return;
      const spans = Array.from(row.querySelectorAll<HTMLSpanElement>(":scope > span"));
      if (spans.length < 2 || !spans[1].contains(target)) return;
      const remote = spans[0].textContent?.trim().toUpperCase() ?? "";
      const frequency = spans[1].textContent?.trim() ?? "";
      if (!remote || !frequency) return;
      event.preventDefault();
      event.stopPropagation();
      openChat(remote, frequency);
      const input = findFooter()?.querySelector<HTMLInputElement>("input");
      input?.focus();
    };

    document.addEventListener("dblclick", onDoubleClick, true);
    return () => document.removeEventListener("dblclick", onDoubleClick, true);
  }, [openChat]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const input = event.target instanceof HTMLInputElement ? event.target : null;
      if (!input || !input.closest("main.fixed footer") || !stateRef.current.active) return;

      if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        event.preventDefault();
        event.stopPropagation();
        const direction = event.key === "ArrowUp" ? -1 : 1;
        logRef.current?.scrollBy({ top: direction * 28, behavior: "auto" });
        return;
      }

      if (event.key !== "Enter" || event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return;
      const value = input.value;
      if (!value.trim()) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      if (sendCurrent(value)) controlledInputValue(input, "");
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
      const win = findFreqWindow();
      if (!win) return;
      const unread = stateRef.current.unread;
      win.querySelectorAll<HTMLElement>("div.flex.whitespace-nowrap").forEach((row) => {
        const spans = Array.from(row.querySelectorAll<HTMLSpanElement>(":scope > span"));
        if (spans.length < 2) return;
        const remote = spans[0].textContent?.trim().toUpperCase() ?? "";
        const hasUnread = (unread[remote] ?? 0) > 0;
        spans[1].style.setProperty("color", hasUnread ? "#00efff" : "", hasUnread ? "important" : "");
        if (hasUnread) row.dataset.pf24ChatUnread = "true";
        else delete row.dataset.pf24ChatUnread;
      });
    };
    syncUnread();
    const timer = window.setInterval(syncUnread, 500);
    return () => window.clearInterval(timer);
  }, [state.unread]);

  useEffect(() => {
    const active = state.active;
    if (!active) return;
    window.requestAnimationFrame(() => {
      if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
    });
  }, [state.active, state.histories]);

  if (!footer) return null;

  const active = state.active;
  const messages = active ? state.histories[active] ?? [] : [];

  return createPortal(<>
    {active && <div className="pointer-events-none absolute inset-x-0 top-0 z-[45] h-[76px] bg-[#555c61] font-mono text-[9px] text-[#e8e8e8]">
      <div ref={logRef} className="pointer-events-auto h-full overflow-y-auto px-[5px] py-[5px] leading-[12px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {messages.map((message) => <div key={message.id} className="whitespace-pre-wrap break-words">
          <span className="text-[#bfc8c6]">{messageTime(message.sentAt)} </span>
          <span className={message.from === positionRef.current ? "text-[#e8e8e8]" : "text-[#00efff]"}>{message.from}</span>
          <span>: {message.text}</span>
        </div>)}
      </div>
    </div>}

    {state.chats.length > 0 && <div className="absolute bottom-[9px] left-[4px] z-[65] flex h-[18px] w-[198px] items-center gap-[3px] overflow-x-auto overflow-y-hidden whitespace-nowrap font-mono text-[9px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {state.chats.map((chat) => {
        const selected = state.active === chat.position;
        const unread = (state.unread[chat.position] ?? 0) > 0;
        return <button
          key={chat.position}
          type="button"
          title={`${chat.position} · doble click para eliminar chat`}
          onClick={() => updateState((current) => ({ ...current, active: chat.position, unread: { ...current.unread, [chat.position]: 0 } }))}
          onDoubleClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            updateState((current) => {
              const chats = current.chats.filter((item) => item.position !== chat.position);
              const histories = { ...current.histories };
              const unreadMap = { ...current.unread };
              delete histories[chat.position];
              delete unreadMap[chat.position];
              const nextActive = current.active === chat.position ? (chats[0]?.position ?? null) : current.active;
              return { ...current, chats, histories, unread: unreadMap, active: nextActive };
            });
          }}
          className={`h-[18px] shrink-0 border-0 bg-transparent px-[2px] leading-[18px] ${unread ? "text-[#00efff]" : selected ? "text-[#111] underline" : "text-[#333]"}`}
        >{chat.frequency}</button>;
      })}
    </div>}
  </>, footer);
}
