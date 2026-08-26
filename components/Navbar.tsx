import Image from "next/image";
import { auth } from "@/auth";

export default async function Navbar() {
  const session = await auth();

  return (
    <header className="fixed left-0 top-0 z-50 w-full border-b border-white/10 bg-[#050816]/80 backdrop-blur">
      <div className="section-container flex h-[75px] items-center justify-between">
        <a href="/" className="flex items-center gap-3">
          <Image
            src="/logo.png"
            alt="PF24"
            width={40}
            height={40}
            priority
          />

          <div className="text-[1.4rem] font-extrabold">
            PF<span className="text-sky-400">24</span>
          </div>
        </a>

        <div className="flex items-center gap-6">
          <nav className="hidden items-center gap-6 md:flex">
            <a href="/#inicio" className="text-white/80 transition hover:text-white">
              Inicio
            </a>

            <a href="https://discord.gg/DD7yeDDyPY" className="text-white/80 transition hover:text-white">
              Discord
            </a>

            <a href="https://drive.google.com/drive/folders/1WfNHMsjxodzZ2uNCT0-QZHOJV_eBWmxl" className="text-white/80 transition hover:text-white">
              Charts
            </a>

            <a href="https://trello.com/b/CXt0oq24/pf24-espanol-actualizaciones" className="text-white/80 transition hover:text-white">
              Trello
            </a>

            {session && (
              <>
              </>
            )}
          </nav>

          {session ? (
            <a
              href="/dashboard"
              className="rounded-xl border border-sky-400 px-4 py-2 font-medium text-sky-400 transition hover:bg-sky-400 hover:text-white"
            >
              Dashboard
            </a>
          ) : (
            <a
              href="/login"
              className="rounded-xl border border-sky-400 px-4 py-2 font-medium text-sky-400 transition hover:bg-sky-400 hover:text-white"
            >
              Iniciar Sesión
            </a>
          )}
        </div>
      </div>
    </header>
  );
}