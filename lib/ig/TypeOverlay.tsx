import type { ReactNode } from "react";

/**
 * Tipógrafo da agência: tipografia real sobre fundo IA.
 * Não é FeedCard/anatomia — só zonas flexíveis de texto.
 */
export type TextZone = "bottomBand" | "topStack" | "leftRail" | "centerQuote";

export type TypeOverlayProps = {
  /** data URL ou URL pública da arte (sem texto) */
  backgroundUrl: string;
  headline: string;
  sub?: string;
  zone: TextZone;
  /** texto claro sobre banda escura (default true para contraste) */
  lightText?: boolean;
};

const W = 1080;
const H = 1350;

function lines(text: string) {
  return text.split(/<br\s*\/?>/i).map((l) => l.trim()).filter(Boolean);
}

export function TypeOverlay({ backgroundUrl, headline, sub, zone, lightText = true }: TypeOverlayProps) {
  const ink = lightText ? "#fbf8f3" : "#1a1916";
  const soft = lightText ? "rgba(251,248,243,0.78)" : "rgba(26,25,22,0.65)";
  const band = lightText ? "rgba(20,19,17,0.72)" : "rgba(243,238,230,0.88)";

  const titleBlock = (size: number, maxW: number) => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        fontFamily: "Fraunces",
        fontWeight: 500,
        fontSize: size,
        lineHeight: 1.05,
        letterSpacing: -1.8,
        color: ink,
        maxWidth: maxW,
      }}
    >
      {lines(headline).map((line) => (
        <div key={line} style={{ display: "flex" }}>
          {line}
        </div>
      ))}
    </div>
  );

  const subBlock = (maxW: number) =>
    sub ? (
      <div
        style={{
          display: "flex",
          marginTop: 16,
          fontFamily: "Manrope",
          fontSize: 28,
          lineHeight: 1.35,
          color: soft,
          maxWidth: maxW,
        }}
      >
        {sub}
      </div>
    ) : null;

  let overlay: ReactNode = null;

  if (zone === "bottomBand") {
    overlay = (
      <div
        style={{
          display: "flex",
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          padding: "48px 64px 56px",
          background: band,
          flexDirection: "column",
        }}
      >
        {titleBlock(56, 920)}
        {subBlock(860)}
      </div>
    );
  } else if (zone === "topStack") {
    overlay = (
      <div
        style={{
          display: "flex",
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          padding: "56px 64px 40px",
          background: band,
          flexDirection: "column",
        }}
      >
        {titleBlock(52, 920)}
        {subBlock(860)}
      </div>
    );
  } else if (zone === "leftRail") {
    overlay = (
      <div
        style={{
          display: "flex",
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 460,
          padding: "64px 40px",
          background: band,
          flexDirection: "column",
          justifyContent: "flex-end",
        }}
      >
        {titleBlock(48, 380)}
        {subBlock(360)}
      </div>
    );
  } else {
    // centerQuote
    overlay = (
      <div
        style={{
          display: "flex",
          position: "absolute",
          left: 80,
          right: 80,
          top: 0,
          bottom: 0,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            padding: "48px 52px",
            borderRadius: 28,
            background: band,
            maxWidth: 840,
          }}
        >
          {titleBlock(58, 740)}
          {subBlock(700)}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        width: W,
        height: H,
        position: "relative",
        overflow: "hidden",
        background: "#141311",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse/Satori */}
      <img
        src={backgroundUrl}
        width={W}
        height={H}
        alt=""
        style={{
          display: "flex",
          position: "absolute",
          left: 0,
          top: 0,
          width: W,
          height: H,
          objectFit: "cover",
        }}
      />
      {overlay}
    </div>
  );
}
