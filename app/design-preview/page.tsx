import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Design Preview | PF24",
  description: "Vista previa aislada del nuevo diseño de PF24.",
};

const features = [
  {
    number: "01",
    title: "Flight Plans",
    text: "Presenta, consulta y actualiza planes de vuelo desde una interfaz operacional clara y rápida.",
  },
  {
    number: "02",
    title: "ATC Operations",
    text: "Controla sectores, sigue tráfico activo y coordina operaciones en tiempo real con otros controladores.",
  },
  {
    number: "03",
    title: "Live Network",
    text: "Estados sincronizados, actividad compartida y cambios visibles al instante en toda la plataforma.",
  },
];

const rows = [
  ["IBE452", "MDPC", "GCLP", "FL360", "A20N", "ACTIVE"],
  ["RYR81K", "EGKK", "LEMH", "FL340", "B738", "ACTIVE"],
  ["FIN24", "EFKT", "EGHI", "FL390", "A359", "PENDING"],
];

export default function DesignPreviewPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#06090d] text-[#edf3f8] selection:bg-sky-400 selection:text-[#061019]">
      <div className="pointer-events-none fixed inset-0 opacity-70 [background-image:linear-gradient(rgba(255,255,255,0.022)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.022)_1px,transparent_1px)] [background-size:48px_48px]" />

      <header className="relative z-30 border-b border-white/[0.07] bg-[#06090d]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-[76px] max-w-[1440px] items-center justify-between px-6 lg:px-10">
          <a href="#top" className="group flex items-center gap-3" aria-label="PF24 inicio">
            <div className="relative grid h-9 w-9 place-items-center overflow-hidden rounded-[10px] border border-sky-300/20 bg-sky-400/10">
              <span className="absolute h-5 w-[1px] rotate-45 bg-sky-300/70" />
              <span className="absolute h-5 w-[1px] -rotate-45 bg-sky-300/70" />
              <span className="h-1.5 w-1.5 rounded-full bg-sky-300 shadow-[0_0_14px_rgba(125,211,252,0.9)]" />
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-[19px] font-black tracking-[-0.04em] text-white">PF</span>
              <span className="text-[19px] font-black tracking-[-0.04em] text-sky-300">24</span>
            </div>
          </a>

          <nav className="hidden items-center gap-8 text-[13px] font-medium text-white/55 md:flex">
            <a className="transition hover:text-white" href="#platform">Plataforma</a>
            <a className="transition hover:text-white" href="#operations">Operaciones</a>
            <a className="transition hover:text-white" href="#network">Red</a>
            <a className="transition hover:text-white" href="/ayuda">Documentación</a>
          </nav>

          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-300/70 sm:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,.8)]" />
              Systems nominal
            </span>
            <a
              href="/login"
              className="rounded-lg border border-white/10 bg-white/[0.045] px-4 py-2.5 text-[13px] font-semibold text-white transition hover:border-white/20 hover:bg-white/[0.075]"
            >
              Iniciar sesión
            </a>
          </div>
        </div>
      </header>

      <section id="top" className="relative z-10 mx-auto max-w-[1440px] px-6 pb-16 pt-20 lg:px-10 lg:pb-24 lg:pt-28">
        <div className="grid items-center gap-16 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
          <div className="max-w-[680px]">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-sky-300/15 bg-sky-300/[0.055] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-200/80">
              <span className="h-1 w-1 rounded-full bg-sky-300" />
              Flight operations platform
            </div>

            <h1 className="max-w-[760px] text-[clamp(3.7rem,7vw,7.7rem)] font-semibold leading-[0.86] tracking-[-0.065em] text-white">
              Operaciones de vuelo,
              <span className="block bg-gradient-to-r from-sky-200 via-sky-400 to-blue-500 bg-clip-text text-transparent">sin fricción.</span>
            </h1>

            <p className="mt-8 max-w-[590px] text-[17px] leading-8 text-[#92a0ad]">
              PF24 concentra planes de vuelo, control ATC y actividad de red en una sola interfaz diseñada para operar rápido, mantener contexto y reducir distracciones.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <a
                href="/login"
                className="group inline-flex items-center gap-3 rounded-lg bg-[#e9f6ff] px-5 py-3.5 text-[13px] font-bold text-[#071018] transition hover:bg-white"
              >
                Entrar a PF24
                <span className="transition-transform group-hover:translate-x-1">→</span>
              </a>
              <a
                href="#platform"
                className="rounded-lg border border-white/10 bg-white/[0.025] px-5 py-3.5 text-[13px] font-semibold text-white/80 transition hover:border-white/20 hover:bg-white/[0.05]"
              >
                Explorar plataforma
              </a>
            </div>

            <div className="mt-14 grid max-w-[560px] grid-cols-3 gap-6 border-t border-white/[0.07] pt-6">
              <Metric value="Realtime" label="Sincronización" />
              <Metric value="24/7" label="Disponibilidad" />
              <Metric value="1" label="Red operacional" />
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-20 -z-10 bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.12),transparent_58%)]" />
            <OperationsPanel />
          </div>
        </div>
      </section>

      <section id="platform" className="relative z-10 border-y border-white/[0.07] bg-[#090d12]/80">
        <div className="mx-auto grid max-w-[1440px] divide-y divide-white/[0.07] px-6 lg:grid-cols-3 lg:divide-x lg:divide-y-0 lg:px-10">
          {features.map((feature) => (
            <article key={feature.number} className="group py-10 lg:px-9 lg:py-14 first:lg:pl-0 last:lg:pr-0">
              <div className="mb-10 flex items-center justify-between">
                <span className="font-mono text-[11px] tracking-[0.12em] text-white/30">{feature.number}</span>
                <span className="h-px w-12 bg-white/10 transition-all group-hover:w-16 group-hover:bg-sky-300/50" />
              </div>
              <h2 className="text-[20px] font-semibold tracking-[-0.025em] text-white">{feature.title}</h2>
              <p className="mt-3 max-w-[360px] text-[14px] leading-6 text-[#7f8b96]">{feature.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="operations" className="relative z-10 mx-auto max-w-[1440px] px-6 py-24 lg:px-10 lg:py-32">
        <div className="grid gap-16 lg:grid-cols-[0.72fr_1.28fr] lg:items-start">
          <div className="lg:sticky lg:top-28">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-300/70">Operational workspace</p>
            <h2 className="mt-5 max-w-md text-4xl font-semibold leading-[1.05] tracking-[-0.05em] text-white md:text-5xl">
              Información técnica donde tiene que estar.
            </h2>
            <p className="mt-6 max-w-md text-[15px] leading-7 text-[#84919c]">
              Una interfaz densa cuando corresponde, simple cuando importa. Los estados, rutas y acciones prioritarias se distinguen sin convertir la pantalla en un panel saturado.
            </p>

            <div className="mt-10 space-y-5">
              <Detail label="Jerarquía" value="Estados críticos visibles primero" />
              <Detail label="Densidad" value="Más datos, menos ruido visual" />
              <Detail label="Consistencia" value="Mismos patrones en Piloto y ATC" />
            </div>
          </div>

          <div className="space-y-5">
            <div className="overflow-hidden rounded-2xl border border-white/[0.075] bg-[#090d12] shadow-2xl shadow-black/30">
              <div className="flex items-center justify-between border-b border-white/[0.065] px-5 py-4">
                <div>
                  <p className="text-[13px] font-semibold text-white">Flight activity</p>
                  <p className="mt-1 text-[11px] text-white/35">Live operational overview</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-md border border-white/[0.07] bg-white/[0.025] px-2.5 py-1.5 font-mono text-[10px] text-white/40">UTC 00:24:16</span>
                  <span className="rounded-md border border-emerald-300/15 bg-emerald-300/[0.055] px-2.5 py-1.5 text-[10px] font-semibold text-emerald-300/80">LIVE</span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-white/[0.055] bg-white/[0.015] text-[10px] uppercase tracking-[0.14em] text-white/25">
                      {['Callsign', 'Departure', 'Arrival', 'Level', 'Aircraft', 'Status'].map((head) => (
                        <th key={head} className="px-5 py-3 font-medium">{head}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row[0]} className="border-b border-white/[0.045] last:border-b-0 hover:bg-white/[0.018]">
                        {row.map((cell, index) => (
                          <td key={cell} className={`px-5 py-4 font-mono text-[12px] ${index === 0 ? 'font-semibold text-white' : 'text-white/55'}`}>
                            {index === 5 ? (
                              <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[9px] font-semibold tracking-[0.08em] ${cell === 'ACTIVE' ? 'border-emerald-400/15 bg-emerald-400/[0.055] text-emerald-300/80' : 'border-amber-300/15 bg-amber-300/[0.055] text-amber-200/75'}`}>
                                <span className={`h-1 w-1 rounded-full ${cell === 'ACTIVE' ? 'bg-emerald-300' : 'bg-amber-200'}`} />
                                {cell}
                              </span>
                            ) : cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <SmallPanel title="ATC online" value="04" hint="Active controllers">
                <div className="mt-6 space-y-3">
                  <Controller position="MDCS_CTR" name="Santo Domingo" />
                  <Controller position="EGTT_CTR" name="London Control" />
                  <Controller position="GCCC_R6_CTR" name="Canarias" />
                </div>
              </SmallPanel>

              <SmallPanel title="Network status" value="99.9%" hint="Operational availability">
                <div className="mt-7 h-[74px] overflow-hidden rounded-lg border border-white/[0.055] bg-black/20 p-3">
                  <div className="flex h-full items-end gap-1">
                    {[42,58,51,66,61,72,68,78,70,84,79,88,83,91,86,93,90,95,92,97,94,96].map((height, i) => (
                      <span key={i} className="flex-1 rounded-sm bg-sky-300/35" style={{ height: `${height}%` }} />
                    ))}
                  </div>
                </div>
              </SmallPanel>
            </div>
          </div>
        </div>
      </section>

      <section id="network" className="relative z-10 border-t border-white/[0.07] bg-[#080c11] px-6 py-24 lg:px-10 lg:py-28">
        <div className="mx-auto max-w-[1440px]">
          <div className="grid gap-12 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-300/70">Built for the network</p>
              <h2 className="mt-5 max-w-3xl text-4xl font-semibold leading-[1.02] tracking-[-0.05em] text-white md:text-6xl">
                Pilotos y controladores. Una sola fuente de verdad.
              </h2>
            </div>
            <a href="/login" className="inline-flex w-fit items-center gap-3 rounded-lg border border-white/10 bg-white/[0.04] px-5 py-3.5 text-[13px] font-semibold text-white transition hover:bg-white/[0.07]">
              Abrir plataforma <span>→</span>
            </a>
          </div>

          <div className="mt-16 grid gap-px overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.07] md:grid-cols-4">
            <SystemCell label="Flight plans" status="Operational" />
            <SystemCell label="ATC network" status="Operational" />
            <SystemCell label="Realtime sync" status="Operational" />
            <SystemCell label="Authentication" status="Operational" />
          </div>
        </div>
      </section>

      <footer className="relative z-10 border-t border-white/[0.07] bg-[#06090d] px-6 py-8 lg:px-10">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-5 text-[12px] text-white/35 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="font-bold tracking-[-0.02em] text-white/70">PF<span className="text-sky-300/80">24</span></span>
            <span>Flight operations platform</span>
          </div>
          <div className="flex flex-wrap gap-5">
            <a className="transition hover:text-white/70" href="/legal/terms">Términos</a>
            <a className="transition hover:text-white/70" href="/legal/privacy">Privacidad</a>
            <a className="transition hover:text-white/70" href="/about">Créditos</a>
          </div>
        </div>
      </footer>
    </main>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="text-[14px] font-semibold tracking-[-0.02em] text-white">{value}</p>
      <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-white/30">{label}</p>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex max-w-md items-start justify-between gap-6 border-b border-white/[0.06] pb-4">
      <span className="text-[12px] text-white/35">{label}</span>
      <span className="text-right text-[12px] font-medium text-white/70">{value}</span>
    </div>
  );
}

function Controller({ position, name }: { position: string; name: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/[0.05] pb-3 last:border-0 last:pb-0">
      <div className="min-w-0">
        <p className="truncate font-mono text-[11px] font-semibold text-white/75">{position}</p>
        <p className="mt-0.5 truncate text-[10px] text-white/30">{name}</p>
      </div>
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-300 shadow-[0_0_7px_rgba(110,231,183,.6)]" />
    </div>
  );
}

function SmallPanel({ title, value, hint, children }: { title: string; value: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/[0.075] bg-[#090d12] p-5">
      <p className="text-[11px] font-medium text-white/35">{title}</p>
      <div className="mt-3 flex items-end justify-between gap-3">
        <p className="text-3xl font-semibold tracking-[-0.05em] text-white">{value}</p>
        <p className="pb-1 text-[10px] text-white/25">{hint}</p>
      </div>
      {children}
    </div>
  );
}

function SystemCell({ label, status }: { label: string; status: string }) {
  return (
    <div className="bg-[#090d12] p-5">
      <div className="flex items-center justify-between gap-4">
        <span className="text-[11px] text-white/40">{label}</span>
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
      </div>
      <p className="mt-8 text-[13px] font-medium text-white/75">{status}</p>
    </div>
  );
}

function OperationsPanel() {
  return (
    <div className="overflow-hidden rounded-[18px] border border-white/[0.09] bg-[#080c11] shadow-[0_40px_120px_rgba(0,0,0,.55)]">
      <div className="flex items-center justify-between border-b border-white/[0.06] bg-[#0a0f15] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-white/10" />
          <span className="h-2 w-2 rounded-full bg-white/10" />
          <span className="h-2 w-2 rounded-full bg-white/10" />
        </div>
        <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/22">PF24 / operations</span>
        <span className="font-mono text-[9px] text-emerald-300/55">● LIVE</span>
      </div>

      <div className="grid min-h-[530px] grid-cols-[72px_1fr]">
        <aside className="border-r border-white/[0.06] bg-[#070a0e] p-3">
          <div className="grid h-9 place-items-center rounded-lg bg-sky-300/[0.1] text-[10px] font-bold text-sky-200">PF</div>
          <div className="mt-5 space-y-2">
            {[true, false, false, false, false].map((active, i) => (
              <div key={i} className={`mx-auto h-9 w-9 rounded-lg border ${active ? 'border-sky-300/15 bg-sky-300/[0.07]' : 'border-white/[0.045] bg-white/[0.015]'}`} />
            ))}
          </div>
        </aside>

        <div className="p-5 sm:p-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <p className="text-[10px] uppercase tracking-[0.14em] text-white/25">Operational overview</p>
              <h3 className="mt-1 text-[19px] font-semibold tracking-[-0.03em] text-white">Network control</h3>
            </div>
            <div className="flex gap-2">
              <span className="rounded-md border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5 font-mono text-[9px] text-white/35">23:58 UTC</span>
              <span className="rounded-md bg-sky-300 px-2.5 py-1.5 text-[9px] font-bold text-[#071018]">NEW PLAN</span>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <DashboardStat label="Active flights" value="18" delta="+3" />
            <DashboardStat label="ATC online" value="04" delta="LIVE" />
            <DashboardStat label="Pending" value="07" delta="QUEUE" />
          </div>

          <div className="mt-5 overflow-hidden rounded-xl border border-white/[0.06]">
            <div className="flex items-center justify-between border-b border-white/[0.055] bg-white/[0.018] px-4 py-3">
              <span className="text-[10px] font-semibold text-white/50">Active traffic</span>
              <span className="text-[9px] text-white/20">Updated now</span>
            </div>
            <div>
              {rows.map((row) => (
                <div key={row[0]} className="grid grid-cols-[1fr_0.8fr_0.8fr_auto] items-center gap-3 border-b border-white/[0.045] px-4 py-3 last:border-0">
                  <div>
                    <p className="font-mono text-[10px] font-semibold text-white/75">{row[0]}</p>
                    <p className="mt-0.5 font-mono text-[8px] text-white/22">{row[4]}</p>
                  </div>
                  <p className="font-mono text-[9px] text-white/35">{row[1]}</p>
                  <p className="font-mono text-[9px] text-white/35">{row[2]}</p>
                  <span className={`h-1.5 w-1.5 rounded-full ${row[5] === 'ACTIVE' ? 'bg-emerald-300' : 'bg-amber-200'}`} />
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.012] p-4">
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-white/30">Network activity</span>
                <span className="font-mono text-[8px] text-sky-300/50">+12.8%</span>
              </div>
              <div className="mt-5 flex h-16 items-end gap-1.5">
                {[26,38,31,47,42,56,49,62,58,70,65,77,71,84,79,88,82,92].map((height, i) => (
                  <span key={i} className="flex-1 rounded-[2px] bg-sky-300/25" style={{ height: `${height}%` }} />
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.012] p-4">
              <span className="text-[9px] text-white/30">System status</span>
              <div className="mt-5 space-y-3">
                <StatusLine label="Realtime" />
                <StatusLine label="Database" />
                <StatusLine label="Auth" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DashboardStat({ label, value, delta }: { label: string; value: string; delta: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-3.5">
      <p className="text-[9px] text-white/28">{label}</p>
      <div className="mt-2 flex items-end justify-between gap-3">
        <span className="text-2xl font-semibold tracking-[-0.05em] text-white/85">{value}</span>
        <span className="pb-1 font-mono text-[8px] text-sky-300/45">{delta}</span>
      </div>
    </div>
  );
}

function StatusLine({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[9px] text-white/35">{label}</span>
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
    </div>
  );
}
