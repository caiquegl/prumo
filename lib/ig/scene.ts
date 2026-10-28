/** Scene graph — edição em camadas (mix Aviva editorial + Felipe TI/produto). */

export type SceneFormat = "productDark" | "editorialLight" | "bastidor" | "anatomy";

export type ScenePalette = {
  bg: string;
  ink: string;
  accent: string;
  soft: string;
  band?: string;
};

export type SceneCopy = {
  /** Headline PT — max ~12 palavras */
  headline: string;
  /** Palavra dentro do headline que ganha cor accent / itálico editorial */
  accentWord?: string;
  sub?: string;
  /** Punchline curta (badge Aviva) */
  badge?: string;
  /** Chips estilo UI Felipe */
  chips?: string[];
  /** Meta topo: esquerda / direita */
  metaLeft?: string;
  metaRight?: string;
};

/** Variante interna — mesmo format, hierarquia visual diferente (anti-clone). */
export type SceneVariant =
  | "centerStack"
  | "leftRail"
  | "splitHero"
  | "typeLeft"
  | "typeCenter"
  | "typeOnly"
  | "glassTop"
  | "glassBottom"
  | "listLeft"
  | "listBottom";

export type SceneBrief = {
  format: SceneFormat;
  /** Opcional — variação de layout dentro do mesmo format */
  variant?: SceneVariant;
  palette: ScenePalette;
  copy: SceneCopy;
  /**
   * Como encaixar a arte IA:
   * - fullBleed: foto ocupa o quadro (bastidor)
   * - bottomDevice: mockup na metade inferior (productDark)
   * - sidePhoto: foto à direita (editorial/anatomy)
   * - none: só tipografia + formas
   */
  artRole: "fullBleed" | "bottomDevice" | "sidePhoto" | "none";
};

export const VARIANTS_BY_FORMAT: Record<SceneFormat, SceneVariant[]> = {
  productDark: ["centerStack", "leftRail", "splitHero"],
  editorialLight: ["typeLeft", "typeCenter", "typeOnly"],
  bastidor: ["glassTop", "glassBottom"],
  anatomy: ["listLeft", "listBottom"],
};

export function pickVariant(format: SceneFormat, avoid?: string): SceneVariant {
  const pool = VARIANTS_BY_FORMAT[format];
  const free = pool.filter((v) => v !== avoid);
  const use = free.length ? free : pool;
  return use[Math.floor(Math.random() * use.length)]!;
}

export const FORMATS: SceneFormat[] = ["productDark", "editorialLight", "bastidor", "anatomy"];

export const DEFAULT_PALETTES: Record<SceneFormat, ScenePalette> = {
  productDark: {
    bg: "#0b1220",
    ink: "#f4f7fb",
    accent: "#7dd3fc",
    soft: "rgba(244,247,251,0.72)",
    band: "rgba(8,14,28,0.55)",
  },
  editorialLight: {
    bg: "#f3eee6",
    ink: "#1a2e24",
    accent: "#6b4c9a",
    soft: "rgba(26,46,36,0.62)",
    band: "#1a2e24",
  },
  bastidor: {
    bg: "#141311",
    ink: "#fbf8f3",
    accent: "#c4b5fd",
    soft: "rgba(251,248,243,0.78)",
    band: "rgba(20,19,17,0.55)",
  },
  anatomy: {
    bg: "#efeae2",
    ink: "#161814",
    accent: "#0f766e",
    soft: "rgba(22,24,20,0.65)",
    band: "#161814",
  },
};

export function parseFormat(raw: unknown, avoid?: string): SceneFormat {
  const f = String(raw || "") as SceneFormat;
  if (FORMATS.includes(f) && f !== avoid) return f;
  return FORMATS.find((x) => x !== avoid) || "productDark";
}

export function normalizePalette(format: SceneFormat, raw?: Partial<ScenePalette>): ScenePalette {
  return { ...DEFAULT_PALETTES[format], ...(raw || {}) };
}
