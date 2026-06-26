async function checkUrl(url) {
  const startedAt = Date.now();
  try {
    const response = await fetch(url, { headers: { accept: "application/json,*/*" } });
    const text = await response.text();
    return {
      url,
      ok: response.ok,
      status: response.status,
      contentType: response.headers.get("content-type"),
      elapsedMs: Date.now() - startedAt,
      preview: text.slice(0, 300)
    };
  } catch (error) {
    return {
      url,
      ok: false,
      error: error?.message || String(error),
      elapsedMs: Date.now() - startedAt
    };
  }
}

export async function checkDiscovery(origin) {
  const normalized = origin.replace(/\/+$/, "");
  return {
    origin: normalized,
    checkedAt: new Date().toISOString(),
    openapi: await checkUrl(`${normalized}/openapi.json`),
    wellKnownX402: await checkUrl(`${normalized}/.well-known/x402`),
    wellKnownX402Json: await checkUrl(`${normalized}/.well-known/x402.json`),
    x402Json: await checkUrl(`${normalized}/x402.json`)
  };
}

