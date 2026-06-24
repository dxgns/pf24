import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Créditos | PF24",
};

export default function AboutPage() {
  return (
    <main className="radar-grid min-h-screen bg-[#020617] px-6 py-16 text-white">
      <section className="section-container max-w-5xl">
        <div className="panel rounded-3xl p-8 md:p-12">
          <Link
            href="/"
            className="inline-flex rounded-xl border border-white/10 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-sky-400 hover:text-sky-300"
          >
            ← Inicio
          </Link>

          <h1 className="mt-8 text-5xl font-extrabold">
            Créditos
          </h1>

          <p className="mt-4 text-slate-400">
            Información sobre el desarrollo y la infraestructura de la plataforma.
          </p>

          <div className="mt-12 space-y-12">
            {/* PF24 */}
            <section>
              <h2 className="text-3xl font-bold text-white">
                PF24
              </h2>

              <p className="mt-4 leading-8 text-slate-300">
                PF24 es una comunidad de simulación aérea enfocada en
                recrear operaciones realistas de vuelo y control de tránsito
                aéreo virtual dentro de Project Flight.
              </p>

              <p className="mt-4 leading-8 text-slate-300">
                La plataforma web fue creada para proporcionar herramientas
                operativas propias para pilotos, controladores ATC,
                administradores y miembros de la comunidad.
              </p>
            </section>

            {/* Desarrollo */}
            <section>
              <h2 className="text-3xl font-bold text-white">
                Diseño y Desarrollo
              </h2>

              <div className="mt-6 rounded-3xl border border-sky-500/20 bg-slate-900 p-8">
                <p className="text-sm uppercase tracking-[0.3em] text-sky-300">
                  Lead Developer
                </p>

                <h3 className="mt-3 text-3xl font-extrabold">
                  dxgns
                </h3>

                <p className="mt-2 text-slate-400">
                  <a
                    href="https://github.com/dxgns"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sky-300 transition hover:text-sky-200"
                    > github.com/dxgns
                    </a>
                </p>

                <p className="mt-6 leading-8 text-slate-300">
                  Responsable del diseño, arquitectura, desarrollo,
                  implementación y mantenimiento de la plataforma web de PF24.
                </p>

                <p className="mt-4 leading-8 text-slate-300">
                  Este proyecto fue desarrollado de forma voluntaria para la
                  comunidad PF24.
                </p>
              </div>
            </section>

            {/* Funciones */}
            <section>
              <h2 className="text-3xl font-bold text-white">
                Funcionalidades desarrolladas
              </h2>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <Feature text="Autenticación mediante Discord" />
                <Feature text="Sistema de roles y permisos" />
                <Feature text="Portal Piloto" />
                <Feature text="Portal ATC" />
                <Feature text="Planes de vuelo" />
                <Feature text="Sector List" />
                <Feature text="Sistema ATIS" />
                <Feature text="Contact Me" />
                <Feature text="Panel Administrativo" />
                <Feature text="Registro de accesos" />
                <Feature text="Control de sesiones ATC" />
                <Feature text="Sistema de mantenimiento" />
              </div>
            </section>

            {/* Tecnologías */}
            <section>
              <h2 className="text-3xl font-bold text-white">
                Tecnologías utilizadas
              </h2>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <Tech name="Next.js" />
                <Tech name="TypeScript" />
                <Tech name="Supabase" />
                <Tech name="Discord OAuth" />
                <Tech name="NextAuth" />
                <Tech name="Vercel" />
              </div>
            </section>

            {/* Reconocimiento */}
            <section>
              <h2 className="text-3xl font-bold text-white">
                Reconocimiento
              </h2>

              <p className="mt-4 leading-8 text-slate-300">
                La plataforma web de PF24 fue desarrollada como un
                proyecto comunitario para proporcionar herramientas propias de
                gestión y operación virtual.
              </p>

              <p className="mt-4 leading-8 text-slate-300">
                Salvo indicación contraria, el diseño, código fuente,
                arquitectura y desarrollo de la plataforma corresponden a <a
                                                                            href="https://github.com/dxgns"
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="text-sky-300 transition hover:text-sky-200"
                                                                            >
                                                                            dxgns
                                                                        </a>.
              </p>
            </section>
          </div>
        </div>
      </section>
    </main>
  );
}

function Feature({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900 p-4 text-slate-300">
      {text}
    </div>
  );
}

function Tech({ name }: { name: string }) {
  return (
    <div className="rounded-2xl border border-sky-500/20 bg-slate-900 p-6 text-center">
      <p className="font-semibold text-sky-300">
        {name}
      </p>
    </div>
  );
}