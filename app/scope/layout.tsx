import type { ReactNode } from "react";
import ScopeRadarMapV2 from "@/components/scope/ScopeRadarMapV2";

export default function ScopeLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <ScopeRadarMapV2 />
    </>
  );
}
