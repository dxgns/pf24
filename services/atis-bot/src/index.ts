import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EdgeTTS, Constants } from "@andresaya/edge-tts";
import { createClient } from "@supabase/supabase-js";
import {
  AudioPlayerStatus,
  NoSubscriberBehavior,
  VoiceConnectionStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  joinVoiceChannel,
} from "@discordjs/voice";
import { Client, GatewayIntentBits } from "discord.js";
import { prepareAtisForSpeech } from "./pronunciation.js";

type AtisRow = {
  airport_icao: string;
  info_letter: string;
  full_text: string;
  created_at?: string;
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
  voice: process.env.ATIS_VOICE ?? "es-US-AlonsoNeural",
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
let currentAudioPath: string | null = null;
let currentlyPlayingPath: string | null = null;
let loopTimer: NodeJS.Timeout | null = null;
let synthesisVersion = 0;

function schedulePlayback(delay = config.loopDelayMs) {
  if (loopTimer) clearTimeout(loopTimer);
  loopTimer = setTimeout(() => {
    if (!currentAudioPath) return;
    currentlyPlayingPath = currentAudioPath;
    player.play(createAudioResource(currentAudioPath));
  }, delay);
}

async function synthesizeAtis(row: AtisRow) {
  const version = ++synthesisVersion;
  const spokenText = prepareAtisForSpeech(row.full_text);
  const tts = new EdgeTTS();

  await tts.synthesize(spokenText, config.voice, {
    rate: "-8%",
    pitch: "-3Hz",
    volume: "0%",
    outputFormat: Constants.OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3,
  });

  const basePath = join(audioDir, `${config.airport}-${row.info_letter}-${Date.now()}`);
  const generatedPath = await tts.toFile(basePath);

  if (version !== synthesisVersion) return;

  currentAudioPath = generatedPath;
  console.log(`[ATIS 01] ${config.airport} INFO ${row.info_letter} preparado: ${spokenText}`);

  if (player.state.status === AudioPlayerStatus.Idle) {
    schedulePlayback(250);
  }
}

async function loadLatestAtis() {
  const { data, error } = await supabase
    .from("atis_messages")
    .select("airport_icao, info_letter, full_text, created_at")
    .eq("airport_icao", config.airport)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<AtisRow>();

  if (error) throw error;
  if (!data) {
    console.log(`[ATIS 01] Todavía no existe un ATIS publicado para ${config.airport}.`);
    return;
  }

  await synthesizeAtis(data);
}

function subscribeToAtis() {
  return supabase
    .channel(`atis-voice-${config.airport}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "atis_messages",
        filter: `airport_icao=eq.${config.airport}`,
      },
      (payload) => {
        const row = payload.new as AtisRow;
        console.log(`[ATIS 01] Nuevo ATIS detectado: ${row.airport_icao} INFO ${row.info_letter}`);
        synthesizeAtis(row).catch((error) => console.error("[ATIS 01] Error TTS:", error));
      },
    )
    .subscribe((status) => console.log(`[ATIS 01] Supabase Realtime: ${status}`));
}

player.on(AudioPlayerStatus.Idle, () => {
  if (currentlyPlayingPath) {
    console.log(`[ATIS 01] Ciclo terminado. Próxima emisión en ${config.loopDelayMs} ms.`);
  }
  schedulePlayback();
});

player.on("error", (error) => {
  console.error("[ATIS 01] Error reproduciendo audio:", error);
  schedulePlayback(1500);
});

discord.once("ready", async () => {
  try {
    await mkdir(audioDir, { recursive: true });

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

    connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
      } catch {
        console.error("[ATIS 01] Conexión de voz perdida; cerrando para reinicio del proceso.");
        connection.destroy();
        process.exitCode = 1;
      }
    });

    await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
    console.log(`[ATIS 01] Conectado a Discord VC ${channel.name} (${config.airport}).`);

    subscribeToAtis();
    await loadLatestAtis();
  } catch (error) {
    console.error("[ATIS 01] Error de inicio:", error);
    process.exitCode = 1;
    discord.destroy();
  }
});

process.on("SIGTERM", () => discord.destroy());
process.on("SIGINT", () => discord.destroy());

discord.login(config.token);
