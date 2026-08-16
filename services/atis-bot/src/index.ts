import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EdgeTTS, Constants } from "@andresaya/edge-tts";
import { createClient, RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
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
import ffmpegPath from "ffmpeg-static";
import { AtisSpeechData, buildEnglishAtisSpeech, buildSpanishAtisSpeech } from "./pronunciation.js";

type AtisRow = AtisSpeechData & { id: string; created_at?: string };
type AudioSet = { atisId: string; spanishPath: string; englishPath: string; infoLetter: string };
type Phase = "idle" | "spanish" | "english";

type BotConfig = {
  number: number;
  label: string;
  token: string;
  guildId: string;
  channelId: string;
  airport: string;
  spanishVoice: string;
  englishVoice: string;
  languageGapMs: number;
  loopDelayMs: number;
};

const BOT_AIRPORTS = [
  "MDPC",
  "MDST",
  "LCLK",
  "LCPH",
  "LEMH",
  "GCLP",
  "EGKK",
  "EGHI",
  "EFKT",
] as const;

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la variable de entorno ${name}`);
  return value;
}

function slot(number: number) {
  return String(number).padStart(2, "0");
}

const sharedConfig = {
  guildId: process.env.DISCORD_GUILD_ID ?? "1427074541917700209",
  supabaseUrl: required("SUPABASE_URL"),
  supabaseAnonKey: required("SUPABASE_ANON_KEY"),
  spanishVoice: process.env.ATIS_ROBOT_VOICE_ES ?? process.env.ATIS_VOICE_ES ?? "es-DO-EmilioNeural",
  englishVoice: process.env.ATIS_ROBOT_VOICE_EN ?? process.env.ATIS_VOICE_EN ?? "en-US-ChristopherNeural",
  languageGapMs: Number(process.env.ATIS_LANGUAGE_GAP_MS ?? "2600"),
  loopDelayMs: Number(process.env.ATIS_LOOP_DELAY_MS ?? "4500"),
};

function loadBotConfigs(): BotConfig[] {
  return BOT_AIRPORTS.flatMap((defaultAirport, index) => {
    const number = index + 1;
    const key = slot(number);

    // ATIS 01 keeps compatibility with the variables already used in Railway.
    const token = process.env[`ATIS_${key}_TOKEN`]
      ?? (number === 1 ? process.env.DISCORD_TOKEN : undefined);
    const channelId = process.env[`ATIS_${key}_CHANNEL_ID`]
      ?? (number === 1 ? process.env.DISCORD_VOICE_CHANNEL_ID : undefined);

    if (!token || !channelId) {
      console.log(`[ATIS ${key}] Deshabilitado: falta ${!token ? "TOKEN" : "CHANNEL_ID"}.`);
      return [];
    }

    return [{
      number,
      label: `ATIS ${key}`,
      token,
      guildId: process.env[`ATIS_${key}_GUILD_ID`] ?? sharedConfig.guildId,
      channelId,
      airport: (process.env[`ATIS_${key}_AIRPORT`] ?? defaultAirport).toUpperCase(),
      spanishVoice: process.env[`ATIS_${key}_VOICE_ES`] ?? sharedConfig.spanishVoice,
      englishVoice: process.env[`ATIS_${key}_VOICE_EN`] ?? sharedConfig.englishVoice,
      languageGapMs: Number(process.env[`ATIS_${key}_LANGUAGE_GAP_MS`] ?? sharedConfig.languageGapMs),
      loopDelayMs: Number(process.env[`ATIS_${key}_LOOP_DELAY_MS`] ?? sharedConfig.loopDelayMs),
    }];
  });
}

const supabase = createClient(sharedConfig.supabaseUrl, sharedConfig.supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function addAtisPauses(text: string) {
  return text
    .replace(/\.\s+/g, ". … ")
    .replace(/;\s+/g, "; … ")
    .replace(/,\s+/g, ", ")
    .trim();
}

const remarksTranslationCache = new Map<string, string>();

async function translateRemarksToEnglish(value: string | null | undefined) {
  const remarks = (value ?? "").trim();
  if (!remarks) return "";

  const cached = remarksTranslationCache.get(remarks);
  if (cached) return cached;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);

  try {
    const params = new URLSearchParams({
      client: "gtx",
      sl: "es",
      tl: "en",
      dt: "t",
      q: remarks,
    });
    const response = await fetch(`https://translate.googleapis.com/translate_a/single?${params.toString()}`, {
      signal: controller.signal,
      headers: { "User-Agent": "PF24-ATIS/1.0" },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const payload = await response.json() as unknown;
    const blocks = Array.isArray(payload) && Array.isArray(payload[0]) ? payload[0] : [];
    const translated = blocks
      .map((block) => Array.isArray(block) && typeof block[0] === "string" ? block[0] : "")
      .join("")
      .trim();

    if (!translated) throw new Error("La respuesta de traducción llegó vacía.");
    remarksTranslationCache.set(remarks, translated);
    return translated;
  } catch (error) {
    console.error("[PF24 ATIS] No se pudieron traducir las observaciones al inglés; se omitirán en la transmisión inglesa.", error);
    return "";
  } finally {
    clearTimeout(timeout);
  }
}

async function applyRadioProcessing(inputPath: string, outputPath: string) {
  if (!ffmpegPath) throw new Error("ffmpeg-static no entregó una ruta ejecutable.");

  const filter = [
    "highpass=f=450",
    "lowpass=f=2800",
    "acompressor=threshold=0.08:ratio=8:attack=3:release=55:makeup=3",
    "acrusher=bits=10:mix=0.18:mode=lin",
    "volume=1.25",
    "alimiter=limit=0.78",
  ].join(",");

  await new Promise<void>((resolve, reject) => {
    const ffmpeg = spawn(ffmpegPath, [
      "-hide_banner",
      "-loglevel", "error",
      "-y",
      "-i", inputPath,
      "-af", filter,
      "-ac", "1",
      "-ar", "12000",
      "-b:a", "24k",
      outputPath,
    ]);

    let stderr = "";
    ffmpeg.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    ffmpeg.on("error", reject);
    ffmpeg.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg terminó con código ${code}: ${stderr.trim()}`));
    });
  });

  return outputPath;
}

class AtisVoiceBot {
  private readonly discord = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
  });
  private readonly player = createAudioPlayer({
    behaviors: { noSubscriber: NoSubscriberBehavior.Pause },
  });
  private readonly audioDir: string;

  private voiceConnection: VoiceConnection | null = null;
  private realtimeChannel: RealtimeChannel | null = null;
  private currentAudio: AudioSet | null = null;
  private pendingAudio: AudioSet | null = null;
  private latestAtisId: string | null = null;
  private phase: Phase = "idle";
  private timer: NodeJS.Timeout | null = null;
  private synthesisVersion = 0;

  constructor(
    private readonly config: BotConfig,
    private readonly db: SupabaseClient,
  ) {
    this.audioDir = join(tmpdir(), `pf24-atis-${slot(config.number)}`);

    this.player.on(AudioPlayerStatus.Idle, () => this.handlePlayerIdle());
    this.player.on("error", (error) => {
      this.log("error", "Error de audio", error);
      if (this.latestAtisId && this.currentAudio) this.playSpanish(1500);
    });

    this.discord.once("ready", () => {
      this.initialize().catch((error) => {
        this.log("error", "Error de inicio", error);
      });
    });
  }

  private log(level: "log" | "error", message: string, detail?: unknown) {
    const prefix = `[${this.config.label} · ${this.config.airport}]`;
    if (level === "error") console.error(prefix, message, detail ?? "");
    else console.log(prefix, message, detail ?? "");
  }

  async start() {
    await this.discord.login(this.config.token);
  }

  async stop() {
    this.synthesisVersion++;
    this.latestAtisId = null;
    this.currentAudio = null;
    this.pendingAudio = null;
    this.disconnectVoice();
    if (this.realtimeChannel) {
      await this.db.removeChannel(this.realtimeChannel);
      this.realtimeChannel = null;
    }
    this.discord.destroy();
  }

  private async initialize() {
    await mkdir(this.audioDir, { recursive: true });
    this.log("log", `Discord listo como ${this.discord.user?.tag ?? this.config.label}.`);
    this.subscribeToAtis();
    await this.loadLatestAtis();
  }

  private clearTimer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private async ensureVoiceConnection() {
    if (this.voiceConnection && this.voiceConnection.state.status !== VoiceConnectionStatus.Destroyed) {
      return this.voiceConnection;
    }

    const guild = await this.discord.guilds.fetch(this.config.guildId);
    const channel = await guild.channels.fetch(this.config.channelId);
    if (!channel?.isVoiceBased()) {
      throw new Error(`El canal ${this.config.channelId} no es un canal de voz.`);
    }

    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: guild.id,
      group: `atis-${slot(this.config.number)}`,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: true,
      selfMute: false,
    });

    connection.subscribe(this.player);
    this.voiceConnection = connection;

    connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
      } catch {
        if (this.voiceConnection === connection) this.voiceConnection = null;
        try { connection.destroy(); } catch {}
        this.log("error", "Conexión de voz perdida.");
      }
    });

    await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
    this.log("log", `Conectado al VC ${this.config.channelId}.`);
    return connection;
  }

  private disconnectVoice() {
    this.clearTimer();
    this.player.stop(true);
    this.phase = "idle";
    if (this.voiceConnection) {
      try { this.voiceConnection.destroy(); } catch {}
    }
    this.voiceConnection = null;
    this.log("log", "Sin ATIS activo; fuera del VC.");
  }

  private playSpanish(delay = 0) {
    this.clearTimer();
    this.timer = setTimeout(async () => {
      if (!this.latestAtisId || !this.currentAudio) return;
      try {
        await this.ensureVoiceConnection();
        this.phase = "spanish";
        this.player.play(createAudioResource(this.currentAudio.spanishPath));
        this.log("log", `INFO ${this.currentAudio.infoLetter}: español.`);
      } catch (error) {
        this.log("error", "No se pudo iniciar español", error);
      }
    }, delay);
  }

  private playEnglish(delay = this.config.languageGapMs) {
    this.clearTimer();
    this.timer = setTimeout(() => {
      if (!this.latestAtisId || !this.currentAudio) return;
      this.phase = "english";
      this.player.play(createAudioResource(this.currentAudio.englishPath));
      this.log("log", `INFO ${this.currentAudio.infoLetter}: English.`);
    }, delay);
  }

  private async synthesize(text: string, voice: string, filename: string) {
    const tts = new EdgeTTS();
    await tts.synthesize(addAtisPauses(text), voice, {
      rate: "-14%",
      pitch: "-12Hz",
      volume: "0%",
      outputFormat: Constants.OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3,
    });

    const rawPath = await tts.toFile(join(this.audioDir, `${filename}-raw.mp3`));
    return applyRadioProcessing(rawPath, join(this.audioDir, `${filename}-radio.mp3`));
  }

  private async prepareAtis(row: AtisRow) {
    const version = ++this.synthesisVersion;
    const stamp = Date.now();
    const translatedRemarks = await translateRemarksToEnglish(row.remarks);

    if (version !== this.synthesisVersion || this.latestAtisId !== row.id) return;

    const spanish = buildSpanishAtisSpeech(row);
    const english = buildEnglishAtisSpeech(row, translatedRemarks);

    this.log("log", `Sintetizando INFO ${row.info_letter}...`);
    const [spanishPath, englishPath] = await Promise.all([
      this.synthesize(spanish, this.config.spanishVoice, `${this.config.airport}-${row.info_letter}-${stamp}-es`),
      this.synthesize(english, this.config.englishVoice, `${this.config.airport}-${row.info_letter}-${stamp}-en`),
    ]);

    if (version !== this.synthesisVersion || this.latestAtisId !== row.id) return;

    const prepared: AudioSet = {
      atisId: row.id,
      spanishPath,
      englishPath,
      infoLetter: row.info_letter,
    };

    if (!this.currentAudio || this.phase === "idle") {
      this.currentAudio = prepared;
      this.pendingAudio = null;
      await this.ensureVoiceConnection();
      this.playSpanish(350);
      return;
    }

    this.pendingAudio = prepared;
    this.log("log", `INFO ${row.info_letter} preparada; cambiará al terminar el ciclo actual.`);
  }

  private async loadLatestAtis() {
    const { data, error } = await this.db
      .from("atis_messages")
      .select("id, airport_icao, info_letter, metar, approach_primary, approach_optional, runway, extra_info, remarks, created_at")
      .eq("airport_icao", this.config.airport)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<AtisRow>();

    if (error) throw error;
    if (!data) {
      this.latestAtisId = null;
      this.currentAudio = null;
      this.pendingAudio = null;
      this.disconnectVoice();
      return;
    }

    this.latestAtisId = data.id;
    await this.prepareAtis(data);
  }

  private async handleInsert(row: AtisRow) {
    if (row.airport_icao !== this.config.airport) return;
    this.latestAtisId = row.id;
    this.pendingAudio = null;
    this.log("log", `Nuevo ATIS INFO ${row.info_letter}.`);
    await this.prepareAtis(row);
  }

  private handleDelete(oldRow: Partial<AtisRow>) {
    if (!oldRow.id || oldRow.id !== this.latestAtisId) return;
    this.log("log", `ATIS activo ${oldRow.id} eliminado.`);
    this.synthesisVersion++;
    this.latestAtisId = null;
    this.currentAudio = null;
    this.pendingAudio = null;
    this.disconnectVoice();
  }

  private subscribeToAtis() {
    this.realtimeChannel = this.db
      .channel(`atis-voice-${this.config.airport}-${this.config.number}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "atis_messages", filter: `airport_icao=eq.${this.config.airport}` },
        (payload) => {
          this.handleInsert(payload.new as AtisRow).catch((error) => this.log("error", "Error procesando INSERT", error));
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "atis_messages" },
        (payload) => this.handleDelete(payload.old as Partial<AtisRow>),
      )
      .subscribe((status) => this.log("log", `Supabase Realtime: ${status}`));
  }

  private handlePlayerIdle() {
    if (!this.latestAtisId || !this.currentAudio) return;

    if (this.phase === "spanish") {
      this.playEnglish();
      return;
    }

    if (this.phase === "english") {
      this.phase = "idle";

      if (this.pendingAudio && this.pendingAudio.atisId === this.latestAtisId) {
        this.log("log", `Cambio a INFO ${this.pendingAudio.infoLetter}.`);
        this.currentAudio = this.pendingAudio;
        this.pendingAudio = null;
        this.playSpanish(700);
        return;
      }

      if (this.currentAudio.atisId !== this.latestAtisId) {
        this.log("log", "Esperando audio del nuevo ATIS...");
        return;
      }

      this.playSpanish(this.config.loopDelayMs);
    }
  }
}

const botConfigs = loadBotConfigs();
if (botConfigs.length === 0) {
  throw new Error("No hay ningún ATIS habilitado. Configura al menos ATIS_01_TOKEN y ATIS_01_CHANNEL_ID.");
}

const bots = botConfigs.map((config) => new AtisVoiceBot(config, supabase));

console.log(`[PF24 ATIS] Iniciando ${bots.length} bot(s): ${botConfigs.map((b) => `${b.label}/${b.airport}`).join(", ")}`);
await Promise.all(bots.map((bot) => bot.start()));

let shuttingDown = false;
async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log("[PF24 ATIS] Cerrando bots...");
  await Promise.allSettled(bots.map((bot) => bot.stop()));
}

process.on("SIGTERM", () => { void shutdown(); });
process.on("SIGINT", () => { void shutdown(); });