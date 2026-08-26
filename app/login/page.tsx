import type { Metadata } from "next";
import { cookies } from "next/headers";
import {
  ROBLOX_IDENTITY_COOKIE,
  decodeRobloxIdentity,
} from "@/lib/robloxIdentity";

export const metadata: Metadata = {
  title: "Login | PF24",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ robloxError?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const cookieStore = await cookies();
  const linkedRoblox = await decodeRobloxIdentity(
    cookieStore.get(ROBLOX_IDENTITY_COOKIE)?.value,
  );

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#050816] px-6 py-12 text-white">
      <section className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900 p-8">
        <div className="text-center">
          <p className="mono text-[10px] tracking-[0.24em] text-sky-300/70">PF24 IDENTITY</p>
          <h1 className="mt-2 text-3xl font-extrabold">Iniciar sesión</h1>
          <p className="mt-4 text-slate-300">
            Vincula tu usuario de Roblox y continúa con Discord. La identidad de Roblox queda disponible para todo PF24.
          </p>
        </div>

        <form method="post" action="/api/pf24/roblox/link" className="mt-8 space-y-4">
          <input type="hidden" name="callbackUrl" value="/dashboard" />

          <label className="block">
            <span className="mono text-[10px] tracking-[0.16em] text-slate-400">USUARIO DE ROBLOX</span>
            <input
              name="robloxUsername"
              required
              minLength={3}
              maxLength={20}
              pattern="[A-Za-z0-9_]{3,20}"
              defaultValue={linkedRoblox?.username ?? ""}
              autoComplete="username"
              placeholder="Tu usuario de Roblox"
              className="mt-2 w-full rounded-2xl border border-white/10 bg-[#020617] px-4 py-3 text-white outline-none transition focus:border-sky-400"
            />
          </label>

          {linkedRoblox && (
            <div className="rounded-2xl border border-green-400/20 bg-green-400/5 px-4 py-3">
              <p className="mono text-[10px] text-green-300/70">ROBLOX VINCULADO</p>
              <p className="mt-1 font-semibold text-green-200">@{linkedRoblox.username}</p>
              <p className="mono mt-1 text-[10px] text-slate-500">USER ID {linkedRoblox.userId}</p>
            </div>
          )}

          {params.robloxError && (
            <div className="rounded-2xl border border-red-400/20 bg-red-400/5 px-4 py-3 text-sm text-red-200">
              No pudimos encontrar ese usuario en Roblox. Revisa el nombre e inténtalo otra vez.
            </div>
          )}

          <button
            type="submit"
            className="w-full rounded-2xl bg-[#5865F2] px-6 py-3 font-semibold text-white transition hover:-translate-y-0.5"
          >
            Validar Roblox y continuar con Discord
          </button>
        </form>

        <p className="mt-4 text-center text-xs leading-5 text-slate-500">
          PF24 consulta el perfil público de Roblox para obtener tu User ID. Nunca te pediremos la contraseña de Roblox.
        </p>

        <div className="mt-6 text-center">
          <a href="/" className="text-sm text-slate-400 hover:text-white">
            Volver al inicio
          </a>
        </div>
      </section>
    </main>
  );
}
