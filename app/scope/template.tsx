import type { ReactNode } from "react";
import ScopeMdpcAirportLayer from "@/components/scope/ScopeMdpcAirportLayer";
import ScopeGclpIsland from "@/components/scope/ScopeGclpIsland";
import ScopeEgkkIsland from "@/components/scope/ScopeEgkkIsland";
import ScopeMapFilterCorrections from "@/components/scope/ScopeMapFilterCorrections";

export default function ScopeTemplate({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <ScopeMapFilterCorrections />
      <ScopeGclpIsland />
      <ScopeEgkkIsland />
      <ScopeMdpcAirportLayer />
      <style>{`
        [data-pf24-radar-map-v2="true"]{z-index:7!important;}
        [data-pf24-mdst-svg="true"],
        [data-pf24-mdab-svg="true"],
        [data-pf24-mdpc-svg-layer="true"]{z-index:4!important;}
        [data-pf24-vector-map="true"] [data-map-layer="mdpc-corrected-svg"],
        [data-pf24-vector-map="true"] [data-map-layer="mdpc-svg-labels-upright"]{display:none!important;}
      `}</style>
    </>
  );
}
