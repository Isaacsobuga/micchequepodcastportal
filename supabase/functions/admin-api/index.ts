import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MEDIA_BUCKET = "media";
const MB = 1024 * 1024;

const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};
const VIDEO_TYPES: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
};

const UPLOAD_KINDS: Record<string, { folder: string; types: Record<string, string>; maxBytes: number }> = {
  "event-poster": { folder: "events", types: IMAGE_TYPES, maxBytes: 10 * MB },
  "event-video": { folder: "events", types: VIDEO_TYPES, maxBytes: 50 * MB },
  "merch-image": { folder: "merch", types: IMAGE_TYPES, maxBytes: 10 * MB },
  "episode-cover": { folder: "episodes", types: IMAGE_TYPES, maxBytes: 10 * MB },
};

const EVENT_STATUSES = ["scheduled", "live", "completed", "cancelled"];
const MEDIA_TYPES = ["image", "video"];

type TableName = "events" | "episodes" | "merchandise";
type Row = Record<string, unknown>;

const MEDIA_FIELDS: Record<TableName, string[]> = {
  events: ["media_url", "video_url"],
  episodes: ["thumbnail_url"],
  merchandise: ["image_url"],
};

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function mediaPrefix(): string {
  return `${Deno.env.get("SUPABASE_URL") ?? ""}/storage/v1/object/public/${MEDIA_BUCKET}/`;
}

function adminClient(): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function requiredText(value: unknown, label: string, max: number): string {
  const s = typeof value === "string" ? value.trim() : "";
  if (!s) throw new HttpError(400, `${label} is required.`);
  if (s.length > max) throw new HttpError(400, `${label} must be ${max} characters or fewer.`);
  return s;
}

function optionalText(value: unknown, label: string, max: number): string {
  const s = typeof value === "string" ? value.trim() : "";
  if (s.length > max) throw new HttpError(400, `${label} must be ${max} characters or fewer.`);
  return s;
}

function optionalHttpUrl(value: unknown, label: string): string | null {
  const s = optionalText(value, label, 2000);
  if (!s) return null;
  let url: URL;
  try {
    url = new URL(s);
  } catch {
    throw new HttpError(400, `${label} must be a full web address starting with https://.`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new HttpError(400, `${label} must start with https://.`);
  }
  return url.toString();
}

function uploadedMediaUrl(value: unknown, label: string): string | null {
  const s = optionalText(value, label, 2000);
  if (!s) return null;
  if (!s.startsWith(mediaPrefix())) throw new HttpError(400, `${label} must be an uploaded file.`);
  return s;
}

function isoDate(value: unknown, label: string): string {
  const s = typeof value === "string" ? value : "";
  const time = Date.parse(s);
  if (!s || Number.isNaN(time)) throw new HttpError(400, `${label} must be a valid date and time.`);
  return new Date(time).toISOString();
}

function oneOf(value: unknown, allowed: string[], label: string): string {
  if (typeof value !== "string" || !allowed.includes(value)) throw new HttpError(400, `${label} is not valid.`);
  return value;
}

function parseYoutubeId(input: string): string | null {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.replace(/^(www\.|m\.)/, "");
  let id: string | null = null;
  if (host === "youtu.be") {
    id = url.pathname.slice(1).split("/")[0] ?? null;
  } else if (host === "youtube.com") {
    if (url.pathname === "/watch") {
      id = url.searchParams.get("v");
    } else {
      const match = url.pathname.match(/^\/(shorts|embed|live)\/([^/?#]+)/);
      id = match ? match[2] : null;
    }
  }
  return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
}

async function youtubeThumbnail(id: string): Promise<string> {
  const maxres = `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`;
  try {
    const res = await fetch(maxres, { method: "HEAD" });
    if (res.ok) return maxres;
  } catch (err) {
    console.error("maxresdefault lookup failed", err);
  }
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

async function sanitizeEvent(d: Row): Promise<Row> {
  const starts_at = isoDate(d.starts_at, "Start time");
  const ends_at = isoDate(d.ends_at, "End time");
  if (Date.parse(ends_at) <= Date.parse(starts_at)) {
    throw new HttpError(400, "End time must be after the start time.");
  }
  const actionUrl = optionalHttpUrl(d.action_url, "Button link");
  return {
    title: requiredText(d.title, "Title", 200),
    description: optionalText(d.description, "Description", 4000),
    venue: optionalText(d.venue, "Venue", 200),
    starts_at,
    ends_at,
    status: oneOf(d.status, EVENT_STATUSES, "Status"),
    media_type: oneOf(d.media_type ?? "image", MEDIA_TYPES, "Media type"),
    media_url: uploadedMediaUrl(d.media_url, "Poster image"),
    video_url: uploadedMediaUrl(d.video_url, "Event video"),
    action_label: optionalText(d.action_label, "Button label", 60) || null,
    action_url: actionUrl,
    is_featured: d.is_featured === true,
    is_published: d.is_published === true,
  };
}

async function sanitizeEpisode(d: Row): Promise<Row> {
  const youtubeUrl = requiredText(d.youtube_url, "YouTube link", 2000);
  const videoId = parseYoutubeId(youtubeUrl);
  if (!videoId) throw new HttpError(400, "That YouTube link is not recognised. Use a watch, youtu.be or Shorts link.");
  const custom = uploadedMediaUrl(d.thumbnail_url, "Cover image");
  const isPublished = d.is_published === true;
  const publishedAt = typeof d.published_at === "string" && d.published_at ? isoDate(d.published_at, "Publish date") : null;
  return {
    title: requiredText(d.title, "Title", 200),
    description: optionalText(d.description, "Description", 4000),
    guest_names: optionalText(d.guest_names, "Guests", 300),
    youtube_url: `https://www.youtube.com/watch?v=${videoId}`,
    youtube_video_id: videoId,
    thumbnail_url: custom ?? (await youtubeThumbnail(videoId)),
    is_featured: d.is_featured === true,
    is_published: isPublished,
    published_at: isPublished ? (publishedAt ?? new Date().toISOString()) : publishedAt,
  };
}

function sanitizeMerch(d: Row): Row {
  const externalUrl = optionalHttpUrl(d.external_url, "Shop link");
  if (!externalUrl) throw new HttpError(400, "A shop link is required.");
  return {
    name: requiredText(d.name, "Name", 200),
    description: optionalText(d.description, "Description", 4000),
    price_text: optionalText(d.price_text, "Price", 60) || null,
    external_url: externalUrl,
    image_url: uploadedMediaUrl(d.image_url, "Product image"),
    is_featured: d.is_featured === true,
    is_published: d.is_published === true,
  };
}

async function sanitize(table: TableName, d: Row): Promise<Row> {
  if (table === "events") return await sanitizeEvent(d);
  if (table === "episodes") return await sanitizeEpisode(d);
  return sanitizeMerch(d);
}

function parseTable(value: unknown): TableName {
  if (value === "events" || value === "episodes" || value === "merchandise") return value;
  throw new HttpError(400, "Unknown content type.");
}

async function requireAdmin(db: SupabaseClient, token: unknown): Promise<void> {
  if (typeof token !== "string" || token.length !== 64) {
    throw new HttpError(401, "Your admin session has ended. Please sign in again.");
  }
  const { data, error } = await db.rpc("admin_session_valid", { p_token: token });
  if (error) throw error;
  if (data !== true) throw new HttpError(401, "Your admin session has ended. Please sign in again.");
}

async function login(db: SupabaseClient, password: unknown): Promise<string> {
  if (typeof password !== "string" || password.length === 0 || password.length > 200) {
    throw new HttpError(400, "Enter the admin password.");
  }
  const { data, error } = await db.rpc("admin_create_session", { p_password: password });
  if (error) {
    if (error.message.includes("Too many attempts")) throw new HttpError(429, error.message);
    throw error;
  }
  if (typeof data !== "string" || data.length !== 64) throw new HttpError(401, "Incorrect password.");
  return data;
}

async function isMediaReferenced(db: SupabaseClient, url: string): Promise<boolean> {
  const checks = [
    db.from("events").select("id", { count: "exact", head: true }).eq("media_url", url),
    db.from("events").select("id", { count: "exact", head: true }).eq("video_url", url),
    db.from("episodes").select("id", { count: "exact", head: true }).eq("thumbnail_url", url),
    db.from("merchandise").select("id", { count: "exact", head: true }).eq("image_url", url),
  ];
  const results = await Promise.all(checks);
  return results.some(({ error, count }) => {
    if (error) throw error;
    return (count ?? 0) > 0;
  });
}

async function removeUnusedMedia(db: SupabaseClient, urls: unknown[]): Promise<void> {
  const prefix = mediaPrefix();
  for (const url of urls) {
    if (typeof url !== "string" || !url.startsWith(prefix)) continue;
    if (await isMediaReferenced(db, url)) continue;
    const path = url.slice(prefix.length);
    const { error } = await db.storage.from(MEDIA_BUCKET).remove([path]);
    if (error) console.error("media cleanup failed", path, error.message);
  }
}

async function listRows(db: SupabaseClient, table: TableName): Promise<Row[]> {
  const { data, error } = await db.from(table).select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

async function saveRow(db: SupabaseClient, table: TableName, id: string | null, input: Row): Promise<Row> {
  const payload = { ...(await sanitize(table, input)), updated_at: new Date().toISOString() };

  let previous: Row | null = null;
  if (id) {
    const { data, error } = await db.from(table).select(MEDIA_FIELDS[table].join(",")).eq("id", id).maybeSingle();
    if (error) throw error;
    if (!data) throw new HttpError(404, "This item no longer exists. Refresh the list and try again.");
    previous = data as unknown as Row;
  }

  const query = id
    ? db.from(table).update(payload).eq("id", id)
    : db.from(table).insert(payload);
  const { data, error } = await query.select("*").single();
  if (error) throw error;

  if (previous) {
    const replaced = MEDIA_FIELDS[table]
      .filter((field) => previous[field] && previous[field] !== payload[field])
      .map((field) => previous[field]);
    await removeUnusedMedia(db, replaced);
  }
  return data as Row;
}

async function deleteRow(db: SupabaseClient, table: TableName, id: string): Promise<void> {
  const { data, error: readError } = await db
    .from(table)
    .select(MEDIA_FIELDS[table].join(","))
    .eq("id", id)
    .maybeSingle();
  if (readError) throw readError;
  if (!data) throw new HttpError(404, "This item was already deleted.");

  const { error } = await db.from(table).delete().eq("id", id);
  if (error) throw error;

  await removeUnusedMedia(db, MEDIA_FIELDS[table].map((f) => (data as unknown as Row)[f]));
}

function matchesSignature(bytes: Uint8Array, mime: string): boolean {
  const startsWith = (sig: number[], offset = 0) => sig.every((b, i) => bytes[offset + i] === b);
  switch (mime) {
    case "image/jpeg":
      return startsWith([0xff, 0xd8, 0xff]);
    case "image/png":
      return startsWith([0x89, 0x50, 0x4e, 0x47]);
    case "image/gif":
      return startsWith([0x47, 0x49, 0x46, 0x38]);
    case "image/webp":
      return startsWith([0x52, 0x49, 0x46, 0x46]) && startsWith([0x57, 0x45, 0x42, 0x50], 8);
    case "video/mp4":
      return startsWith([0x66, 0x74, 0x79, 0x70], 4);
    case "video/webm":
      return startsWith([0x1a, 0x45, 0xdf, 0xa3]);
    default:
      return false;
  }
}

async function uploadMedia(db: SupabaseClient, form: FormData): Promise<{ url: string }> {
  const kind = UPLOAD_KINDS[String(form.get("kind") ?? "")];
  if (!kind) throw new HttpError(400, "Unknown upload type.");

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) throw new HttpError(400, "Choose a file to upload.");
  if (file.size > kind.maxBytes) {
    throw new HttpError(413, `That file is too large. The limit is ${Math.round(kind.maxBytes / MB)} MB.`);
  }
  const ext = kind.types[file.type];
  if (!ext) throw new HttpError(400, "That file type is not allowed for this upload.");

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!matchesSignature(bytes, file.type)) {
    throw new HttpError(400, "That file does not look like a valid " + file.type.split("/")[0] + " file.");
  }

  const path = `${kind.folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await db.storage.from(MEDIA_BUCKET).upload(path, bytes, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw error;
  return { url: mediaPrefix() + path };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const db = adminClient();
    const contentType = req.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      await requireAdmin(db, form.get("token"));
      return json(await uploadMedia(db, form));
    }

    const body = (await req.json()) as Row;
    const action = String(body.action ?? "");

    if (action === "login") return json({ token: await login(db, body.password) });

    if (action === "logout") {
      if (typeof body.token === "string" && body.token.length === 64) {
        const { error } = await db.rpc("admin_end_session", { p_token: body.token });
        if (error) throw error;
      }
      return json({ ok: true });
    }

    await requireAdmin(db, body.token);

    if (action === "verify") return json({ ok: true });

    const table = parseTable(body.table);

    if (action === "list") return json({ rows: await listRows(db, table) });

    if (action === "save") {
      const data = body.data && typeof body.data === "object" ? (body.data as Row) : null;
      if (!data) throw new HttpError(400, "Nothing to save.");
      const id = typeof body.id === "string" && body.id ? body.id : null;
      return json({ row: await saveRow(db, table, id, data) });
    }

    if (action === "delete") {
      if (typeof body.id !== "string" || !body.id) throw new HttpError(400, "Nothing to delete.");
      await deleteRow(db, table, body.id);
      return json({ ok: true });
    }

    if (action === "set-published") {
      if (typeof body.id !== "string" || !body.id) throw new HttpError(400, "Nothing to update.");
      const published = body.published === true;
      const now = new Date().toISOString();
      const { data, error } = await db
        .from(table)
        .update({ is_published: published, updated_at: now })
        .eq("id", body.id)
        .select("id");
      if (error) throw error;
      if (!data?.length) throw new HttpError(404, "This item no longer exists. Refresh the list and try again.");
      if (table === "episodes" && published) {
        const { error: dateError } = await db
          .from("episodes")
          .update({ published_at: now })
          .eq("id", body.id)
          .is("published_at", null);
        if (dateError) throw dateError;
      }
      return json({ ok: true });
    }

    throw new HttpError(400, "Unknown request.");
  } catch (err) {
    if (err instanceof HttpError) return json({ error: err.message }, err.status);
    console.error("admin-api failed", err);
    return json({ error: "Something went wrong on the server. Please try again." }, 500);
  }
});
