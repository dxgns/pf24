import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EdgeTTS, Constants } from "@andresaya/edge-tts";
import { createClient } from "@supabase/supabase-js";
import {
  AudioPlayerStatus,
  NoSubscriberBehavior,
  VoiceConnection,
  VoiceConnectionStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  joinVoiceChannel,
} from "@discordjs/voice";
import { Client, GatewayIntentBits } from "discord.js";
import { AtisSpeechData, buildEnglishAtisSpeech, buildSpanishAtisSpeech } from "./pronunciation.js";

type AtisRow = AtisSpeechData & { id: string; created_at?: string };
type AudioSet = { atisId: string; spanishPath: string; englishPath: string; infoLetter: string };
type Phase = "idle" | "spanish" | "english";

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la variable de entorno ${name}`);
  return value;
}

const config = {
  token: process.env.ATIS_01_TOKEN ?? required("DISCORD_TOKEN"),
  guildId: process.env.DISCORD_GUILD_ID ?? "1427074541917700209",
  channelId: process.env.DISCORD_VOICE_CHANNEL_ID ?? "1538401211450130503",
  airport: (process.env.ATIS_AIRPORT ?? "MDPC").toUpperCase(),
  supabaseUrl: required("SUPABASE_URL"),
  supabaseAnonKey: required("SUPABASE_ANON_KEY"),
  spanishVoice: process.env.ATIS_ROBOT_VOICE_ES ?? "es-ES-AlvaroNeural",
  englishVoice: process.env.ATIS_ROBOT_VOICE_EN ?? "en-US-ChristopherNeural",
  languageGapMs: Number(process.env.ATIS_LANGUAGE_GAP_MS ?? "2000"),
  loopDelayMs: Number(process.env.ATIS_LOOP_DELAY_MS ?? "4000"),
};

const discord = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });
const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Pause } });
const audioDir = join(tmpdir(), "pf24-atis-01");

let voiceConnection: VoiceConnection | null = null;
let currentAudio: AudioSet | null = null; // audio que está sonando en este ciclo
let pendingAudio: AudioSet | null = null; // nuevo ATIS listo para el próximo ciclo
let latestAtisId: string | null = null; // ATIS actualmente vigente en PF24
let phase: Phase = "idle";
let timer: NodeJS.Timeout | null = null;
let synthesisVersion = 0;

function clearTimer() {
  if (timer) clearTimeout(timer);
  timer = null;
}

async function ensureVoiceConnection() {
  if (voiceConnection && voiceConnection.state.status !== VoiceConnectionStatus.Destroyed) return voiceConnection;

  const guild = await discord.guilds.fetch(config.guildId);
  const channel = await guild.channels.fetch(config.channelId);
  if (!channel?.isVoiceBased()) throw new Error(`El canal ${config.channelId} no es un canal de voz.`);

  const connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: guild.id,
    adapterCreator: guild.voiceAdapterCreator,
    selfDeaf: true,
    selfMute: false,
  });
  connection.subscribe(player);
  voiceConnection = connection;

  connection.on(VoiceConnectionStatus.Disconnected, async () => {
    try {
      await Promise.race([
        entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
        entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
      ]);
    } catch {
      if (voiceConnection === connection) voiceConnection = null;
      try { connection.destroy(); } catch {}
      console.error("[ATIS 01] Conexión de voz perdida.");
    }
  });

  await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
  console.log(`[ATIS 01] Conectado al VC para emitir ${config.airport}.`);
  return connection;
}

function disconnectVoice() {
  clearTimer();
  player.stop(true);
  phase = "idle";
  if (voiceConnection) {
    try { voiceConnection.destroy(); } catch {}
  }
  voiceConnection = null;
  console.log(`[ATIS 01] Sin ATIS activo para ${config.airport}; fuera del VC.`);
}

function playSpanish(delay = 0) {
  clearTimer();
  timer = setTimeout(async () => {
    if (!latestAtisId || !currentAudio) return;
    try {
      await ensureVoiceConnection();
      phase = "spanish";
      player.play(createAudioResource(currentAudio.spanishPath));
      console.log(`[ATIS 01] ${config.airport} INFO ${currentAudio.infoLetter}: español.`);
    } catch (error) {
      console.error("[ATIS 01] No se pudo iniciar español:", error);
    }
  }, delay);
}

function playEnglish(delay = config.languageGapMs) {
  clearTimer();
  timer = setTimeout(() => {
    if (!latestAtisId || !currentAudio) return;
    phase = "english";
    player.play(createAudioResource(currentAudio.englishPath));
    console.log(`[ATIS 01] ${config.airport} INFO ${currentAudio.infoLetter}: English.`);
  }, delay);
}

async function synthesize(text: string, voice: string, filename: string) {
  const tts = new EdgeTTS();
  await tts.synthesize(text, voice, {
    rate: "-2%",
    pitch: "-10Hz",
    volume: "0%",
    outputFormat: Constants.OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3,
  });
  return tts.toFile(join(audioDir, filename));
}

async function prepareAtis(row: AtisRow) {
  const version = ++synthesisVersion;
  const stamp = Date.now();
  const spanish = buildSpanishAtisSpeech(row);
  const english = buildEnglishAtisSpeech(row);

  console.log(`[ATIS 01] Sintetizando INFO ${row.info_letter}...`);
  const [spanishPath, englishPath] = await Promise.all([
    synthesize(spanish, config.spanishVoice, `${config.airport}-${row.info_letter}-${stamp}-es`),
    synthesize(english, config.englishVoice, `${config.airport}-${row.info_letter}-${stamp}-en`),
  ]);

  // Si apareció otro ATIS mientras se sintetizaba este, descartamos el anterior.
  if (version !== synthesisVersion || latestAtisId !== row.id) return;

  const prepared: AudioSet = {
    atisId: row.id,
    spanishPath,
    englishPath,
    infoLetter: row.info_letter,
  };

  if (!currentAudio || phase === "idle") {
    currentAudio = prepared;
    pendingAudio = null;
    await ensureVoiceConnection();
    playSpanish(250);
    return;
  }

  // No se interrumpe A. B espera hasta terminar español + inglés de A.
  pendingAudio = prepared;
  console.log(`[ATIS 01] INFO ${row.info_letter} preparada; cambiará al finalizar el ciclo actual.`);
}

async function loadLatestAtis() {
  const { data, error } = await supabase
    .from("atis_messages")
    .select("id, airport_icao, info_letter, metar, approach_primary, approach_optional, runway, extra_info, remarks, created_at")
    .eq("airport_icao", config.airport)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<AtisRow>();

  if (error) throw error;
  if (!data) {
    latestAtisId = null;
    currentAudio = null;
    pendingAudio = null;
    disconnectVoice();
    return;
  }

  latestAtisId = data.id;
  await prepareAtis(data);
}

async function handleInsert(row: AtisRow) {
  if (row.airport_icao !== config.airport) return;
  latestAtisId = row.id;
  pendingAudio = null;
  console.log(`[ATIS 01] Nuevo ATIS: ${row.airport_icao} INFO ${row.info_letter}.`);
  await prepareAtis(row);
}

function handleDelete(oldRow: Partial<AtisRow>) {
  if (!oldRow.id || oldRow.id !== latestAtisId) return;
  console.log(`[ATIS 01] ATIS activo ${oldRow.id} eliminado.`);
  synthesisVersion++;
  latestAtisId = null;
  currentAudio = null;
  pendingAudio = null;
  disconnectVoice();
}

function subscribeToAtis() {
  return supabase
    .channel(`atis-voice-${config.airport}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "atis_messages" }, (payload) => {
      handleInsert(payload.new as AtisRow).catch((error) => console.error("[ATIS 01] Error procesando INSERT:", error));
    })
    .on("postgres_changes", { event: "DELETE", schema: "public", table: "atis_messages" }, (payload) => {
      handleDelete(payload.old as Partial<AtisRow>);
    })
    .subscribe((status) => console.log(`[ATIS 01] Supabase Realtime: ${status}`));
}

player.on(AudioPlayerStatus.Idle, () => {
  if (!latestAtisId || !currentAudio) return;

  if (phase === "spanish") {
    playEnglish();
    return;
  }

  if (phase === "english") {
    phase = "idle";

    if (pendingAudio && pendingAudio.atisId === latestAtisId) {
      console.log(`[ATIS 01] Cambio a INFO ${pendingAudio.infoLetter}.`);
      currentAudio = pendingAudio;
      pendingAudio = null;
      playSpanish(500);
      return;
    }

    // Si el ATIS vigente cambió pero todavía no existe audio preparado, no repetimos el viejo.
    if (currentAudio.atisId !== latestAtisId) {
      console.log("[ATIS 01] Esperando audio del nuevo ATIS...");
      return;
    }

    playSpanish(config.loopDelayMs);
  }
});

player.on("error", (error) => {
  console.error("[ATIS 01] Error de audio:", error);
  if (latestAtisId && currentAudio) playSpanish(1500);
});

discord.once("ready", async () => {
  try {
    await mkdir(audioDir, { recursive: true });
    console.log(`[ATIS 01] Discord listo. Esperando ATIS de ${config.airport}.`);
    subscribeToAtis();
    await loadLatestAtis();
  } catch (error) {
    console.error("[ATIS 01] Error de inicio:", error);
    process.exitCode = 1;
    discord.destroy();
  }
});

function shutdown() {
  disconnectVoice();
  discord.destroy();
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

discord.login(config.token);
