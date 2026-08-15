import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Image from "next/image";
import LogoutButton from "@/components/LogoutButton";
import UserAvatar from "@/components/UserAvatar";
import UtcClock from "@/components/UtcClock";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard Preview | PF24",
};

export default async function DashboardPreviewPage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  const canAccessATC = session.user?.permissions?.canAccessATC;
  const displayName = session.user?.name ?? "usuario";

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050612] text-white">
      {/* Fondo inspirado directamente en el home actual */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[660px] bg-cover bg-center bg-no-repeat opacity-30"
        style={{
          backgroundImage:
            "url('https://framerusercontent.com/images/lKs77AFnsbHG3ATgS3hBMy8iCOw.png')",
        }}
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[660px] bg-gradient-to-b from-[#050612]/25 via-[#050612]/70 to-[#050612]" />
      <div className="pointer-events-none absolute left-1/2 top-[-180px] h-[560px] w-[900px] -translate-x-1/2 rounded-full bg-[#8095ff]/10 blur-[140px]" />

      {/* HEADER */}
      <header className="relative z-20 border-b border-white/10 bg-[#050816]/70 backdrop-blur-xl">
        <div className="section-container flex h-[76px] items-center justify-between gap-5">
          <a href="/design-preview" className="flex items-center gap-3">
            <Image src="/logo.png" alt="PF24" width={40} height={40} priority />
            <div>
              <div className="text-[1.35rem] font-extrabold leading-none tracking-tight">
                PF<span className="text-sky-400">24</span>
              </div>
              <p className="mt-1 hidden text-[10px] font-semibold uppercase tracking-[0.22em] text-white/35 sm:block">
                Operations
              </p>
            </div>
          </a>

          <div className="flex items-center gap-3">
            <a
              href="/design-preview"
              className="hidden rounded-xl px-4 py-2 text-sm font-semibold text-white/60 transition hover:bg-white/5 hover:text-white sm:block"
            >
              Inicio
            </a>
            <a
              href="/ayuda"
              className="hidden rounded-xl px-4 py-2 text-sm font-semibold text-white/60 transition hover:bg-white/5 hover:text-white md:block"
            >
              Ayuda
            </a>
            <div className="hidden h-7 w-px bg-white/10 sm:block" />
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.045] py-1.5 pl-2 pr-3">
              <div className="scale-[0.82]">
                <UserAvatar image={session.user?.image} name={session.user?.name} />
              </div>
              <div className="hidden max-w-[150px] sm:block">
                <p className="truncate text-sm font-semibold text-white">{displayName}</p>
                <p className="text-[11px] text-white/40">Sesión activa</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className="section-container relative z-10 pb-16 pt-12 md:pb-24 md:pt-16">
        {/* INTRO */}
        <div className="grid items-end gap-8 lg:grid-cols-[1fr_auto]">
          <div className="max-w-3xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#8095ff]/20 bg-[#8095ff]/10 px-3 py-1.5 text-xs font-semibold text-[#aab5ff]">
              <span className="h-1.5 w-1.5 rounded-full bg-green-400 shadow-[0_0_10px_rgba(74,222,128,.75)]" />
              Plataforma operacional disponible
            </div>

            <h1 className="text-4xl font-extrabold tracking-tight text-white md:text-6xl">
              Hola, {displayName}.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-white/60 md:text-lg">
              Elige cómo quieres operar hoy. Tus accesos de piloto, control y administración están reunidos en un solo lugar.
            </p>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900/60 px-5 py-4 backdrop-blur-xl">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/35">Hora UTC</p>
              <div className="mt-1 text-xl font-bold tracking-tight text-white">
                <UtcClock />
              </div>
            </div>
          </div>
        </div>

        {/* ACCESOS PRINCIPALES */}
        <div className="mt-12">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8095ff]">Operaciones</p>
              <h2 className="mt-2 text-2xl font-extrabold md:text-3xl">¿Qué quieres hacer?</h2>
            </div>
            <p className="hidden text-sm text-white/35 md:block">Accesos principales</p>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <PrimaryModule
              href="/piloto"
              label="PILOTO"
              title="Gestionar mi vuelo"
              description="Presenta un plan de vuelo, modifica sus datos durante la operación y finalízalo cuando aterrices."
              action="Entrar como piloto"
              icon={<PlaneIcon />}
            />

            <PrimaryModule
              href="/atc"
              label="CONTROL DE TRÁFICO"
              title="Iniciar operaciones ATC"
              description="Accede a la Sector List, asume una posición y gestiona el tráfico activo en tiempo real."
              action="Entrar como ATC"
              icon={<RadarIcon />}
            />
          </div>
        </div>

        {/* ESTADO + HERRAMIENTAS */}
        <div className="mt-8 grid gap-6 xl:grid-cols-[0.72fr_1.28fr]">
          <aside className="rounded-[1.75rem] border border-white/10 bg-slate-900/65 p-6 shadow-xl shadow-black/10 backdrop-blur-xl md:p-7">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8095ff]">Tu sesión</p>
                <h3 className="mt-2 text-xl font-extrabold">Estado de acceso</h3>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full border border-green-400/15 bg-green-400/10 px-3 py-1.5 text-xs font-semibold text-green-300">
                <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                ONLINE
              </span>
            </div>

            <div className="mt-6 space-y-1">
              <SessionRow label="Usuario" value={displayName} />
              <SessionRow label="Servicios PF24" value="Operativos" />
              <SessionRow label="Sincronización" value="Tiempo real" />
            </div>

            <div className="mt-6 border-t border-white/10 pt-5">
              <LogoutButton />
            </div>
          </aside>

          <section>
            <div className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8095ff]">Más herramientas</p>
              <h3 className="mt-2 text-xl font-extrabold">Accesos adicionales</h3>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {canAccessATC && (
                <SecondaryModule
                  href="/scope"
                  title="Scope ATC"
                  tag="BETA"
                  description="Radar y herramientas avanzadas de control para operaciones ATC."
                  icon={<ScopeIcon />}
                />
              )}

              <SecondaryModule
                href="/admin"
                title="Administración"
                description="Roles, posiciones, aeropuertos, auditoría y configuración de PF24."
                icon={<SettingsIcon />}
              />

              <SecondaryModule
                href="/ayuda"
                title="Centro de ayuda"
                description="Consulta guías y documentación para utilizar la plataforma."
                icon={<HelpIcon />}
              />

              <SecondaryModule
                href="https://drive.google.com/drive/folders/1WfNHMsjxodzZ2uNCT0-QZHOJV_eBWmxl"
                title="Charts"
                description="Accede a las cartas y recursos aeronáuticos compartidos por PF24."
                icon={<ChartIcon />}
                external
              />
            </div>
          </section>
        </div>

        {/* FOOTER PEQUEÑO */}
        <div className="mt-14 flex flex-col justify-between gap-3 border-t border-white/10 pt-6 text-xs text-white/30 sm:flex-row">
          <p>PF24 · Project Flight Spanish Community</p>
          <p>Dashboard · Vista previa de diseño</p>
        </div>
      </section>
    </main>
  );
}

function PrimaryModule({
  href,
  label,
  title,
  description,
  action,
  icon,
}: {
  href: string;
  label: string;
  title: string;
  description: string;
  action: string;
  icon: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className="group relative min-h-[310px] overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/80 p-7 shadow-2xl shadow-black/15 transition duration-300 hover:-translate-y-1 hover:border-[#8095ff]/55 hover:bg-slate-900 md:p-9"
    >
      <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[#8095ff]/10 blur-3xl transition duration-500 group-hover:bg-[#8095ff]/20" />

      <div className="relative flex h-full flex-col">
        <div className="flex items-start justify-between gap-6">
          <div className="grid h-14 w-14 place-items-center rounded-2xl border border-[#8095ff]/20 bg-[#8095ff]/10 text-[#aab5ff]">
            {icon}
          </div>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-bold tracking-[0.2em] text-white/40">
            {label}
          </span>
        </div>

        <h3 className="mt-8 text-3xl font-extrabold tracking-tight text-white md:text-[2rem]">{title}</h3>
        <p className="mt-4 max-w-xl leading-7 text-white/50">{description}</p>

        <div className="mt-auto pt-8">
          <span className="inline-flex items-center gap-3 rounded-xl bg-[#8095ff] px-5 py-3 text-sm font-bold text-white transition group-hover:bg-[#6f84ff]">
            {action}
            <span className="text-base transition-transform group-hover:translate-x-1">→</span>
          </span>
        </div>
      </div>
    </a>
  );
}

function SecondaryModule({
  href,
  title,
  description,
  icon,
  tag,
  external,
}: {
  href: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  tag?: string;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className="group flex min-h-[170px] flex-col rounded-3xl border border-white/10 bg-slate-900/65 p-6 transition duration-200 hover:-translate-y-0.5 hover:border-[#8095ff]/45 hover:bg-slate-900/90"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#8095ff]/10 text-[#aab5ff]">
          {icon}
        </div>
        {tag && (
          <span className="rounded-md border border-[#8095ff]/20 bg-[#8095ff]/10 px-2 py-1 text-[9px] font-bold tracking-[0.18em] text-[#aab5ff]">
            {tag}
          </span>
        )}
      </div>
      <h4 className="mt-5 text-lg font-bold text-white transition group-hover:text-[#b8c1ff]">{title}</h4>
      <p className="mt-2 text-sm leading-6 text-white/40">{description}</p>
      <span className="mt-auto pt-4 text-sm font-semibold text-[#8095ff]">
        Abrir {external ? "↗" : "→"}
      </span>
    </a>
  );
}

function SessionRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-5 rounded-xl px-3 py-3 transition hover:bg-white/[0.035]">
      <span className="text-sm text-white/40">{label}</span>
      <span className="max-w-[55%] truncate text-right text-sm font-semibold text-white/80">{value}</span>
    </div>
  );
}

function PlaneIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 2 9 15" />
      <path d="m22 2-7 20-4-9-9-4Z" />
    </svg>
  );
}

function RadarIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <path d="M12 12 18.5 5.5" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function ScopeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21H9.6v-.1A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3V9.6h.1A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.38.25.7.6.9 1 .2.34.3.72.3 1.1V13c0 .38-.1.76-.3 1.1-.2.4-.52.75-.9.9Z" />
    </svg>
  );
}

function HelpIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M9.7 9a2.4 2.4 0 1 1 4.45 1.25c-.8 1.05-2.15 1.25-2.15 2.75" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 19V5M4 19h16" />
      <path d="m7 15 3-4 3 2 4-6" />
    </svg>
  );
}
