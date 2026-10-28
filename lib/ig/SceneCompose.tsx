import type { ReactNode } from "react";
import type { SceneBrief, SceneCopy, ScenePalette } from "./scene";

const W = 1080;
const H = 1350;

function splitAccent(text: string, accentWord?: string): Array<{ t: string; accent: boolean }> {
  if (!accentWord) return [{ t: text, accent: false }];
  const i = text.toLowerCase().indexOf(accentWord.toLowerCase());
  if (i < 0) return [{ t: text, accent: false }];
  const before = text.slice(0, i);
  const mid = text.slice(i, i + accentWord.length);
  const after = text.slice(i + accentWord.length);
  return [
    ...(before ? [{ t: before, accent: false }] : []),
    { t: mid, accent: true },
    ...(after ? [{ t: after, accent: false }] : []),
  ];
}

function Headline({
  copy,
  palette,
  size,
  maxW,
  align = "left",
}: {
  copy: SceneCopy;
  palette: ScenePalette;
  size: number;
  maxW: number;
  align?: "left" | "center";
}) {
  const parts = splitAccent(copy.headline, copy.accentWord);
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: align === "center" ? "center" : "flex-start",
        fontFamily: "Fraunces",
        fontWeight: 500,
        fontSize: size,
        lineHeight: 1.08,
        letterSpacing: -1.6,
        color: palette.ink,
        maxWidth: maxW,
        textAlign: align,
      }}
    >
      {parts.map((p, idx) => (
        <div key={`${idx}-${p.t}`} style={{ display: "flex", color: p.accent ? palette.accent : palette.ink }}>
          {p.t}
        </div>
      ))}
    </div>
  );
}

function Sub({ copy, palette, maxW, align = "left" }: { copy: SceneCopy; palette: ScenePalette; maxW: number; align?: "left" | "center" }) {
  if (!copy.sub) return null;
  return (
    <div
      style={{
        display: "flex",
        marginTop: 18,
        fontFamily: "Manrope",
        fontSize: 28,
        fontWeight: 600,
        lineHeight: 1.35,
        color: palette.soft,
        maxWidth: maxW,
        textAlign: align,
        justifyContent: align === "center" ? "center" : "flex-start",
      }}
    >
      {copy.sub}
    </div>
  );
}

function Chips({ items, ink, border }: { items: string[]; ink: string; border: string }) {
  if (!items.length) return null;
  return (
    <div style={{ display: "flex", flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 28 }}>
      {items.slice(0, 4).map((c) => (
        <div
          key={c}
          style={{
            display: "flex",
            padding: "10px 22px",
            borderRadius: 999,
            border: `1.5px solid ${border}`,
            color: ink,
            fontFamily: "Manrope",
            fontSize: 22,
            fontWeight: 600,
          }}
        >
          {c}
        </div>
      ))}
    </div>
  );
}

function MetaBar({ left, right, color }: { left?: string; right?: string; color: string }) {
  return (
    <div
      style={{
        display: "flex",
        width: "100%",
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        fontFamily: "Manrope",
        fontSize: 20,
        fontWeight: 600,
        letterSpacing: 2,
        textTransform: "uppercase" as const,
        color,
        opacity: 0.7,
      }}
    >
      <div style={{ display: "flex" }}>{left || "PRUMO WEB"}</div>
      <div style={{ display: "flex" }}>{"//"}</div>
      <div style={{ display: "flex" }}>{right || "TI · LANDING"}</div>
    </div>
  );
}

function BrandMark({ color }: { color: string }) {
  return (
    <div
      style={{
        display: "flex",
        fontFamily: "Manrope",
        fontSize: 26,
        fontWeight: 700,
        letterSpacing: 4,
        color,
        opacity: 0.9,
      }}
    >
      PRUMO
    </div>
  );
}

function ArtImg({
  src,
  style,
}: {
  src: string;
  style: Record<string, string | number>;
}) {
  // eslint-disable-next-line @next/next/no-img-element -- ImageResponse/Satori
  return <img src={src} alt="" style={{ display: "flex", ...style }} />;
}

function productDark(brief: SceneBrief, artUrl?: string): ReactNode {
  const { palette: p, copy } = brief;
  return (
    <div style={{ display: "flex", width: W, height: H, position: "relative", background: p.bg, overflow: "hidden" }}>
      {/* glow */}
      <div
        style={{
          display: "flex",
          position: "absolute",
          right: -120,
          top: -80,
          width: 520,
          height: 520,
          borderRadius: 999,
          background: "rgba(56,189,248,0.18)",
        }}
      />
      <div
        style={{
          display: "flex",
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          flexDirection: "column",
          padding: "56px 64px 0",
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 36 }}>
          <BrandMark color={p.ink} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <Headline copy={copy} palette={p} size={64} maxW={900} align="center" />
          <Sub copy={copy} palette={p} maxW={820} align="center" />
          <Chips items={copy.chips || ["Landing page", "Single page", "WhatsApp"]} ink={p.ink} border="rgba(244,247,251,0.35)" />
        </div>
      </div>
      {artUrl && brief.artRole !== "none" ? (
        <ArtImg
          src={artUrl}
          style={{
            position: "absolute",
            left: 90,
            right: 90,
            bottom: -40,
            width: 900,
            height: 620,
            objectFit: "cover",
            borderRadius: 28,
          }}
        />
      ) : null}
    </div>
  );
}

function editorialLight(brief: SceneBrief, artUrl?: string): ReactNode {
  const { palette: p, copy } = brief;
  return (
    <div style={{ display: "flex", width: W, height: H, position: "relative", background: p.bg, overflow: "hidden" }}>
      {/* circles Aviva-like */}
      <div
        style={{
          display: "flex",
          position: "absolute",
          left: 180,
          top: 220,
          width: 720,
          height: 720,
          borderRadius: 999,
          border: "1.5px solid rgba(26,46,36,0.12)",
        }}
      />
      <div
        style={{
          display: "flex",
          position: "absolute",
          left: 280,
          top: 320,
          width: 520,
          height: 520,
          borderRadius: 999,
          border: "1.5px solid rgba(26,46,36,0.08)",
        }}
      />
      <div style={{ display: "flex", position: "absolute", left: 56, right: 56, top: 48 }}>
        <MetaBar left={copy.metaLeft} right={copy.metaRight} color={p.ink} />
      </div>
      <div
        style={{
          display: "flex",
          position: "absolute",
          left: 72,
          right: artUrl && brief.artRole === "sidePhoto" ? 420 : 72,
          top: 0,
          bottom: 0,
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        <Headline copy={copy} palette={p} size={68} maxW={artUrl ? 560 : 900} />
        <Sub copy={copy} palette={p} maxW={520} />
        {copy.badge ? (
          <div
            style={{
              display: "flex",
              marginTop: 36,
              alignSelf: "flex-start",
              background: p.band || p.ink,
              color: "#f3eee6",
              padding: "14px 26px",
              borderRadius: 10,
              fontFamily: "Manrope",
              fontSize: 26,
              fontWeight: 700,
            }}
          >
            {copy.badge}
          </div>
        ) : null}
      </div>
      {artUrl && brief.artRole === "sidePhoto" ? (
        <ArtImg
          src={artUrl}
          style={{
            position: "absolute",
            right: -40,
            top: 280,
            width: 460,
            height: 720,
            objectFit: "cover",
            borderRadius: 24,
          }}
        />
      ) : null}
      <div
        style={{
          display: "flex",
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 48,
          justifyContent: "center",
        }}
      >
        <BrandMark color={p.ink} />
      </div>
    </div>
  );
}

function bastidor(brief: SceneBrief, artUrl?: string): ReactNode {
  const { palette: p, copy } = brief;
  return (
    <div style={{ display: "flex", width: W, height: H, position: "relative", background: p.bg, overflow: "hidden" }}>
      {artUrl ? (
        <ArtImg src={artUrl} style={{ position: "absolute", left: 0, top: 0, width: W, height: H, objectFit: "cover" }} />
      ) : null}
      {/* glass card */}
      <div
        style={{
          display: "flex",
          position: "absolute",
          left: 64,
          right: 64,
          top: 64,
          padding: "22px 28px",
          borderRadius: 22,
          background: "rgba(255,255,255,0.14)",
          border: "1px solid rgba(255,255,255,0.22)",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontFamily: "Manrope", fontSize: 26, fontWeight: 700, color: p.ink }}>Prumo Web</div>
          <div style={{ display: "flex", fontFamily: "Manrope", fontSize: 20, color: p.soft, marginTop: 4 }}>
            {copy.metaRight || "Sites · Landing · Single page"}
          </div>
        </div>
        <BrandMark color={p.ink} />
      </div>
      <div
        style={{
          display: "flex",
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          padding: "48px 64px 64px",
          background: `linear-gradient(180deg, transparent 0%, ${p.band || "rgba(0,0,0,0.7)"} 45%)`,
          flexDirection: "column",
        }}
      >
        <Headline copy={copy} palette={p} size={56} maxW={920} />
        <Sub copy={copy} palette={p} maxW={860} />
      </div>
    </div>
  );
}

function anatomy(brief: SceneBrief, artUrl?: string): ReactNode {
  const { palette: p, copy } = brief;
  const chips = copy.chips?.length ? copy.chips : ["Hero claro", "Prova social", "CTA WhatsApp"];
  return (
    <div style={{ display: "flex", width: W, height: H, position: "relative", background: p.bg, overflow: "hidden" }}>
      <div style={{ display: "flex", position: "absolute", left: 56, right: 56, top: 48 }}>
        <MetaBar left={copy.metaLeft || "ANATOMIA"} right={copy.metaRight || "SINGLE PAGE"} color={p.ink} />
      </div>
      <div
        style={{
          display: "flex",
          position: "absolute",
          left: 64,
          top: 140,
          width: artUrl ? 520 : 920,
          flexDirection: "column",
        }}
      >
        <Headline copy={copy} palette={p} size={54} maxW={500} />
        <Sub copy={copy} palette={p} maxW={480} />
        <div style={{ display: "flex", flexDirection: "column", marginTop: 40, gap: 16 }}>
          {chips.slice(0, 5).map((c, i) => (
            <div key={c} style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 14 }}>
              <div
                style={{
                  display: "flex",
                  width: 36,
                  height: 36,
                  borderRadius: 999,
                  background: p.accent,
                  color: "#fff",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "Manrope",
                  fontSize: 18,
                  fontWeight: 700,
                }}
              >
                {String(i + 1).padStart(2, "0")}
              </div>
              <div style={{ display: "flex", fontFamily: "Manrope", fontSize: 28, fontWeight: 600, color: p.ink }}>
                {c}
              </div>
            </div>
          ))}
        </div>
      </div>
      {artUrl ? (
        <ArtImg
          src={artUrl}
          style={{
            position: "absolute",
            right: -30,
            top: 200,
            width: 520,
            height: 980,
            objectFit: "cover",
            borderRadius: 32,
          }}
        />
      ) : null}
    </div>
  );
}

export function SceneCompose({ brief, artUrl }: { brief: SceneBrief; artUrl?: string }) {
  switch (brief.format) {
    case "editorialLight":
      return editorialLight(brief, artUrl);
    case "bastidor":
      return bastidor(brief, artUrl);
    case "anatomy":
      return anatomy(brief, artUrl);
    case "productDark":
    default:
      return productDark(brief, artUrl);
  }
}
