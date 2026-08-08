export default function MaintenancePage() {
  return (
    <main className="radar-grid flex min-h-screen items-center justify-center bg-[#020617] px-6 text-white">
      <section className="panel max-w-2xl rounded-3xl p-10 text-center">
        <p className="mono text-xs uppercase tracking-[0.35em] text-amber-300/80">
          PF24 / Sistema
        </p>

        <div className="mx-auto mt-6 flex h-24 w-24 items-center justify-center rounded-full border border-amber-400/30 bg-amber-500/10">
          <span className="text-5xl">🛠️</span>
        </div>

        <h1 className="mt-6 text-5xl font-extrabold">
          Mantenimiento en curso
        </h1>

        <p className="mt-6 text-lg leading-8 text-slate-300">
          El servicio se encuentra temporalmente no disponible.
          Volverá a estar operativo una vez finalizado el mantenimiento.
        </p>

        <div className="mt-8 rounded-2xl border border-amber-400/20 bg-amber-500/5 p-4">
          <p className="text-sm text-amber-200">
            Gracias por tu comprensión. Intenta nuevamente más tarde.
          </p>
        </div>

        <div className="mt-10 border-t border-white/10 pt-6">
          <p className="mono text-xs text-slate-500">
            STATUS: MAINTENANCE
          </p>
        </div>
      </section>
    </main>
  );
}
