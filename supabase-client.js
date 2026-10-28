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
