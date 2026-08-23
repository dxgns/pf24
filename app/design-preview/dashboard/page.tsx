import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Image from "next/image";
import LogoutButton from "@/components/LogoutButton";
import UserAvatar from "@/components/UserAvatar";
import UtcClock from "@/components/UtcClock";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Dashboard Preview | PF24" };

export default async function DashboardPreviewPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const canAccessATC = session.user?.permissions?.canAccessATC;
  const canAccessAdmin = session.user?.permissions?.canAccessAdmin;
  const displayName = session.user?.name ?? "usuario";

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050612] text-white">
      <div className="pointer-events-none absolute left-1/2 top-[-180px] h-[560px] w-[900px] -translate-x-1/2 rounded-full bg-[#8095ff]/10 blur-[140px]" />

      <header className="relative z-20 border-b border-white/10 bg-[#050816]/70 backdrop-blur-xl">
        <div className="section-container flex h-[76px] items-center justify-between gap-5">
          <a href="/design-preview" className="flex items-center gap-3">
            <Image src="/logo.png" alt="PF24" width={40} height={40} priority />
            <div>
              <div className="text-[1.35rem] font-extrabold leading-none">PF<span className="text-sky-400">24</span></div>
              <p className="mt-1 hidden text-[10px] font-semibold uppercase tracking-[0.22em] text-white/35 sm:block">Operations</p>
            </div>
          </a>

          <div className="flex items-center gap-3">
            <div className="hidden rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 sm:block">
              <span className="mr-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">UTC</span>
              <span className="text-sm font-bold"><UtcClock /></span>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.045] py-1.5 pl-2 pr-3">
              <div className="scale-[0.82]"><UserAvatar image={session.user?.image} name={session.user?.name} /></div>
              <p className="hidden max-w-[150px] truncate text-sm font-semibold sm:block">{displayName}</p>
            </div>
          </div>
        </div>
      </header>

      <section className="section-container relative z-10 pb-20 pt-12 md:pt-16">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8095ff]">Operaciones</p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight md:text-6xl">Hola, {displayName}.</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-white/60 md:text-lg">
            Elige el entorno operativo de PF24 que necesitas.
          </p>
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-2">
          <Module
            href="/design-preview/piloto"
            label="PILOTO"
            title="Gestionar mi vuelo"
            description="Presenta y administra tu plan de vuelo, consulta ATC y revisa la información operacional."
            action="Entrar como piloto"
          />

          {canAccessATC && (
            <Module
              href="/scope"
              label="CONTROL DE TRÁFICO"
              title="Abrir Scope ATC"
              description="Radar, Sector List, coordinación, ATIS y herramientas de control en el Scope PF24."
              action="Abrir Scope"
            />
          )}
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {canAccessAdmin && (
            <SmallModule href="/design-preview/admin" title="Administración" description="Supervisión y mantenimiento de PF24." />
          )}
          <SmallModule href="/ayuda" title="Centro de ayuda" description="Guías y documentación de la plataforma." />
          <SmallModule href="https://drive.google.com/drive/folders/1WfNHMsjxodzZ2uNCT0-QZHOJV_eBWmxl" title="Charts" description="Cartas y recursos aeronáuticos PF24." external />
        </div>

        <div className="mt-10 border-t border-white/10 pt-6">
          <LogoutButton />
        </div>
      </section>
    </main>
  );
}

function Module({ href, label, title, description, action }: { href: string; label: string; title: string; description: string; action: string }) {
  return (
    <a href={href} className="group flex min-h-[260px] flex-col rounded-[2rem] border border-white/10 bg-slate-900/80 p-8 transition hover:-translate-y-1 hover:border-[#8095ff]/55">
      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#aab5ff]">{label}</p>
      <h2 className="mt-6 text-3xl font-extrabold">{title}</h2>
      <p className="mt-4 leading-7 text-white/50">{description}</p>
      <span className="mt-auto pt-8 text-sm font-bold text-[#aab5ff]">{action} →</span>
    </a>
  );
}

function SmallModule({ href, title, description, external }: { href: string; title: string; description: string; external?: boolean }) {
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className="rounded-3xl border border-white/10 bg-slate-900/65 p-6 transition hover:border-[#8095ff]/45"
    >
      <h3 className="font-bold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-white/40">{description}</p>
    </a>
  );
}
