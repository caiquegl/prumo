import type { CSSProperties } from "react";
import type { FeedItem, Visual } from "./types";
import { Visual as Art } from "./Visual";

const light = {
  bg: "#f3eee6",
  ink: "#1a1916",
  soft: "rgba(26,25,22,0.52)",
  accent: "#d4573e",
  card: "#fbf8f3",
  line: "rgba(26,25,22,0.1)",
  muted: "rgba(26,25,22,0.08)",
};

const dark = {
  bg: "#141311",
  ink: "#f3eee6",
  soft: "rgba(243,238,230,0.55)",
  accent: "#ef7a5f",
  card: "#1e1c19",
  line: "rgba(243,238,230,0.12)",
  muted: "rgba(243,238,230,0.08)",
};

type Theme = typeof light;

function lines(text: string) {
  return text.split(/<br\s*\/?>/i);
}

function Brand({ theme, lightText = false }: { theme: Theme; lightText?: boolean }) {
  const c = lightText ? "rgba(255,255,255,0.7)" : theme.soft;
  const ink = lightText ? "#fff" : theme.ink;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", fontSize: 22, color: c }}>
      <div style={{ display: "flex", alignItems: "center", color: ink, fontWeight: 600 }}>
        <div
          style={{
            display: "flex",
            width: 28,
            height: 28,
            borderRadius: 8,
            background: theme.accent,
            color: "#fff",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "Fraunces",
            fontSize: 16,
            marginRight: 12,
          }}
        >
          P
        </div>
        <div style={{ display: "flex" }}>Prumo Web</div>
      </div>
      <div style={{ display: "flex" }}>@prumo.web</div>
    </div>
  );
}

function Title({ text, size = 88, color }: { text: string; size?: number; color: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", fontFamily: "Fraunces", fontWeight: 500, fontSize: size, lineHeight: 0.95, letterSpacing: -2.2, color }}>
      {lines(text).map((line) => (
        <div key={line} style={{ display: "flex" }}>
          {line}
        </div>
      ))}
    </div>
  );
}

function Kicker({ text, color }: { text: string; color: string }) {
  return (
    <div style={{ display: "flex", fontSize: 18, letterSpacing: 3.2, textTransform: "uppercase", color, fontWeight: 700 }}>{text}</div>
  );
}

function Phone({ color, dim }: { color: string; dim: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", fontSize: 18, color: dim, alignItems: "flex-end" }}>
      <div style={{ display: "flex", color, fontWeight: 700 }}>(11) 96633-1995</div>
      <div style={{ display: "flex" }}>WhatsApp</div>
    </div>
  );
}

function Scene({ item, theme, w, h }: { item: FeedItem; theme: Theme; w: number; h: number }) {
  const kind = (item.visual || "mark") as Visual;
  if (item.photoUrl) {
    return (
      <div style={{ display: "flex", width: w, height: h, overflow: "hidden", borderRadius: 36, background: theme.card }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse/Satori */}
        <img
          src={item.photoUrl}
          width={w}
          height={h}
          alt=""
          style={{ display: "flex", width: w, height: h, objectFit: "cover" }}
        />
      </div>
    );
  }
  return (
    <div style={{ display: "flex", width: w, height: h, overflow: "hidden", borderRadius: 36, background: theme.card }}>
      <Art kind={kind} accent={theme.accent} ink={theme.ink} muted={theme.muted} w={w} h={h} />
    </div>
  );
}

function Hero({ item, theme }: { item: FeedItem; theme: Theme }) {
  const photo = Boolean(item.photoUrl);
  return (
    <div style={frame(theme)}>
      <Brand theme={theme} />
      <div style={{ display: "flex", flex: 1, marginTop: 24, overflow: "hidden", borderRadius: 36 }}>
        <Scene item={item} theme={theme} w={920} h={photo ? 880 : 780} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 28 }}>
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 760 }}>
          <Kicker text={item.kicker} color={theme.accent} />
          <div style={{ display: "flex", marginTop: 8 }}>
            <Title text={item.title} size={photo ? 64 : 72} color={theme.ink} />
          </div>
        </div>
        <Phone color={theme.ink} dim={theme.soft} />
      </div>
    </div>
  );
}

/** Peça de venda: tipografia/CTA perfeitos + arte IA só no miolo (sem @/logo gerados pela IA). */
function Offer({ item, theme }: { item: FeedItem; theme: Theme }) {
  return (
    <div style={frame(theme)}>
      <Brand theme={theme} />
      <div style={{ display: "flex", flexDirection: "column", marginTop: 28, maxWidth: 920 }}>
        <Kicker text={item.kicker} color={theme.accent} />
        <div style={{ display: "flex", marginTop: 10 }}>
          <Title text={item.title} size={58} color={theme.ink} />
        </div>
        {item.sub || item.hook ? (
          <div style={{ display: "flex", marginTop: 14, fontSize: 26, lineHeight: 1.35, color: theme.soft, maxWidth: 860 }}>
            {item.sub || item.hook}
          </div>
        ) : null}
      </div>
      <div style={{ display: "flex", flex: 1, marginTop: 28, overflow: "hidden", borderRadius: 32 }}>
        <Scene item={item} theme={theme} w={920} h={620} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 28 }}>
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 620 }}>
          <div style={{ display: "flex", fontFamily: "Fraunces", fontSize: 34, letterSpacing: -0.6, lineHeight: 1.15, color: theme.ink }}>
            {item.headline || "Seu próximo projeto pode começar aqui."}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", fontSize: 18, color: theme.soft }}>
          <div style={{ display: "flex" }}>Orçamento no WhatsApp</div>
          <div style={{ display: "flex", marginTop: 4, color: theme.ink, fontWeight: 700 }}>(11) 96633-1995</div>
        </div>
      </div>
    </div>
  );
}

function Quote({ item, theme }: { item: FeedItem; theme: Theme }) {
  return (
    <div style={{ ...frame(theme), background: theme.ink, color: theme.bg }}>
      <Brand theme={theme} lightText />
      <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center" }}>
        <Kicker text={item.kicker} color={theme.accent} />
        <div style={{ display: "flex", marginTop: 32 }}>
          <Title text={item.title} size={96} color="#fff" />
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Phone color="#fff" dim="rgba(255,255,255,0.65)" />
      </div>
    </div>
  );
}

function Stat({ item, theme }: { item: FeedItem; theme: Theme }) {
  return (
    <div style={frame(theme)}>
      <Brand theme={theme} />
      <div style={{ display: "flex", flexDirection: "column", marginTop: 36 }}>
        <Kicker text={item.kicker} color={theme.accent} />
        <div style={{ display: "flex", marginTop: 12 }}>
          <Title text={item.title} size={64} color={theme.ink} />
        </div>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          flex: 1,
          marginTop: 36,
          padding: "56px 60px",
          borderRadius: 40,
          background: theme.ink,
          color: theme.bg,
        }}
      >
        <div style={{ display: "flex", fontFamily: "Fraunces", fontSize: 180, lineHeight: 0.82, letterSpacing: -8 }}>{item.stat?.value}</div>
        <div style={{ display: "flex", marginTop: 28, fontSize: 30, color: "rgba(255,255,255,0.68)", maxWidth: 640 }}>{item.stat?.label}</div>
      </div>
    </div>
  );
}

function Split({ item, theme }: { item: FeedItem; theme: Theme }) {
  return (
    <div style={frame(theme)}>
      <Brand theme={theme} />
      <div style={{ display: "flex", flexDirection: "column", marginTop: 28 }}>
        <Kicker text={item.kicker} color={theme.accent} />
        <div style={{ display: "flex", marginTop: 10 }}>
          <Title text={item.title} size={70} color={theme.ink} />
        </div>
      </div>
      <div style={{ display: "flex", marginTop: 32, flex: 1 }}>
        <Scene item={item} theme={theme} w={540} h={780} />
        <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center", marginLeft: 28 }}>
          {(item.items ?? []).slice(0, 3).map(([t], i) => (
            <div key={t} style={{ display: "flex", flexDirection: "column", marginBottom: 28 }}>
              <div style={{ display: "flex", fontFamily: "Fraunces", fontSize: 40, color: theme.accent, lineHeight: 1 }}>{String(i + 1).padStart(2, "0")}</div>
              <div style={{ display: "flex", marginTop: 6, fontSize: 32, fontWeight: 700, letterSpacing: -0.5, lineHeight: 1.15 }}>{t}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Cards({ item, theme }: { item: FeedItem; theme: Theme }) {
  return (
    <div style={frame(theme)}>
      <Brand theme={theme} />
      <div style={{ display: "flex", flexDirection: "column", marginTop: 28 }}>
        <Kicker text={item.kicker} color={theme.accent} />
        <div style={{ display: "flex", marginTop: 10 }}>
          <Title text={item.title} size={70} color={theme.ink} />
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", marginTop: 36, flex: 1, justifyContent: "flex-end" }}>
        {(item.items ?? []).slice(0, 3).map(([t]) => (
          <div
            key={t}
            style={{
              display: "flex",
              alignItems: "center",
              padding: "34px 40px",
              borderRadius: 28,
              background: theme.card,
              marginBottom: 20,
            }}
          >
            <div style={{ display: "flex", width: 10, height: 48, borderRadius: 6, background: theme.accent, marginRight: 28 }} />
            <div style={{ display: "flex", fontFamily: "Fraunces", fontSize: 40, letterSpacing: -0.8, lineHeight: 1.1 }}>{t}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Compare({ item, theme }: { item: FeedItem; theme: Theme }) {
  const col = (side: { label: string; rows: string[] }, good: boolean) => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: 450,
        padding: 40,
        borderRadius: 32,
        background: good ? theme.ink : theme.card,
        color: good ? theme.bg : theme.ink,
        flex: 1,
      }}
    >
      <div
        style={{
          display: "flex",
          fontSize: 16,
          letterSpacing: 2.6,
          textTransform: "uppercase",
          fontWeight: 700,
          color: good ? theme.accent : theme.soft,
        }}
      >
        {side.label}
      </div>
      {side.rows.slice(0, 3).map((r) => (
        <div key={r} style={{ display: "flex", marginTop: 32, fontFamily: "Fraunces", fontSize: 32, letterSpacing: -0.4, lineHeight: 1.15 }}>
          {r}
        </div>
      ))}
    </div>
  );
  return (
    <div style={frame(theme)}>
      <Brand theme={theme} />
      <div style={{ display: "flex", flexDirection: "column", marginTop: 28 }}>
        <Kicker text={item.kicker} color={theme.accent} />
        <div style={{ display: "flex", marginTop: 10 }}>
          <Title text={item.title} size={70} color={theme.ink} />
        </div>
      </div>
      <div style={{ display: "flex", marginTop: 40, flex: 1, alignItems: "stretch" }}>
        {item.left ? col(item.left, false) : null}
        <div style={{ display: "flex", width: 20 }} />
        {item.right ? col(item.right, true) : null}
      </div>
    </div>
  );
}

function frame(theme: Theme): CSSProperties {
  return {
    width: 1080,
    height: 1350,
    display: "flex",
    flexDirection: "column",
    background: theme.bg,
    color: theme.ink,
    fontFamily: "Manrope",
    padding: "48px 80px 44px",
  };
}

export function FeedCard({ item, inverted = false }: { item: FeedItem; inverted?: boolean }) {
  const theme = inverted && item.layout !== "quote" ? dark : light;
  if (item.layout === "offer") return <Offer item={item} theme={theme} />;
  if (item.layout === "hero") return <Hero item={item} theme={theme} />;
  if (item.layout === "quote") return <Quote item={item} theme={theme} />;
  if (item.layout === "stat") return <Stat item={item} theme={theme} />;
  if (item.layout === "split") return <Split item={item} theme={theme} />;
  if (item.layout === "cards") return <Cards item={item} theme={theme} />;
  return <Compare item={item} theme={theme} />;
}
