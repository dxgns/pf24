import Navbar from "@/components/Navbar";
import { auth } from "@/auth";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Design Preview | PF24",
};

export default async function DesignPreviewPage() {
  const session = await auth();

  return (
    <main className="min-h-screen bg-[#050612] text-white">
      <Navbar />

      <section className="relative flex min-h-screen items-center overflow-hidden px-6 pt-24">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage:
              "url('https://framerusercontent.com/images/lKs77AFnsbHG3ATgS3hBMy8iCOw.png')",
          }}
        />

        <div className="absolute inset-0 bg-black/10" />

        <div className="section-container relative z-10">
          <div className="max-w-3xl">
            <p className="mb-5 text-sm font-semibold uppercase tracking-[0.35em] text-[#8095ff]">
              Project Flight Spanish Community
            </p>

            <h1 className="text-6xl font-extrabold leading-[0.95] tracking-tight text-white md:text-8xl">
              PF<span className="text-sky-400">24</span>
            </h1>

            <p className="mt-8 max-w-2xl text-lg leading-8 text-white/85">
              PF24 es una comunidad de simulación aérea realista inspirada en el
              espacio aéreo mundial, donde pilotos y controladores recrean
              operaciones reales y vuelos multijugador en Project Flight y Discord.
            </p>

            <div className="mt-10 flex flex-wrap gap-4">
              <a
                href="https://discord.gg/DD7yeDDyPY"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-2xl bg-[#8095ff] px-10 py-4 text-xl font-semibold text-white transition hover:bg-[#6f84ff]"
              >
                Unirse al Discord
              </a>

              <a
                href={session ? "/design-preview/dashboard" : "/login"}
                className="rounded-2xl border border-white/20 px-10 py-4 text-xl font-semibold text-white transition hover:bg-white/10"
              >
                {session ? "Ir al Dashboard" : "Iniciar sesión"}
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-white/10 bg-[#080b18] px-6 py-10">
        <div className="section-container grid gap-6 text-center md:grid-cols-4">
          <Stat value="50+" label="Pilotos" />
          <Stat value="30+" label="ATCs" />
          <Stat value="200+" label="Vuelos" />
          <Stat value="500+" label="Miembros" />
        </div>
      </section>

      <section id="features" className="px-6 py-28">
        <div className="section-container">
          <h2 className="text-center text-4xl font-extrabold">
            Plataforma operacional PF24
          </h2>

          <p className="mx-auto mt-4 max-w-2xl text-center text-slate-400">
            Herramientas desarrolladas para pilotos y controladores de la comunidad.
          </p>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            <Card
              title="Planes de Vuelo"
              text="Creación y gestión completa de planes IFR, VFR, YFR y ZFR."
            />
            <Card
              title="Sector List"
              text="Lista operativa para ATC con estados, transponder y asignación de vuelos."
            />
            <Card
              title="ATIS"
              text="Información meteorológica y operacional para aeropuertos activos."
            />
          </div>
        </div>
      </section>

      <section className="px-6 pb-28">
        <div className="section-container rounded-[2rem] border border-white/10 bg-slate-900 p-12 text-center">
          <h2 className="text-4xl font-extrabold">Únete a PF24</h2>
          <p className="mx-auto mt-4 max-w-2xl text-slate-400">
            Participa en eventos, vuelos organizados y operaciones ATC junto a la
            comunidad hispana de Project Flight.
          </p>
          <a
            href="https://discord.gg/DD7yeDDyPY"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 inline-block rounded-2xl bg-[#8095ff] px-10 py-4 text-lg font-semibold text-white transition hover:bg-[#6f84ff]"
          >
            Entrar al Discord
          </a>
        </div>
      </section>

      <footer className="border-t border-white/10 bg-[#050612] px-6 py-8">
        <div className="section-container flex flex-col items-center justify-between gap-4 text-center text-sm text-slate-400 md:flex-row md:text-left">
          <p>© {new Date().getFullYear()} PF24</p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <a href="/legal/terms" className="transition hover:text-sky-300">Términos y Condiciones</a>
            <span className="text-slate-600">•</span>
            <a href="/legal/privacy" className="transition hover:text-sky-300">Política de Privacidad</a>
            <span className="text-slate-600">•</span>
            <a href="/legal/cookies" className="transition hover:text-sky-300">Política de Cookies</a>
            <span className="text-slate-600">•</span>
            <a href="/about" className="transition hover:text-sky-300">Créditos</a>
          </div>
        </div>
      </footer>
    </main>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="text-3xl font-extrabold text-[#8095ff]">{value}</p>
      <p className="mt-2 text-sm text-white/60">{label}</p>
    </div>
  );
}

function Card({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-8 transition hover:border-[#8095ff]/50">
      <h3 className="text-xl font-bold text-[#8095ff]">{title}</h3>
      <p className="mt-4 leading-7 text-slate-300">{text}</p>
    </div>
  );
}
