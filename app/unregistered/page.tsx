export default function UnregisteredPage() {
  return (
    <main className="radar-grid flex min-h-screen items-center justify-center bg-[#020617] px-6 text-white">
      <section className="panel max-w-xl rounded-3xl p-8 text-center">
        <p className="mono text-xs uppercase tracking-[0.35em] text-amber-300/80">
          PF24 / Usuario no registrado
        </p>

        <div className="mx-auto mt-6 flex h-20 w-20 items-center justify-center rounded-full border border-amber-400/40 bg-amber-500/10">
          <span className="text-4xl">⚠️</span>
        </div>

        <h1 className="mt-6 text-4xl font-extrabold">
          Usuario no registrado
        </h1>

        <p className="mt-4 leading-7 text-slate-300">
          No apareces como miembro del servidor de Discord de PF24. Asegúrate
          de estar dentro del servidor y de tener los roles correspondientes
          antes de entrar a la plataforma.
        </p>

        <a
          href="/"
          className="mt-8 inline-block rounded-xl bg-sky-500 px-6 py-3 font-semibold text-white hover:bg-sky-400"
        >
          Volver al inicio
        </a>

        <p className="mono mt-8 text-xs text-slate-500">
          ERROR: USER_NOT_REGISTERED
        </p>
      </section>
    </main>
  );
}