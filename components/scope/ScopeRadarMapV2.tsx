"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";

type Viewport = { zoom: number; panX: number; panY: number };

const VIEWPORT_KEY = "pf24_scope_radar_viewport_v1";
const VIEWPORT_EVENT = "pf24-radar-viewport";

function readViewport(): Viewport {
  try {
    const parsed = JSON.parse(localStorage.getItem(VIEWPORT_KEY) ?? "{}") as Partial<Viewport>;
    return {
      zoom: typeof parsed.zoom === "number" ? parsed.zoom : 1,
      panX: typeof parsed.panX === "number" ? parsed.panX : 0,
      panY: typeof parsed.panY === "number" ? parsed.panY : 0,
    };
  } catch {
    return { zoom: 1, panX: 0, panY: 0 };
  }
}

function findRadar() {
  return document.querySelector<HTMLElement>("main.fixed > section");
}

const Coast = ({ points }: { points: string }) => (
  <polyline points={points} fill="none" stroke="#666b6e" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
);

const Sector = ({ points }: { points: string }) => (
  <polyline points={points} fill="none" stroke="#007a58" strokeWidth="1.25" vectorEffect="non-scaling-stroke" />
);

const Tma = ({ points }: { points: string }) => (
  <polyline points={points} fill="none" stroke="#005c99" strokeWidth="1.25" strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
);

const Ring = ({ cx, cy, r }: { cx: number; cy: number; r: number }) => (
  <circle cx={cx} cy={cy} r={r} fill="none" stroke="#00619b" strokeWidth="1.25" strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
);

const Label = ({ x, y, children, tone = "grey" }: { x: number; y: number; children: string; tone?: "grey" | "green" | "blue" }) => {
  const fill = tone === "green" ? "#008a63" : tone === "blue" ? "#006ba7" : "#6d7275";
  return <text x={x} y={y} fill={fill} fontSize="8" fontFamily="monospace">{children}</text>;
};

export default function ScopeRadarMapV2() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [viewport, setViewport] = useState<Viewport>({ zoom: 1, panX: 0, panY: 0 });

  useEffect(() => {
    setViewport(readViewport());
    const onViewport = (event: Event) => {
      const detail = (event as CustomEvent<Viewport>).detail;
      if (detail) setViewport(detail);
    };
    window.addEventListener(VIEWPORT_EVENT, onViewport);
    return () => window.removeEventListener(VIEWPORT_EVENT, onViewport);
  }, []);

  useEffect(() => {
    let attempts = 0;
    const locate = () => {
      const radar = findRadar();
      if (radar) {
        setHost(radar);
        window.clearInterval(timer);
      }
      attempts += 1;
      if (attempts >= 20) window.clearInterval(timer);
    };
    const timer = window.setInterval(locate, 200);
    locate();
    return () => window.clearInterval(timer);
  }, []);

  if (!host) return null;

  return createPortal(
    <div
      data-pf24-radar-map-v2="true"
      className="pointer-events-none absolute inset-0 z-[6] overflow-hidden"
      aria-hidden="true"
    >
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1600 760" preserveAspectRatio="none">
        <g
          style={{
            transformBox: "view-box",
            transformOrigin: "0 0",
            transform: `translate(${viewport.panX}px, ${viewport.panY}px) scale(${viewport.zoom})`,
          }}
        >
          {/* Sector framework */}
          <Sector points="50,420 575,420 705,350 930,350 1100,255 1565,255" />
          <Sector points="575,420 575,735" />
          <Sector points="930,350 930,735" />
          <Sector points="705,350 650,235 670,28" />
          <Sector points="930,350 900,235 905,35" />
          <Sector points="670,28 905,35 1195,35 1565,35 1565,255" />
          <Sector points="50,420 50,735 575,735 930,735 1110,735 1370,735 1565,735" />
          <Sector points="930,735 980,485 1100,255" />
          <Sector points="1370,735 1315,485 1190,335" />
          <Sector points="1110,735 1150,535 1190,335" />
          <Sector points="705,350 815,440 930,350" />

          {/* UK / Ireland */}
          <Coast points="780,78 768,92 765,112 756,126 760,143 749,158 752,178 768,192 788,197 800,211 811,204 813,184 827,171 820,152 828,132 820,112 806,102 800,84 780,78" />
          <Coast points="725,123 707,126 697,143 703,160 715,172 731,164 737,148 733,134 725,123" />
          <Tma points="735,145 770,128 816,135 842,162 832,204 793,229 747,216 724,181 735,145" />
          <Tma points="754,156 775,146 810,151 827,174 816,198 786,212 756,200 742,177 754,156" />
          <Label x={748} y={144} tone="blue">LONDON TMA</Label>
          <Label x={776} y={174}>EGKK</Label>
          <Label x={748} y={203}>EGHI</Label>
          <Label x={705} y={166}>EIDW</Label>
          <Label x={820} y={188}>EGLL</Label>

          {/* Cyprus */}
          <Coast points="1112,84 1097,93 1089,110 1093,129 1108,140 1130,138 1145,128 1142,106 1129,91 1112,84" />
          <Tma points="1082,78 1128,70 1162,96 1168,137 1141,162 1097,158 1074,128 1082,78" />
          <Label x={1096} y={117}>LCLK</Label>
          <Label x={1137} y={137}>LCPH</Label>
          <Label x={1082} y={148}>LCRA</Label>

          {/* Dominican Republic / Caribbean */}
          <Coast points="340,505 315,493 286,498 261,516 267,537 293,548 325,544 346,554 366,575 399,580 430,566 448,541 434,520 402,512 372,519 340,505" />
          <Tma points="355,492 410,470 467,489 487,535 462,578 404,596 350,575 327,535 355,492" />
          <Ring cx={417} cy={532} r={45} />
          <Ring cx={417} cy={532} r={27} />
          <Ring cx={314} cy={626} r={22} />
          <Label x={382} y={506} tone="blue">MDPC TMA</Label>
          <Label x={402} y={536}>MDPC</Label>
          <Label x={302} y={632}>MDCR</Label>
          <Label x={454} y={564}>MDST</Label>

          {/* Canary Islands */}
          <Coast points="610,500 593,486 572,493 565,510 577,528 598,531 613,519 610,500" />
          <Ring cx={597} cy={514} r={38} />
          <Ring cx={597} cy={514} r={24} />
          <Tma points="550,477 604,458 650,480 667,527 641,566 584,572 545,536 550,477" />
          <Label x={572} y={491} tone="blue">GCLP TMA</Label>
          <Label x={586} y={518}>GCLP</Label>

          {/* Balearic / Mediterranean */}
          <Coast points="1040,505 1028,493 1012,496 1006,511 1016,527 1034,530 1047,518 1040,505" />
          <Coast points="1128,471 1116,461 1103,466 1101,480 1112,489 1127,485 1133,475 1128,471" />
          <Coast points="1215,427 1191,431 1176,448 1183,463 1206,467 1230,456 1236,441 1215,427" />
          <Tma points="980,471 1048,444 1125,463 1168,513 1148,570 1082,600 1018,579 975,528 980,471" />
          <Ring cx={1040} cy={520} r={43} />
          <Ring cx={1040} cy={520} r={25} />
          <Label x={1010} y={486} tone="blue">LEMH TMA</Label>
          <Label x={1028} y={523}>LEMH</Label>
          <Label x={1102} y={483}>LEPA</Label>

          {/* Northern routes and sector labels */}
          <Label x={660} y={192} tone="green">SCOTTISH FIR</Label>
          <Label x={670} y={210} tone="green">LONDON FIR</Label>
          <Label x={895} y={182} tone="green">NICOSIA FIR</Label>
          <Label x={574} y={408} tone="green">SANTO DOMINGO OCEANIC FIR</Label>
          <Label x={894} y={340} tone="green">CANARIAS FIR</Label>
          <Label x={1090} y={395} tone="green">MADRID FIR</Label>

          {/* Generic fixes / waypoints to give the radar the same cartographic density */}
          {[
            [690,95,"RATSU"],[735,110,"BAKET"],[842,85,"KETTY"],[880,125,"BEREP"],[948,105,"ROSE"],
            [702,232,"LEKGO"],[758,246,"NOKRA"],[804,251,"VAXUK"],[858,246,"DOBRA"],[915,270,"RUBOT"],
            [1000,206,"LINA"],[1060,228,"SASIP"],[1180,235,"RAVO"],[1280,225,"EFIA"],
            [285,470,"BTTR"],[330,548,"ETBOO"],[380,603,"MABID"],[470,593,"MESPA"],[505,540,"KATOK"],
            [540,449,"MUNOL"],[750,430,"BONEK"],[805,463,"DAROS"],[872,470,"ADLAS"],[952,455,"ANETX"],
            [1002,610,"NANNE"],[1175,548,"REMEL"],[1250,505,"KONER"],[1300,448,"RUDER"],
          ].map(([x, y, name]) => <g key={String(name)}>
            <path d={`M${Number(x)-3},${Number(y)+4} L${x},${Number(y)-2} L${Number(x)+3},${Number(y)+4} Z`} fill="none" stroke="#62676a" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            <Label x={Number(x)+5} y={Number(y)+4}>{String(name)}</Label>
          </g>)}
        </g>
      </svg>
    </div>,
    host,
  );
}
