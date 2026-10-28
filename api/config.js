module.exports = (request, response) => {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  response.setHeader("Cache-Control", "no-store");
  if (!url || !anonKey) {
    response.status(503).json({ error: "A integração com o Supabase ainda não foi configurada." });
    return;
  }

  const isServiceRoleKey = anonKey.startsWith("sb_secret_") || (() => {
    try {
      const payload = JSON.parse(Buffer.from(anonKey.split(".")[1] || "", "base64url").toString("utf8"));
      return payload.role === "service_role";
    } catch {
      return false;
    }
  })();
  if (isServiceRoleKey) {
    response.status(500).json({ error: "Configure uma chave pública anon/publishable, nunca a chave service_role." });
    return;
  }

  response.status(200).json({ url, anonKey });
};
