export default function MaintenancePage() {
  return (
    <main className="radar-grid flex min-h-screen items-center justify-center bg-[#020617] px-6 text-white">
      <section className="panel max-w-2xl rounded-3xl p-10 text-center">
        <p className="mono text-xs uppercase tracking-[0.35em] text-amber-300/80">
          PF24 / Sistema
        </p>

        <div className="mx-auto mt-6 flex h-24 w-24 items-center justify-center rounded-full border border-amber-400/30 bg-amber-500/10">
          <span className="text-5xl">🚧</span>
        </div>

        <h1 className="mt-6 text-5xl font-extrabold">
          En construcción
        </h1>

        <p className="mt-6 text-lg leading-8 text-slate-300">
          Esta sección aún se encuentra en desarrollo y no está disponible para
          los usuarios. Estamos trabajando para incorporarla próximamente.
        </p>

        <div className="mt-8 rounded-2xl border border-amber-400/20 bg-amber-500/5 p-4">
          <p className="text-sm text-amber-200">
            Algunas funciones pueden estar incompletas, experimentar cambios o
            no encontrarse disponibles temporalmente.
          </p>
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-4">

          <a
            href="/"
            className="rounded-xl border border-white/10 bg-slate-900 px-6 py-3 font-semibold text-slate-300 transition hover:border-sky-400 hover:text-sky-300"
          >
            Ir al inicio
          </a>
        </div>

        <div className="mt-10 border-t border-white/10 pt-6">
          <p className="mono text-xs text-slate-500">
            STATUS: DEVELOPMENT_BUILD
          </p>
        </div>
      </section>
    </main>
  );
}