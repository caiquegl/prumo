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
      <div style={{ display: "flex" }}>@web.prumo</div>
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

function Footer({ item, theme }: { item: FeedItem; theme: Theme }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 28 }}>
      <div style={{ display: "flex", flexDirection: "column", maxWidth: 580 }}>
        <div style={{ display: "flex", fontFamily: "Fraunces", fontSize: 34, letterSpacing: -0.6, lineHeight: 1.15, color: theme.ink }}>
          {item.headline || "Seu próximo projeto pode começar aqui."}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", fontSize: 18, color: theme.soft }}>
        <div style={{ display: "flex" }}>Orçamento no WhatsApp</div>
        <div style={{ display: "flex", marginTop: 4, color: theme.ink, fontWeight: 700 }}>(11) 96633-1995</div>
      </div>
    </div>
  );
}

function HeaderBlock({ item, theme, titleSize = 56 }: { item: FeedItem; theme: Theme; titleSize?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", marginTop: 28, maxWidth: 920 }}>
      <Kicker text={item.kicker} color={theme.accent} />
      <div style={{ display: "flex", marginTop: 10 }}>
        <Title text={item.title} size={titleSize} color={theme.ink} />
      </div>
      {item.sub || item.hook ? (
        <div style={{ display: "flex", marginTop: 14, fontSize: 24, lineHeight: 1.35, color: theme.soft, maxWidth: 860 }}>
          {item.sub || item.hook}
        </div>
      ) : null}
    </div>
  );
}

function PhoneMock({ theme }: { theme: Theme }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: 280,
        height: 520,
        borderRadius: 36,
        background: theme.ink,
        padding: 14,
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", flex: 1, borderRadius: 28, background: theme.card, overflow: "hidden" }}>
        <div style={{ display: "flex", height: 90, background: theme.accent, padding: "18px 20px", flexDirection: "column" }}>
          <div style={{ display: "flex", height: 10, width: 120, background: "rgba(255,255,255,0.85)", borderRadius: 4 }} />
          <div style={{ display: "flex", height: 8, width: 80, background: "rgba(255,255,255,0.45)", borderRadius: 4, marginTop: 10 }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", padding: 16, flex: 1 }}>
          <div style={{ display: "flex", height: 48, background: theme.muted, borderRadius: 12, marginBottom: 12 }} />
          <div style={{ display: "flex", height: 48, background: theme.muted, borderRadius: 12, marginBottom: 12 }} />
          <div style={{ display: "flex", height: 48, background: theme.muted, borderRadius: 12, marginBottom: 12 }} />
          <div style={{ display: "flex", flex: 1 }} />
          <div
            style={{
              display: "flex",
              height: 44,
              borderRadius: 12,
              background: theme.accent,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div style={{ display: "flex", height: 8, width: 90, background: "rgba(255,255,255,0.9)", borderRadius: 4 }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Scene({ item, theme, w, h }: { item: FeedItem; theme: Theme; w: number; h: number }) {
  const kind = (item.visual || "mark") as Visual;
  if (item.photoUrl) {
    return (
      <div style={{ display: "flex", width: w, height: h, overflow: "hidden", borderRadius: 36, background: theme.card }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse/Satori */}
        <img src={item.photoUrl} width={w} height={h} alt="" style={{ display: "flex", width: w, height: h, objectFit: "cover" }} />
      </div>
    );
  }
  return (
    <div style={{ display: "flex", width: w, height: h, overflow: "hidden", borderRadius: 36, background: theme.card }}>
      <Art kind={kind} accent={theme.accent} ink={theme.ink} muted={theme.muted} w={w} h={h} />
    </div>
  );
}

/** Anatomia de single page — mock + lista numerada */
function Anatomy({ item, theme }: { item: FeedItem; theme: Theme }) {
  const steps = (item.items ?? []).slice(0, 6);
  return (
    <div style={frame(theme)}>
      <Brand theme={theme} />
      <HeaderBlock item={item} theme={theme} titleSize={52} />
      <div style={{ display: "flex", flex: 1, marginTop: 28, alignItems: "center" }}>
        <PhoneMock theme={theme} />
        <div style={{ display: "flex", flexDirection: "column", flex: 1, marginLeft: 36 }}>
          {steps.map(([t, d], i) => (
            <div key={`${i}-${t}`} style={{ display: "flex", flexDirection: "column", marginBottom: 18 }}>
              <div style={{ display: "flex", alignItems: "baseline" }}>
                <div style={{ display: "flex", fontFamily: "Fraunces", fontSize: 28, color: theme.accent, marginRight: 14 }}>
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div style={{ display: "flex", fontSize: 26, fontWeight: 700, letterSpacing: -0.4 }}>{t}</div>
              </div>
              {d ? (
                <div style={{ display: "flex", marginTop: 4, marginLeft: 42, fontSize: 20, color: theme.soft, lineHeight: 1.3 }}>{d}</div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
      <Footer item={item} theme={theme} />
    </div>
  );
}

/** Performance — barras + nota + checks */
function Perf({ item, theme }: { item: FeedItem; theme: Theme }) {
  const bars = item.bars?.length
    ? item.bars.slice(0, 3)
    : [
        { label: "Site comum", value: "4,8s", pct: 85 },
        { label: "Site Prumo", value: "0,9s", pct: 22, accent: true },
      ];
  const checks = item.checks?.length
    ? item.checks.slice(0, 3)
    : (item.items ?? []).slice(0, 3).map(([t, d]) => ({ title: t, detail: d || "" }));
  const score = item.score || { value: "100", label: "NOTA DE DESEMPENHO" };

  return (
    <div style={frame(theme)}>
      <Brand theme={theme} />
      <HeaderBlock item={item} theme={theme} titleSize={52} />
      <div style={{ display: "flex", flexDirection: "column", marginTop: 28, padding: 28, borderRadius: 28, background: theme.card }}>
        <div style={{ display: "flex", fontSize: 16, letterSpacing: 2.4, fontWeight: 700, color: theme.soft, textTransform: "uppercase" }}>
          Tempo até a página aparecer
        </div>
        {bars.map((b) => (
          <div key={b.label} style={{ display: "flex", flexDirection: "column", marginTop: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 22, marginBottom: 8 }}>
              <div style={{ display: "flex" }}>{b.label}</div>
              <div style={{ display: "flex", fontWeight: 700, color: b.accent ? theme.accent : theme.ink }}>{b.value}</div>
            </div>
            <div style={{ display: "flex", height: 18, borderRadius: 10, background: theme.muted, overflow: "hidden" }}>
              <div
                style={{
                  display: "flex",
                  width: `${Math.max(8, Math.min(100, b.pct))}%`,
                  height: 18,
                  background: b.accent ? theme.accent : "rgba(26,25,22,0.28)",
                  borderRadius: 10,
                }}
              />
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", marginTop: 24, flex: 1 }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: 220,
            alignItems: "center",
            justifyContent: "center",
            marginRight: 24,
          }}
        >
          <div
            style={{
              display: "flex",
              width: 160,
              height: 160,
              borderRadius: 80,
              border: `8px solid #3d9a6a`,
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "Fraunces",
              fontSize: 56,
              color: theme.ink,
            }}
          >
            {score.value}
          </div>
          <div style={{ display: "flex", marginTop: 12, fontSize: 14, letterSpacing: 1.6, fontWeight: 700, color: theme.soft }}>{score.label}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: 28, borderRadius: 28, background: theme.card }}>
          {checks.map((c) => (
            <div key={c.title} style={{ display: "flex", flexDirection: "column", marginBottom: 18 }}>
              <div style={{ display: "flex", alignItems: "center" }}>
                <div style={{ display: "flex", width: 18, height: 18, borderRadius: 9, background: theme.accent, marginRight: 12 }} />
                <div style={{ display: "flex", fontSize: 24, fontWeight: 700 }}>{c.title}</div>
              </div>
              {c.detail ? (
                <div style={{ display: "flex", marginTop: 6, marginLeft: 30, fontSize: 18, color: theme.soft, lineHeight: 1.3 }}>{c.detail}</div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
      <Footer item={item} theme={theme} />
    </div>
  );
}

/** Hub de integrações */
function Hub({ item, theme }: { item: FeedItem; theme: Theme }) {
  const nodes = (item.hubNodes?.length ? item.hubNodes : (item.items ?? []).map(([t]) => t)).slice(0, 8);
  const top = nodes.slice(0, Math.ceil(nodes.length / 2));
  const bottom = nodes.slice(Math.ceil(nodes.length / 2));
  const center = item.hubCenter || "Seu site\nou sistema";

  const pill = (label: string) => (
    <div
      key={label}
      style={{
        display: "flex",
        alignItems: "center",
        padding: "14px 22px",
        borderRadius: 999,
        background: "#fff",
        margin: 8,
        boxShadow: "0 8px 24px rgba(26,25,22,0.08)",
      }}
    >
      <div style={{ display: "flex", width: 10, height: 10, borderRadius: 5, background: theme.accent, marginRight: 12 }} />
      <div style={{ display: "flex", fontSize: 22, fontWeight: 600 }}>{label}</div>
    </div>
  );

  return (
    <div style={frame(theme)}>
      <Brand theme={theme} />
      <HeaderBlock item={item} theme={theme} titleSize={48} />
      <div style={{ display: "flex", flexDirection: "column", flex: 1, alignItems: "center", justifyContent: "center", marginTop: 12 }}>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", maxWidth: 900 }}>{top.map(pill)}</div>
        <div
          style={{
            display: "flex",
            width: 280,
            height: 280,
            borderRadius: 140,
            background: theme.ink,
            alignItems: "center",
            justifyContent: "center",
            marginTop: 18,
            marginBottom: 18,
            padding: 28,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontFamily: "Fraunces",
              fontSize: 36,
              color: "#fff",
              textAlign: "center",
              lineHeight: 1.1,
              alignItems: "center",
            }}
          >
            {lines(center).map((l) => (
              <div key={l} style={{ display: "flex" }}>
                {l}
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", maxWidth: 900 }}>{bottom.map(pill)}</div>
      </div>
      <Footer item={item} theme={theme} />
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
        <div style={{ display: "flex", flexDirection: "column", fontSize: 18, color: theme.soft, alignItems: "flex-end" }}>
          <div style={{ display: "flex", color: theme.ink, fontWeight: 700 }}>(11) 96633-1995</div>
          <div style={{ display: "flex" }}>WhatsApp</div>
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
          <Title text={item.title} size={84} color="#fff" />
        </div>
        {item.sub || item.hook ? (
          <div style={{ display: "flex", marginTop: 24, fontSize: 28, color: "rgba(255,255,255,0.65)", maxWidth: 800, lineHeight: 1.35 }}>
            {item.sub || item.hook}
          </div>
        ) : null}
      </div>
      <Footer item={{ ...item, headline: item.headline || "Chame no WhatsApp." }} theme={{ ...theme, ink: "#fff", soft: "rgba(255,255,255,0.65)" }} />
    </div>
  );
}

function Stat({ item, theme }: { item: FeedItem; theme: Theme }) {
  return (
    <div style={frame(theme)}>
      <Brand theme={theme} />
      <HeaderBlock item={item} theme={theme} />
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
        <div style={{ display: "flex", fontFamily: "Fraunces", fontSize: 160, lineHeight: 0.82, letterSpacing: -8 }}>{item.stat?.value}</div>
        <div style={{ display: "flex", marginTop: 28, fontSize: 30, color: "rgba(255,255,255,0.68)", maxWidth: 640 }}>{item.stat?.label}</div>
      </div>
      <Footer item={item} theme={theme} />
    </div>
  );
}

function Split({ item, theme }: { item: FeedItem; theme: Theme }) {
  return (
    <div style={frame(theme)}>
      <Brand theme={theme} />
      <HeaderBlock item={item} theme={theme} titleSize={52} />
      <div style={{ display: "flex", marginTop: 28, flex: 1 }}>
        <PhoneMock theme={theme} />
        <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center", marginLeft: 36 }}>
          {(item.items ?? []).slice(0, 4).map(([t, d], i) => (
            <div key={t} style={{ display: "flex", flexDirection: "column", marginBottom: 26 }}>
              <div style={{ display: "flex", fontFamily: "Fraunces", fontSize: 36, color: theme.accent, lineHeight: 1 }}>
                {String(i + 1).padStart(2, "0")}
              </div>
              <div style={{ display: "flex", marginTop: 6, fontSize: 30, fontWeight: 700, letterSpacing: -0.5, lineHeight: 1.15 }}>{t}</div>
              {d ? <div style={{ display: "flex", marginTop: 6, fontSize: 20, color: theme.soft }}>{d}</div> : null}
            </div>
          ))}
        </div>
      </div>
      <Footer item={item} theme={theme} />
    </div>
  );
}

function Cards({ item, theme }: { item: FeedItem; theme: Theme }) {
  return (
    <div style={frame(theme)}>
      <Brand theme={theme} />
      <HeaderBlock item={item} theme={theme} titleSize={52} />
      <div style={{ display: "flex", flexDirection: "column", marginTop: 28, flex: 1, justifyContent: "flex-end" }}>
        {(item.items ?? []).slice(0, 4).map(([t, d]) => (
          <div
            key={t}
            style={{
              display: "flex",
              flexDirection: "column",
              padding: "28px 36px",
              borderRadius: 28,
              background: theme.card,
              marginBottom: 16,
            }}
          >
            <div style={{ display: "flex", alignItems: "center" }}>
              <div style={{ display: "flex", width: 10, height: 40, borderRadius: 6, background: theme.accent, marginRight: 24 }} />
              <div style={{ display: "flex", fontFamily: "Fraunces", fontSize: 34, letterSpacing: -0.6 }}>{t}</div>
            </div>
            {d ? <div style={{ display: "flex", marginTop: 8, marginLeft: 34, fontSize: 20, color: theme.soft }}>{d}</div> : null}
          </div>
        ))}
      </div>
      <Footer item={item} theme={theme} />
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
        padding: 36,
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
      {side.rows.slice(0, 4).map((r) => (
        <div key={r} style={{ display: "flex", marginTop: 28, fontFamily: "Fraunces", fontSize: 30, letterSpacing: -0.4, lineHeight: 1.15 }}>
          {r}
        </div>
      ))}
    </div>
  );
  return (
    <div style={frame(theme)}>
      <Brand theme={theme} />
      <HeaderBlock item={item} theme={theme} titleSize={52} />
      <div style={{ display: "flex", marginTop: 32, flex: 1, alignItems: "stretch" }}>
        {item.left ? col(item.left, false) : null}
        <div style={{ display: "flex", width: 20 }} />
        {item.right ? col(item.right, true) : null}
      </div>
      <Footer item={item} theme={theme} />
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
  if (item.layout === "anatomy") return <Anatomy item={item} theme={theme} />;
  if (item.layout === "perf") return <Perf item={item} theme={theme} />;
  if (item.layout === "hub") return <Hub item={item} theme={theme} />;
  if (item.layout === "hero") return <Hero item={item} theme={theme} />;
  if (item.layout === "quote") return <Quote item={item} theme={theme} />;
  if (item.layout === "stat") return <Stat item={item} theme={theme} />;
  if (item.layout === "split") return <Split item={item} theme={theme} />;
  if (item.layout === "cards") return <Cards item={item} theme={theme} />;
  if (item.layout === "offer") return <Hero item={item} theme={theme} />;
  return <Compare item={item} theme={theme} />;
}
