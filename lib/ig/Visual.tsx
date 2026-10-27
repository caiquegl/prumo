import type { Visual } from "./types";

export function Visual({
  kind,
  accent,
  ink,
  muted,
  w = 920,
  h = 720,
}: {
  kind: Visual;
  accent: string;
  ink: string;
  muted: string;
  w?: number;
  h?: number;
}) {
  const art =
    kind === "wire" ? (
      <Wire accent={accent} ink={ink} muted={muted} w={w} h={h} />
    ) : kind === "chart" ? (
      <Chart accent={accent} ink={ink} muted={muted} w={w} h={h} />
    ) : kind === "cloud" ? (
      <Cloud accent={accent} ink={ink} muted={muted} w={w} h={h} />
    ) : kind === "mark" ? (
      <Mark accent={accent} w={w} h={h} />
    ) : (
      <Leaves accent={accent} ink={ink} w={w} h={h} />
    );
  return <div style={{ display: "flex", width: w, height: h }}>{art}</div>;
}

function Leaves({ accent, ink, w, h }: { accent: string; ink: string; w: number; h: number }) {
  return (
    <svg width={w} height={h} viewBox="0 0 920 780">
      <rect width="920" height="780" fill="#e7d7c4" />
      <circle cx="780" cy="90" r="280" fill={accent} opacity="0.22" />
      <circle cx="840" cy="500" r="200" fill={ink} opacity="0.08" />
      <path d="M-20 820 C 80 420 340 120 700 20 C 480 210 320 460 40 820 Z" fill={ink} opacity="0.88" />
      <path d="M140 820 C 210 500 430 200 760 70 C 540 280 400 530 180 820 Z" fill={accent} opacity="0.55" />
      <path d="M300 820 C 350 560 520 320 760 180 C 580 400 470 590 320 820 Z" fill={accent} />
      <path d="M40 20 C 240 70 320 240 280 380 C 170 200 70 90 40 20 Z" fill={accent} opacity="0.4" />
      <circle cx="620" cy="640" r="18" fill="#fff" opacity="0.7" />
    </svg>
  );
}

function Wire({ accent, ink, muted, w, h }: { accent: string; ink: string; muted: string; w: number; h: number }) {
  return (
    <svg width={w} height={h} viewBox="0 0 920 780">
      <rect width="920" height="780" fill="#efe6db" />
      <rect x="80" y="90" width="760" height="600" rx="32" fill="#fff" stroke={ink} strokeOpacity="0.1" strokeWidth="2" />
      <rect x="80" y="90" width="760" height="70" fill={muted} />
      <circle cx="128" cy="125" r="8" fill={accent} />
      <circle cx="156" cy="125" r="8" fill={ink} opacity="0.18" />
      <circle cx="184" cy="125" r="8" fill={ink} opacity="0.18" />
      <rect x="130" y="210" width="280" height="32" rx="8" fill={ink} opacity="0.88" />
      <rect x="130" y="260" width="420" height="16" rx="8" fill={ink} opacity="0.18" />
      <rect x="130" y="290" width="340" height="16" rx="8" fill={ink} opacity="0.1" />
      <rect x="130" y="360" width="210" height="250" rx="22" fill={accent} />
      <rect x="360" y="360" width="210" height="250" rx="22" fill={muted} />
      <rect x="590" y="360" width="210" height="250" rx="22" fill={ink} opacity="0.12" />
    </svg>
  );
}

function Chart({ accent, ink, muted, w, h }: { accent: string; ink: string; muted: string; w: number; h: number }) {
  return (
    <svg width={w} height={h} viewBox="0 0 920 780">
      <rect width="920" height="780" fill="#efe6db" />
      <rect x="70" y="80" width="780" height="620" rx="36" fill="#fff" />
      <rect x="150" y="470" width="78" height="150" rx="14" fill={muted} />
      <rect x="268" y="380" width="78" height="240" rx="14" fill={muted} />
      <rect x="386" y="280" width="78" height="340" rx="14" fill={accent} opacity="0.45" />
      <rect x="504" y="180" width="78" height="440" rx="14" fill={accent} />
      <rect x="622" y="320" width="78" height="300" rx="14" fill={ink} opacity="0.18" />
      <rect x="740" y="240" width="78" height="380" rx="14" fill={ink} opacity="0.55" />
      <circle cx="780" cy="150" r="58" fill={accent} />
    </svg>
  );
}

function Cloud({ accent, ink, muted, w, h }: { accent: string; ink: string; muted: string; w: number; h: number }) {
  return (
    <svg width={w} height={h} viewBox="0 0 920 780">
      <rect width="920" height="780" fill="#e4ddd3" />
      <circle cx="180" cy="480" r="170" fill={muted} />
      <circle cx="380" cy="380" r="210" fill={ink} opacity="0.1" />
      <circle cx="580" cy="450" r="190" fill={muted} />
      <circle cx="730" cy="300" r="140" fill={accent} opacity="0.38" />
      <circle cx="470" cy="250" r="130" fill={accent} />
      <rect x="140" y="450" width="620" height="160" rx="80" fill={ink} opacity="0.1" />
    </svg>
  );
}

function Mark({ accent, w, h }: { accent: string; w: number; h: number }) {
  return (
    <svg width={w} height={h} viewBox="0 0 920 780">
      <rect width="920" height="780" fill="#ead9cc" />
      <circle cx="460" cy="390" r="280" fill={accent} opacity="0.14" />
      <circle cx="460" cy="390" r="190" fill={accent} opacity="0.22" />
      <rect x="378" y="210" width="164" height="340" rx="32" fill={accent} />
      <path d="M378 280 L542 550" stroke="#fff" strokeWidth="30" strokeLinecap="round" />
    </svg>
  );
}
