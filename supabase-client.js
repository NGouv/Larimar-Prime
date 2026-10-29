let clientPromise;
let publicClientPromise;
let createClientPromise;

function createSupabaseClient(auth) {
  return fetch("/api/config")
    .then(async (response) => {
      let config;
      try {
        config = await response.json();
      } catch {
        if (response.status === 404 &&
            ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname)) {
          throw new Error(
            "A rota /api/config não está disponível. O Live Server serve arquivos estáticos e não executa funções da Vercel. Use `vercel dev` com SUPABASE_URL e SUPABASE_ANON_KEY configuradas localmente."
          );
        }
        throw new Error(`A configuração do Supabase não respondeu corretamente (HTTP ${response.status}).`);
      }
      if (!response.ok) {
        throw new Error(config.error || "Não foi possível carregar a configuração do Supabase.");
      }
      if (!config.url || !config.anonKey) {
        throw new Error("A configuração pública do Supabase está incompleta.");
      }
      if (!createClientPromise) {
        createClientPromise = import("https://esm.sh/@supabase/supabase-js@2")
          .then((module) => module.createClient)
          .catch(() => {
            createClientPromise = undefined;
            throw new Error("Não foi possível carregar o cliente do Supabase. Verifique a conexão e tente novamente.");
          });
      }
      return createClientPromise.then((createClient) =>
        createClient(config.url, config.anonKey, { auth })
      );
    });
}

export function getSupabase() {
  if (!clientPromise) {
    clientPromise = createSupabaseClient({
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    })
      .catch((error) => {
        clientPromise = undefined;
        throw error;
      });
  }

  return clientPromise;
}

export function getPublicSupabase() {
  if (!publicClientPromise) {
    publicClientPromise = createSupabaseClient({
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    })
      .catch((error) => {
        publicClientPromise = undefined;
        throw error;
      });
  }

  return publicClientPromise;
}

export async function createImageUrlMap(supabase, paths) {
  const uniquePaths = [...new Set(paths.filter(Boolean))];
  if (!uniquePaths.length) return new Map();

  const { data, error } = await supabase.storage
    .from("property-images")
    .createSignedUrls(uniquePaths, 3600);

  if (error) throw new Error(`Não foi possível carregar as fotos: ${error.message}`);
  return new Map((data || []).filter((item) => item.signedUrl).map((item) => [item.path, item.signedUrl]));
}

export function formatPrice(price) {
  if (price === null || price === undefined || price === "") return "Consulte o valor";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2
  }).format(Number(price));
}

export function propertyLocation(property) {
  return [property.neighborhood, property.city, property.state].filter(Boolean).join(" · ");
}

export function isMissingVideoColumn(error) {
  return ["42703", "PGRST204"].includes(error?.code) &&
    /video_url/i.test(error.message || "");
}

export function getVideoEmbedUrl(value) {
  if (typeof value !== "string" || !value.trim()) return null;

  let url;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password) return null;

  const host = url.hostname.toLowerCase();
  const segments = url.pathname.split("/").filter(Boolean);
  if (["youtube.com", "www.youtube.com", "m.youtube.com"].includes(host)) {
    const videoId = segments[0] === "watch"
      ? url.searchParams.get("v")
      : ["embed", "shorts", "live"].includes(segments[0]) ? segments[1] : null;
    return videoId && /^[A-Za-z0-9_-]{11}$/.test(videoId)
      ? `https://www.youtube-nocookie.com/embed/${videoId}`
      : null;
  }
  if (host === "youtu.be") {
    const videoId = segments[0];
    return videoId && /^[A-Za-z0-9_-]{11}$/.test(videoId)
      ? `https://www.youtube-nocookie.com/embed/${videoId}`
      : null;
  }
  if (["vimeo.com", "www.vimeo.com", "player.vimeo.com"].includes(host)) {
    const videoId = host === "player.vimeo.com" && segments[0] === "video"
      ? segments[1]
      : segments[0];
    return videoId && /^\d+$/.test(videoId)
      ? `https://player.vimeo.com/video/${videoId}`
      : null;
  }
  return null;
}
