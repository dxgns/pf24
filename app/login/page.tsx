export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#050816] px-6 text-white">
      <section className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900 p-8 text-center">
        <h1 className="text-3xl font-extrabold">Iniciar sesión</h1>

        <p className="mt-4 text-slate-300">
          Accede a PF24 Español usando tu cuenta de Discord.
        </p>

        <a
          href="/api/auth/signin?callbackUrl=/dashboard"
          className="mt-8 block w-full rounded-2xl bg-[#5865F2] px-6 py-3 font-semibold text-white transition hover:-translate-y-0.5"
        >
          Continuar con Discord
        </a>

        <a
          href="/"
          className="mt-6 inline-block text-sm text-slate-400 hover:text-white"
        >
          Volver al inicio
        </a>
      </section>
    </main>
  );
}