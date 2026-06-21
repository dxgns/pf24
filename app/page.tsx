export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="flex min-h-screen items-center justify-center px-6 text-center">
        <div className="max-w-4xl">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.3em] text-sky-400">
            Project Flight Spanish Community
          </p>

          <h1 className="text-5xl font-bold md:text-7xl">
            PF24 <span className="text-sky-400">Español</span>
          </h1>

          <p className="mt-6 text-lg text-slate-300">
            Plataforma web para pilotos, controladores ATC y operaciones
            virtuales de la comunidad hispana de Project Flight.
          </p>

          <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
            <a
              href="/piloto"
              className="rounded-xl bg-sky-500 px-6 py-3 font-semibold hover:bg-sky-400"
            >
              Portal Piloto
            </a>

            <a
              href="/atc"
              className="rounded-xl border border-white/20 px-6 py-3 font-semibold hover:bg-white/10"
            >
              Portal ATC
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}