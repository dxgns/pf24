import type { ReactNode } from "react";

export default function ScopeTemplate({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <style>{`
        [data-pf24-radar-map-v2="true"]{z-index:7!important;}
        [data-pf24-mdst-svg="true"],
        [data-pf24-mdab-svg="true"]{z-index:4!important;}
      `}</style>
    </>
  );
}
