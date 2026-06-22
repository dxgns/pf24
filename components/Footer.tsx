export default function Footer() {
  return (
    <section id="discord" className="bg-slate-900 px-6 py-28 text-center">
      <div className="section-container max-w-3xl">
        <h2 className="text-4xl font-extrabold">Únete a PF24 Español</h2>

        <p className="mx-auto mt-5 max-w-2xl text-slate-300">
          Forma parte de la comunidad y participa en eventos, vuelos
          organizados y operaciones ATC.
        </p>

        <a
          href="https://discord.gg/SncR8zkznF"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary mt-8 inline-block rounded-2xl px-7 py-3.5 font-semibold"
        >
          Entrar al Discord
        </a>
      </div>
    </section>
  );
}