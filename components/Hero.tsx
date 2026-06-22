export default function Hero() {
  return (
    <section
      id="inicio"
      className="hero-bg flex min-h-screen items-center justify-center px-6 text-center"
    >
      <div className="section-container">
        <div className="mb-6 inline-block rounded-full bg-sky-400/15 px-4 py-2 text-xs font-semibold text-sky-400">
          PROJECT FLIGHT SPANISH COMMUNITY
        </div>

        <h1 className="mx-auto max-w-5xl text-5xl font-extrabold leading-tight md:text-7xl">
          La comunidad hispana más grande de{" "}
          <span className="text-sky-400">Project Flight</span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-300">
          Pilotos, controladores y entusiastas de la aviación virtual reunidos
          en una sola comunidad.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <a
            href="#discord"
            className="btn-primary rounded-2xl px-7 py-3.5 font-semibold"
          >
            Unirse al Discord
          </a>

          <a
            href="#features"
            className="btn-secondary rounded-2xl px-7 py-3.5 font-semibold text-white"
          >
            Ver herramientas
          </a>
        </div>
      </div>
    </section>
  );
}