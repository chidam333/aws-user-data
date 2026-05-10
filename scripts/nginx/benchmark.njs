function metrics(r) {
  const getMs = (v) => {
    if (!v || v === "-") return null;
    const parts = v.split(",");
    const lastValue = parts[parts.length - 1].trim();
    return parseFloat(lastValue) * 1000;
  };

  const cfRay = r.headersIn["CF-Ray"];
  const cfConnectingIP = r.headersIn["CF-Connecting-IP"];
  const isProxied = !!cfRay;

  const connectionType = isProxied
    ? r.variables.http2
      ? "cloudflare_http2"
      : "cloudflare_http1"
    : "direct";

  const report = {
    ts: new Date().toISOString(),
    node: "chennai-origin-01",
    trace: {
      cf_ray: cfRay || null,
      ip:
        r.variables.remote_addr ||
        r.variables.realip_remote_addr ||
        r.connection.remoteAddress ||
        null,
      country: r.headersIn["CF-IPCountry"] || "IN",
      cf_connecting_ip: cfConnectingIP || null,
    },
    latencies: {
      total_ms: getMs(r.variables.request_time),
      upstream_ms: getMs(r.variables.upstream_response_time),
      connect_ms: getMs(r.variables.upstream_connect_time),
    },
    connection: {
      type: connectionType,
      protocol: r.variables.server_protocol || "unknown",
    },
  };

  try {
    r.headersOut["Content-Type"] = "application/json";
    r.return(200, JSON.stringify(report, null, 2));
  } catch (err) {
    r.return(500, JSON.stringify({ err }, null, 2));
  }
}

export default { metrics };
