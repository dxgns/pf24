export default function AccessDeniedPage() {
  return (
    <main className="radar-grid flex min-h-screen items-center justify-center bg-[#020617] px-6 text-white">
      <section className="panel max-w-xl rounded-3xl p-8 text-center">
        <p className="mono text-xs uppercase tracking-[0.35em] text-red-300/80">
          PF24 / Acceso denegado
        </p>

        <div className="mx-auto mt-6 flex h-20 w-20 items-center justify-center rounded-full border border-red-400/40 bg-red-500/10">
          <span className="text-4xl">⛔</span>
        </div>

        <h1 className="mt-6 text-4xl font-extrabold text-white">
          Acceso restringido
        </h1>

        <p className="mt-4 leading-7 text-slate-300">
          No tienes los permisos necesarios para entrar a esta sección.
          Si crees que esto es un error, revisa tus roles en Discord o contacta
          al staff de PF24.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <a
            href="/dashboard"
            className="rounded-xl bg-sky-500 px-5 py-3 font-semibold text-white transition hover:bg-sky-400"
          >
            Volver al Dashboard
          </a>

          <a
            href="/"
            className="rounded-xl border border-white/10 bg-slate-900 px-5 py-3 font-semibold text-slate-300 transition hover:border-sky-400 hover:text-sky-300"
          >
            Ir al inicio
          </a>
        </div>

        <p className="mono mt-8 text-xs text-slate-500">
          ERROR: INSUFFICIENT_ROLE
        </p>
      </section>
    </main>
  );
}