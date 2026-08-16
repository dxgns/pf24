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
import {
  AtisSpeechData,
  buildEnglishAtisSpeech,
  buildSpanishAtisSpeech,
} from "./pronunciation.js";

type AtisRow = AtisSpeechData & {
  id: string;
  created_at?: string;
};

type AudioSet = {
  atisId: string;
  spanishPath: string;
  englishPath: string;
  infoLetter: string;
};

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
  spanishVoice: process.env.ATIS_VOICE_ES ?? "es-US-AlonsoNeural",
  englishVoice: process.env.ATIS_VOICE_EN ?? "en-US-GuyNeural",
  languageGapMs: Number(process.env.ATIS_LANGUAGE_GAP_MS ?? "2000"),
  loopDelayMs: Number(process.env.ATIS_LOOP_DELAY_MS ?? "4000"),
};

const discord = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const player = createAudioPlayer({
  behaviors: { noSubscriber: NoSubscriberBehavior.Pause },
});

const audioDir = join(tmpdir(), "pf24-atis-01");
let voiceConnection: VoiceConnection | null = null;
let currentAudio: AudioSet | null = null;
let currentAtisId: string | null = null;
let pendingAudio: AudioSet | null = null;
let phase: "idle" | "spanish" | "english" = "idle";
let timer: NodeJS.Timeout | null = null;
let synthesisVersion = 0;

function clearTimer() {
  if (timer) clearTimeout(timer);
  timer = null;
}

async function ensureVoiceConnection() {
  if (voiceConnection && voiceConnection.state.status !== VoiceConnectionStatus.Destroyed) {
    return voiceConnection;
  }

  const guild = await discord.guilds.fetch(config.guildId);
  const channel = await guild.channels.fetch(config.channelId);

  if (!channel?.isVoiceBased()) {
    throw new Error(`El canal ${config.channelId} no es un canal de voz.`);
  }

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
      console.error("[ATIS 01] Conexión de voz perdida; se cerrará y reconectará si sigue existiendo ATIS.");
      if (voiceConnection === connection) voiceConnection = null;
      connection.destroy();
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
    try {
      voiceConnection.destroy();
    } catch {
      // La conexión puede haber sido destruida por Discord previamente.
    }
  }
  voiceConnection = null;
  console.log(`[ATIS 01] Sin ATIS activo para ${config.airport}; fuera del VC.`);
}

function playSpanish(delay = 0) {
  clearTimer();
  timer = setTimeout(async () => {
    if (!currentAudio || !currentAtisId || currentAudio.atisId !== currentAtisId) return;
    try {
      await ensureVoiceConnection();
      phase = "spanish";
      player.play(createAudioResource(currentAudio.spanishPath));
      console.log(`[ATIS 01] ${config.airport} INFO ${currentAudio.infoLetter}: español.`);
    } catch (error) {
      console.error("[ATIS 01] No se pudo iniciar la emisión en español:", error);
    }
  }, delay);
}

function playEnglish(delay = config.languageGapMs) {
  clearTimer();
  timer = setTimeout(() => {
    if (!currentAudio || !currentAtisId || currentAudio.atisId !== currentAtisId) return;
    phase = "english";
    player.play(createAudioResource(currentAudio.englishPath));
    console.log(`[ATIS 01] ${config.airport} INFO ${currentAudio.infoLetter}: English.`);
  }, delay);
}

async function synthesize(text: string, voice: string, filename: string) {
  const tts = new EdgeTTS();
  await tts.synthesize(text, voice, {
    rate: "-8%",
    pitch: "-3Hz",
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

  const [spanishPath, englishPath] = await Promise.all([
    synthesize(spanish, config.spanishVoice, `${config.airport}-${row.info_letter}-${stamp}-es`),
    synthesize(english, config.englishVoice, `${config.airport}-${row.info_letter}-${stamp}-en`),
  ]);

  if (version !== synthesisVersion || currentAtisId !== row.id) return;

  const prepared: AudioSet = {
    atisId: row.id,
    spanishPath,
    englishPath,
    infoLetter: row.info_letter,
  };

  if (phase === "idle" || !currentAudio) {
    currentAudio = prepared;
    await ensureVoiceConnection();
    playSpanish(250);
  } else {
    pendingAudio = prepared;
    console.log(`[ATIS 01] Nuevo ATIS preparado; se aplicará al terminar el ciclo bilingüe actual.`);
  }
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
    currentAtisId = null;
    currentAudio = null;
    pendingAudio = null;
    disconnectVoice();
    return;
  }

  currentAtisId = data.id;
  await prepareAtis(data);
}

async function handleInsert(row: AtisRow) {
  if (row.airport_icao !== config.airport) return;
  currentAtisId = row.id;
  pendingAudio = null;
  console.log(`[ATIS 01] ATIS publicado: ${row.airport_icao} INFO ${row.info_letter}.`);
  await prepareAtis(row);
}

function handleDelete(oldRow: Partial<AtisRow>) {
  if (!oldRow.id || oldRow.id !== currentAtisId) return;
  console.log(`[ATIS 01] El ATIS activo ${currentAtisId} fue eliminado en PF24.`);
  synthesisVersion++;
  currentAtisId = null;
  currentAudio = null;
  pendingAudio = null;
  disconnectVoice();
}

function subscribeToAtis() {
  return supabase
    .channel(`atis-voice-${config.airport}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "atis_messages" },
      (payload) => {
        handleInsert(payload.new as AtisRow).catch((error) =>
          console.error("[ATIS 01] Error procesando nuevo ATIS:", error),
        );
      },
    )
    .on(
      "postgres_changes",
      { event: "DELETE", schema: "public", table: "atis_messages" },
      (payload) => handleDelete(payload.old as Partial<AtisRow>),
    )
    .subscribe((status) => console.log(`[ATIS 01] Supabase Realtime: ${status}`));
}

player.on(AudioPlayerStatus.Idle, () => {
  if (!currentAtisId || !currentAudio) return;

  if (phase === "spanish") {
    playEnglish();
    return;
  }

  if (phase === "english") {
    phase = "idle";
    if (pendingAudio && pendingAudio.atisId === currentAtisId) {
      currentAudio = pendingAudio;
      pendingAudio = null;
    }
    playSpanish(config.loopDelayMs);
  }
});

player.on("error", (error) => {
  console.error("[ATIS 01] Error reproduciendo audio:", error);
  if (currentAtisId && currentAudio) playSpanish(1500);
});

discord.once("ready", async () => {
  try {
    await mkdir(audioDir, { recursive: true });
    console.log(`[ATIS 01] Discord listo. Esperando ATIS activo de ${config.airport}.`);
    subscribeToAtis();
    await loadLatestAtis();
  } catch (error) {
    console.error("[ATIS 01] Error de inicio:", error);
    process.exitCode = 1;
    discord.destroy();
  }
});

process.on("SIGTERM", () => {
  disconnectVoice();
  discord.destroy();
});
process.on("SIGINT", () => {
  disconnectVoice();
  discord.destroy();
});

discord.login(config.token);
