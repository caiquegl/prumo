import type { CSSProperties, ReactNode } from "react";
import type { FeedItem } from "./types";

const light = {
  bg: "#f1ebe3",
  ink: "#1b1a18",
  soft: "rgba(27,26,24,0.6)",
  accent: "#e0664f",
  card: "#fbf8f3",
  line: "rgba(27,26,24,0.12)",
  muted: "rgba(27,26,24,0.08)",
};

const dark = {
  bg: "#151412",
  ink: "#f3eee6",
  soft: "rgba(243,238,230,0.6)",
  accent: "#ef7a5f",
  card: "#1f1d1a",
  line: "rgba(243,238,230,0.12)",
  muted: "rgba(243,238,230,0.07)",
};

type Theme = typeof light;

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function lines(text: string) {
  return text.split(/<br\s*\/?>/i);
}

function card(theme: Theme, extra?: CSSProperties): CSSProperties {
  return {
    display: "flex",
    background: theme.card,
    border: `1px solid ${theme.line}`,
    borderRadius: 24,
    ...extra,
  };
}

function Badge({ theme, children }: { theme: Theme; children: ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 56,
        height: 56,
        borderRadius: 16,
        background: theme.accent,
        color: "#fff",
        fontSize: 20,
        fontWeight: 700,
        fontFamily: "Manrope",
        flexShrink: 0,
      }}
    >
      {children}
    </div>
  );
}

function List({ item, theme }: { item: FeedItem; theme: Theme }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", width: 920, gap: 18 }}>
      {(item.items ?? []).map(([t, d], i) => (
        <div key={t} style={card(theme, { width: 450, padding: 28, gap: 16, flexDirection: "column" })}>
          <Badge theme={theme}>{pad2(i + 1)}</Badge>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: -0.2, lineHeight: 1.2 }}>{t}</div>
            <div style={{ marginTop: 8, fontSize: 20, lineHeight: 1.35, color: theme.soft }}>{d}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Flow({ item, theme }: { item: FeedItem; theme: Theme }) {
  const items = item.items ?? [];
  return (
    <div style={{ display: "flex", flexDirection: "column", width: 920 }}>
      {items.map(([t, d], i) => (
        <div key={t} style={{ display: "flex", flexDirection: "column" }}>
          {i > 0 ? (
            <div
              style={{
                width: 4,
                height: 22,
                marginLeft: 54,
                background: theme.accent,
                borderRadius: 4,
              }}
            />
          ) : null}
          <div style={card(theme, { padding: "22px 28px", alignItems: "center", gap: 24 })}>
            <Badge theme={theme}>{pad2(i + 1)}</Badge>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.2 }}>{t}</div>
              <div style={{ marginTop: 6, fontSize: 20, lineHeight: 1.35, color: theme.soft }}>{d}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Compare({ item, theme }: { item: FeedItem; theme: Theme }) {
  const col = (side: { label: string; rows: string[] }, good: boolean) => (
    <div
      style={card(theme, {
        width: 450,
        padding: 28,
        flexDirection: "column",
        background: good ? theme.ink : theme.card,
        color: good ? theme.bg : theme.ink,
        borderColor: good ? "transparent" : theme.line,
      })}
    >
      <div
        style={{
          fontSize: 18,
          letterSpacing: 2.2,
          textTransform: "uppercase",
          fontWeight: 700,
          color: good ? theme.accent : theme.soft,
          fontFamily: "Manrope",
        }}
      >
        {side.label}
      </div>
      {side.rows.map((r) => (
        <div
          key={r}
          style={{
            display: "flex",
            gap: 14,
            alignItems: "center",
            marginTop: 16,
            paddingTop: 16,
            borderTop: `1px solid ${good ? "rgba(127,127,127,0.25)" : theme.line}`,
          }}
        >
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              background: good ? theme.accent : theme.muted,
              color: good ? "#fff" : theme.soft,
              fontWeight: 700,
              fontSize: 16,
            }}
          >
            {good ? "✓" : "✕"}
          </div>
          <div style={{ fontSize: 22, fontWeight: 600, lineHeight: 1.25 }}>{r}</div>
        </div>
      ))}
    </div>
  );
  return (
    <div style={{ display: "flex", width: 920, gap: 20 }}>
      {item.left ? col(item.left, false) : null}
      {item.right ? col(item.right, true) : null}
    </div>
  );
}

function Checklist({ item, theme }: { item: FeedItem; theme: Theme }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", width: 920, gap: 16 }}>
      {(item.items ?? []).map(([t, d]) => (
        <div key={t} style={card(theme, { padding: "20px 28px", alignItems: "center", gap: 22 })}>
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: 23,
              background: theme.accent,
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: 22,
              flexShrink: 0,
            }}
          >
            ✓
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.2 }}>{t}</div>
            {d ? <div style={{ marginTop: 6, fontSize: 20, lineHeight: 1.35, color: theme.soft }}>{d}</div> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

export function FeedCard({ item, inverted = false }: { item: FeedItem; inverted?: boolean }) {
  const theme = inverted ? dark : light;
  const body =
    item.layout === "list" ? (
      <List item={item} theme={theme} />
    ) : item.layout === "flow" ? (
      <Flow item={item} theme={theme} />
    ) : item.layout === "compare" ? (
      <Compare item={item} theme={theme} />
    ) : (
      <Checklist item={item} theme={theme} />
    );

  return (
    <div
      style={{
        width: 1080,
        height: 1350,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: theme.bg,
        color: theme.ink,
        fontFamily: "Manrope",
        padding: "64px 80px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 24, color: theme.soft }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, color: theme.ink, fontWeight: 600 }}>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: theme.accent,
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "Fraunces",
              fontSize: 18,
            }}
          >
            P
          </div>
          Prumo Web
        </div>
        @prumo.web
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        <div
          style={{
            fontSize: 22,
            letterSpacing: 3.2,
            textTransform: "uppercase",
            color: theme.accent,
            fontWeight: 700,
          }}
        >
          {item.kicker}
        </div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: 16, fontFamily: "Fraunces", fontWeight: 500, fontSize: 72, lineHeight: 0.98, letterSpacing: -1.6 }}>
          {lines(item.title).map((line) => (
            <div key={line}>{line}</div>
          ))}
        </div>
        {item.sub ? (
          <div style={{ marginTop: 18, fontSize: 28, lineHeight: 1.35, color: theme.soft, maxWidth: 860 }}>{item.sub}</div>
        ) : null}
      </div>

      <div style={{ display: "flex" }}>{body}</div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 40 }}>
        <div
          style={{
            fontFamily: "Fraunces",
            fontWeight: 500,
            fontSize: 40,
            lineHeight: 1.05,
            letterSpacing: -0.6,
            maxWidth: 600,
          }}
        >
          {plainHeadline(item.headline)}
        </div>
        <div style={{ display: "flex", flexDirection: "column", fontSize: 22, lineHeight: 1.4, color: theme.soft, textAlign: "right", alignItems: "flex-end" }}>
          <div>Orçamento no WhatsApp</div>
          <div style={{ color: theme.ink, fontWeight: 700 }}>(11) 96633-1995</div>
          <div>@prumo.web</div>
        </div>
      </div>
    </div>
  );
}

function plainHeadline(s: string) {
  return s.replace(/<br\s*\/?>/gi, " ");
}
