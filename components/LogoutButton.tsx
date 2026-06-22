"use client";

import { signOut } from "next-auth/react";

export default function LogoutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/" })}
      className="inline-block rounded-xl border border-red-400/60 px-4 py-2 text-sm font-medium text-red-300 transition hover:bg-red-400 hover:text-white"
    >
      Cerrar sesión
    </button>
  );
}