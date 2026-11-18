/**
 * Cria o container da Evolution API (WhatsApp) na Render via REST API.
 * (O MCP da Render não cria serviço a partir de imagem Docker; o MCP serve para logs/deploys/envs depois.)
 *
 *   RENDER_API_KEY=... npx tsx --env-file=.env.local scripts/render-evolution.mts [--dry-run]
 *
 * - Imagem fixa: evoapicloud/evolution-api:v2.3.7 (não segue o main)
 * - Plano starter (sempre ligado: a sessão do WhatsApp não pode dormir) + disco 1 GB p/ chaves da sessão
 * - Banco: Neon do prumo (conexão direta, schema separado `evolution_api`), salvando só a instância
 * - AUTHENTICATION_API_KEY gerada pela Render; depois copie para EVOLUTION_API_KEY no .env.local
 */
const API = "https://api.render.com/v1";
const key = process.env.RENDER_API_KEY?.trim();
if (!key) throw new Error("RENDER_API_KEY ausente (dashboard.render.com → Account Settings → API Keys)");
const dry = process.argv.includes("--dry-run");
const NAME = process.env.EVOLUTION_SERVICE_NAME || "prumo-whatsapp";
const IMAGE = "docker.io/evoapicloud/evolution-api:v2.3.7";

const h = { Authorization: `Bearer ${key}`, "content-type": "application/json", accept: "application/json" };
async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  if (!res.ok) throw new Error(`Render ${method} ${path} → ${res.status}: ${text.slice(0, 400)}`);
  return (text ? JSON.parse(text) : {}) as T;
}

// Neon: conexão direta (sem -pooler) — o Prisma da Evolution roda migrations no boot.
const raw = process.env.DATABASE_URL?.replace(/^"|"$/g, "");
if (!raw) throw new Error("DATABASE_URL ausente");
const db = new URL(raw);
db.hostname = db.hostname.replace("-pooler", "");
db.searchParams.set("sslmode", "require");
db.searchParams.set("schema", "evolution_api");

const owners = await api<Array<{ owner: { id: string; name: string; type: string } }>>("GET", "/owners?limit=20");
const owner = owners[0]?.owner;
if (!owner) throw new Error("nenhum workspace na Render");

const existing = await api<Array<{ service: { id: string; name: string; serviceDetails?: { url?: string } } }>>(
  "GET",
  `/services?name=${encodeURIComponent(NAME)}&limit=5`,
);
if (existing.some((s) => s.service.name === NAME)) {
  const s = existing.find((x) => x.service.name === NAME)!.service;
  console.log(`já existe: ${s.name} (${s.id}) ${s.serviceDetails?.url ?? ""}`);
  process.exit(0);
}

const env: Array<{ key: string; value?: string; generateValue?: boolean }> = [
  { key: "PORT", value: "8080" },
  { key: "SERVER_PORT", value: "8080" },
  { key: "SERVER_TYPE", value: "http" },
  { key: "SERVER_URL", value: `https://${NAME}.onrender.com` },
  { key: "AUTHENTICATION_API_KEY", generateValue: true },
  { key: "AUTHENTICATION_EXPOSE_IN_FETCH_INSTANCES", value: "false" },
  { key: "DATABASE_ENABLED", value: "true" },
  { key: "DATABASE_PROVIDER", value: "postgresql" },
  { key: "DATABASE_CONNECTION_URI", value: db.toString() },
  { key: "DATABASE_CONNECTION_CLIENT_NAME", value: "evolution_render" },
  // só a instância/credenciais; nada de histórico de mensagens/contatos no banco
  { key: "DATABASE_SAVE_DATA_INSTANCE", value: "true" },
  { key: "DATABASE_SAVE_DATA_NEW_MESSAGE", value: "false" },
  { key: "DATABASE_SAVE_MESSAGE_UPDATE", value: "false" },
  { key: "DATABASE_SAVE_DATA_CONTACTS", value: "false" },
  { key: "DATABASE_SAVE_DATA_CHATS", value: "false" },
  { key: "DATABASE_SAVE_DATA_LABELS", value: "false" },
  { key: "DATABASE_SAVE_DATA_HISTORIC", value: "false" },
  { key: "CACHE_REDIS_ENABLED", value: "false" },
  { key: "CACHE_LOCAL_ENABLED", value: "true" },
  { key: "CONFIG_SESSION_PHONE_CLIENT", value: "Web Prumo" },
  { key: "CONFIG_SESSION_PHONE_NAME", value: "Chrome" },
  { key: "DEL_INSTANCE", value: "false" },
  { key: "TELEMETRY_ENABLED", value: "false" },
  { key: "LOG_LEVEL", value: "ERROR,WARN,INFO" },
  { key: "LANGUAGE", value: "pt-BR" },
  { key: "TZ", value: "America/Sao_Paulo" },
];

const body = {
  type: "web_service",
  name: NAME,
  ownerId: owner.id,
  image: { ownerId: owner.id, imagePath: IMAGE },
  envVars: env,
  autoDeployTrigger: "off",
  serviceDetails: {
    runtime: "image",
    plan: "starter",
    region: "virginia",
    numInstances: 1,
    healthCheckPath: "/",
    disk: { name: "evolution-instances", mountPath: "/evolution/instances", sizeGB: 1 },
  },
};

if (dry) {
  const safe = { ...body, envVars: env.map((e) => (e.key === "DATABASE_CONNECTION_URI" ? { ...e, value: "***" } : e)) };
  console.log(`workspace: ${owner.name} (${owner.id})`);
  console.log(JSON.stringify(safe, null, 2));
  process.exit(0);
}

const created = await api<{ service?: { id: string; serviceDetails?: { url?: string } }; id?: string }>("POST", "/services", body);
const svc = created.service ?? (created as { id: string; serviceDetails?: { url?: string } });
console.log(`criado: ${NAME} (${svc.id}) ${svc.serviceDetails?.url ?? `https://${NAME}.onrender.com`}`);
console.log("Pegue a AUTHENTICATION_API_KEY gerada em Environment e grave EVOLUTION_URL/EVOLUTION_API_KEY no .env.local.");
