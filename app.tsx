// app/page.tsx

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-sky-500/20 via-slate-950 to-blue-950" />

        <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-8">
          <nav className="flex items-center justify-between">
            <div className="text-xl font-bold tracking-tight">
              PF24 <span className="text-sky-400">Español</span>
            </div>

            <div className="hidden gap-6 text-sm text-slate-300 md:flex">
              <a href="#comunidad" className="hover:text-white">Comunidad</a>
              <a href="#herramientas" className="hover:text-white">Herramientas</a>
              <a href="#unirse" className="hover:text-white">Unirse</a>
            </div>

            <a
              href="/login"
              className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-400"
            >
              Iniciar sesión
            </a>
          </nav>

          <div className="grid flex-1 items-center gap-12 py-20 md:grid-cols-2">
            <section>
              <p className="mb-4 text-sm font-semibold uppercase tracking-[0.3em] text-sky-400">
                Project Flight Spanish Community
              </p>

              <h1 className="text-4xl font-bold tracking-tight md:text-6xl">
                La comunidad hispana de{" "}
                <span className="text-sky-400">Project Flight</span>
              </h1>

              <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300">
                PF24 Español reúne pilotos y controladores virtuales en una
                experiencia organizada, realista y accesible para la comunidad
                hispanohablante de Project Flight en Roblox.
              </p>

              <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                <a
                  href="#unirse"
                  className="rounded-2xl bg-sky-500 px-6 py-3 text-center font-semibold text-white hover:bg-sky-400"
                >
                  Unirme a la comunidad
                </a>

                <a
                  href="#herramientas"
                  className="rounded-2xl border border-white/15 px-6 py-3 text-center font-semibold text-white hover:bg-white/10"
                >
                  Ver herramientas
                </a>
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Estado operacional</p>
                  <h2 className="text-2xl font-bold">PF24 Español</h2>
                </div>

                <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-sm font-semibold text-emerald-400">
                  Online
                </span>
              </div>

              <div className="grid gap-4">
                <InfoCard title="ATIS" value="Información operativa" />
                <InfoCard title="METAR" value="Datos meteorológicos" />
                <InfoCard title="Flight Plans" value="Planes de vuelo" />
                <InfoCard title="ATC" value="Control virtual organizado" />
              </div>
            </section>
          </div>
        </div>
      </section>

      <section id="comunidad" className="border-t border-white/10 bg-slate-900 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <h2 className="text-3xl font-bold">Una comunidad hecha para volar mejor</h2>
          <p className="mt-4 max-w-3xl text-slate-300">
            PF24 Español busca crear un espacio ordenado para pilotos,
            controladores y miembros interesados en la aviación virtual dentro
            de Project Flight.
          </p>
        </div>
      </section>

      <section id="herramientas" className="bg-slate-950 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <h2 className="text-3xl font-bold">Herramientas principales</h2>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            <Feature
              title="Planes de vuelo"
              text="Crea, revisa y gestiona vuelos con callsign, ruta, aeronave y reglas IFR, VFR, YFR o ZFR."
            />
            <Feature
              title="ATIS y METAR"
              text="Información operativa para aeropuertos, con METAR automático y ATIS gestionado por ATC."
            />
            <Feature
              title="Control ATC"
              text="Sistema interno para posiciones ATC, tráfico activo, emergencias y operaciones en tiempo real."
            />
          </div>
        </div>
      </section>

      <section id="unirse" className="border-t border-white/10 bg-slate-900 py-24">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="text-3xl font-bold">Únete a PF24 Español</h2>
          <p className="mt-4 text-slate-300">
            Forma parte de la comunidad, participa como piloto, aprende control
            aéreo virtual y conecta con otros jugadores de Project Flight.
          </p>

          <a
            href="https://discord.gg/"
            className="mt-8 inline-block rounded-2xl bg-sky-500 px-8 py-4 font-semibold text-white hover:bg-sky-400"
          >
            Entrar al Discord
          </a>
        </div>
      </section>
    </main>
  );
}

function InfoCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
      <p className="text-sm text-slate-400">{title}</p>
      <p className="mt-1 font-semibold text-white">{value}</p>
    </div>
  );
}

function Feature({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <h3 className="text-xl font-bold">{title}</h3>
      <p className="mt-3 text-slate-300">{text}</p>
    </div>
  );
}
