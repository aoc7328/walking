var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// api/auth/check.ts
var HASH_RE = /^[a-f0-9]{32,64}$/i;
function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    }
  });
}
__name(jsonResponse, "jsonResponse");
async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const u = url.searchParams.get("u");
  if (!u || !HASH_RE.test(u)) return jsonResponse({ error: "\u7121\u6548\u7684\u96DC\u6E4A" }, 400);
  if (!env.TRIPS) return jsonResponse({ error: "KV \u672A\u8A2D\u5B9A" }, 500);
  const exists = await env.TRIPS.get(`u:${u.toLowerCase()}:_account`) !== null;
  return jsonResponse({ exists });
}
__name(onRequestGet, "onRequestGet");
async function onRequestOptions() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400"
    }
  });
}
__name(onRequestOptions, "onRequestOptions");

// api/auth/register.ts
var HASH_RE2 = /^[a-f0-9]{32,64}$/i;
function jsonResponse2(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    }
  });
}
__name(jsonResponse2, "jsonResponse");
async function onRequestPost(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const u = url.searchParams.get("u");
  if (!u || !HASH_RE2.test(u)) return jsonResponse2({ error: "\u7121\u6548\u7684\u96DC\u6E4A" }, 400);
  if (!env.TRIPS) return jsonResponse2({ error: "KV \u672A\u8A2D\u5B9A" }, 500);
  const key = `u:${u.toLowerCase()}:_account`;
  const existing = await env.TRIPS.get(key);
  if (existing) {
    return jsonResponse2({ ok: true, created: false });
  }
  await env.TRIPS.put(key, JSON.stringify({ createdAt: Date.now() }));
  return jsonResponse2({ ok: true, created: true }, 201);
}
__name(onRequestPost, "onRequestPost");
async function onRequestOptions2() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400"
    }
  });
}
__name(onRequestOptions2, "onRequestOptions");

// api/trip/[id].ts
function jsonResponse3(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      ...extraHeaders
    }
  });
}
__name(jsonResponse3, "jsonResponse");
async function onRequestGet2(context) {
  const { params, env } = context;
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  const id = (rawId ?? "").trim();
  if (!/^[a-f0-9]{6,16}$/i.test(id)) {
    return jsonResponse3({ error: "ID \u683C\u5F0F\u4E0D\u5C0D" }, 400);
  }
  if (!env.TRIPS) {
    return jsonResponse3({ error: "KV namespace \u672A\u8A2D\u5B9A" }, 500);
  }
  const json = await env.TRIPS.get(`trip:${id}`);
  if (!json) {
    return jsonResponse3({ error: "\u627E\u4E0D\u5230\u8A72\u884C\u7A0B\uFF08\u53EF\u80FD\u5DF2\u904E\u671F\u6216 ID \u932F\u8AA4\uFF09" }, 404);
  }
  return new Response(json, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      // 行程內容不會變（同 ID 只會 put 一次），讓瀏覽器與 Cloudflare edge 快取
      "Cache-Control": "public, max-age=300, s-maxage=3600"
    }
  });
}
__name(onRequestGet2, "onRequestGet");
async function onRequestOptions3() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400"
    }
  });
}
__name(onRequestOptions3, "onRequestOptions");

// api/trips/[id].ts
var USER_ID_RE = /^[a-f0-9]{16,64}$/i;
var TRIP_ID_RE = /^[A-Za-z0-9_-]{6,64}$/;
var MAX_SIZE = 500 * 1024;
function parseUserId(url) {
  const u = url.searchParams.get("u");
  if (!u || !USER_ID_RE.test(u)) return null;
  return u.toLowerCase();
}
__name(parseUserId, "parseUserId");
function parseTripId(params) {
  const raw = Array.isArray(params.id) ? params.id[0] : params.id;
  const id = (raw ?? "").trim();
  return TRIP_ID_RE.test(id) ? id : null;
}
__name(parseTripId, "parseTripId");
function jsonResponse4(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    }
  });
}
__name(jsonResponse4, "jsonResponse");
async function onRequestGet3(context) {
  const { request, env, params } = context;
  const url = new URL(request.url);
  const userId = parseUserId(url);
  if (!userId) return jsonResponse4({ error: "\u7121\u6548\u7684\u540C\u6B65 ID" }, 400);
  const tripId = parseTripId(params);
  if (!tripId) return jsonResponse4({ error: "\u7121\u6548\u7684\u884C\u7A0B ID" }, 400);
  if (!env.TRIPS) return jsonResponse4({ error: "KV \u672A\u8A2D\u5B9A" }, 500);
  const raw = await env.TRIPS.get(`u:${userId}:trip:${tripId}`);
  if (!raw) return jsonResponse4({ error: "\u627E\u4E0D\u5230\u884C\u7A0B" }, 404);
  return new Response(raw, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    }
  });
}
__name(onRequestGet3, "onRequestGet");
async function onRequestPut(context) {
  const { request, env, params } = context;
  const url = new URL(request.url);
  const userId = parseUserId(url);
  if (!userId) return jsonResponse4({ error: "\u7121\u6548\u7684\u540C\u6B65 ID" }, 400);
  const tripId = parseTripId(params);
  if (!tripId) return jsonResponse4({ error: "\u7121\u6548\u7684\u884C\u7A0B ID" }, 400);
  if (!env.TRIPS) return jsonResponse4({ error: "KV \u672A\u8A2D\u5B9A" }, 500);
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse4({ error: "\u4E0D\u662F\u5408\u6CD5\u7684 JSON" }, 400);
  }
  const json = JSON.stringify(body);
  if (json.length > MAX_SIZE) {
    return jsonResponse4({ error: `\u884C\u7A0B\u8D85\u904E ${MAX_SIZE / 1024}KB \u4E0A\u9650` }, 413);
  }
  await env.TRIPS.put(`u:${userId}:trip:${tripId}`, json);
  return jsonResponse4({ ok: true });
}
__name(onRequestPut, "onRequestPut");
async function onRequestDelete(context) {
  const { request, env, params } = context;
  const url = new URL(request.url);
  const userId = parseUserId(url);
  if (!userId) return jsonResponse4({ error: "\u7121\u6548\u7684\u540C\u6B65 ID" }, 400);
  const tripId = parseTripId(params);
  if (!tripId) return jsonResponse4({ error: "\u7121\u6548\u7684\u884C\u7A0B ID" }, 400);
  if (!env.TRIPS) return jsonResponse4({ error: "KV \u672A\u8A2D\u5B9A" }, 500);
  await env.TRIPS.delete(`u:${userId}:trip:${tripId}`);
  return jsonResponse4({ ok: true });
}
__name(onRequestDelete, "onRequestDelete");
async function onRequestOptions4() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400"
    }
  });
}
__name(onRequestOptions4, "onRequestOptions");

// api/asset/[[path]].ts
var USER_ID_RE2 = /^[a-f0-9]{16,64}$/i;
function jsonResponse5(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    }
  });
}
__name(jsonResponse5, "jsonResponse");
function resolve(context) {
  const url = new URL(context.request.url);
  const u = (url.searchParams.get("u") ?? "").toLowerCase();
  if (!USER_ID_RE2.test(u)) return null;
  const raw = context.params.path;
  const key = (Array.isArray(raw) ? raw.join("/") : raw ?? "").trim();
  if (!key || key.includes("..")) return null;
  if (!key.startsWith(`u/${u}/`)) return null;
  return { key, userId: u };
}
__name(resolve, "resolve");
async function onRequestGet4(context) {
  const r = resolve(context);
  if (!r) return jsonResponse5({ error: "\u7121\u6548\u7684\u5716\u7247\u4F4D\u5740" }, 400);
  if (!context.env.MEDIA) return jsonResponse5({ error: "R2 \u672A\u8A2D\u5B9A\uFF08Pages \u5C08\u6848\u8981\u7D81 MEDIA\uFF09" }, 500);
  const obj = await context.env.MEDIA.get(r.key);
  if (!obj) return jsonResponse5({ error: "\u627E\u4E0D\u5230\u5716\u7247" }, 404);
  return new Response(obj.body, {
    status: 200,
    headers: {
      "Content-Type": obj.httpMetadata?.contentType ?? "application/octet-stream",
      // key 帶 uuid，內容永不覆寫 → 讓瀏覽器盡量長期快取，出國沒訊號也還看得到
      "Cache-Control": "private, max-age=31536000, immutable"
    }
  });
}
__name(onRequestGet4, "onRequestGet");
async function onRequestDelete2(context) {
  const r = resolve(context);
  if (!r) return jsonResponse5({ error: "\u7121\u6548\u7684\u5716\u7247\u4F4D\u5740" }, 400);
  if (!context.env.MEDIA) return jsonResponse5({ error: "R2 \u672A\u8A2D\u5B9A\uFF08Pages \u5C08\u6848\u8981\u7D81 MEDIA\uFF09" }, 500);
  await context.env.MEDIA.delete(r.key);
  return jsonResponse5({ ok: true });
}
__name(onRequestDelete2, "onRequestDelete");
async function onRequestOptions5() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400"
    }
  });
}
__name(onRequestOptions5, "onRequestOptions");

// api/asset/index.ts
var USER_ID_RE3 = /^[a-f0-9]{16,64}$/i;
var TRIP_ID_RE2 = /^[A-Za-z0-9_-]{6,64}$/;
var MAX_SIZE2 = 5 * 1024 * 1024;
var EXT = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif"
};
function jsonResponse6(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    }
  });
}
__name(jsonResponse6, "jsonResponse");
async function onRequestPost2(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const u = (url.searchParams.get("u") ?? "").toLowerCase();
  if (!USER_ID_RE3.test(u)) return jsonResponse6({ error: "\u7121\u6548\u7684\u540C\u6B65 ID" }, 400);
  const tripId = (url.searchParams.get("trip") ?? "").trim();
  if (!TRIP_ID_RE2.test(tripId)) return jsonResponse6({ error: "\u7121\u6548\u7684\u884C\u7A0B ID" }, 400);
  if (!env.MEDIA) return jsonResponse6({ error: "R2 \u672A\u8A2D\u5B9A\uFF08Pages \u5C08\u6848\u8981\u7D81 MEDIA\uFF09" }, 500);
  const contentType = (request.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  const ext = EXT[contentType];
  if (!ext) return jsonResponse6({ error: "\u53EA\u63A5\u53D7 PNG / JPEG / WebP / GIF \u5716\u7247" }, 415);
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength === 0) return jsonResponse6({ error: "\u7A7A\u7684\u6A94\u6848" }, 400);
  if (bytes.byteLength > MAX_SIZE2) {
    return jsonResponse6({ error: `\u5716\u7247\u8D85\u904E ${MAX_SIZE2 / 1024 / 1024}MB \u4E0A\u9650` }, 413);
  }
  const key = `u/${u}/${tripId}/${crypto.randomUUID()}.${ext}`;
  await env.MEDIA.put(key, bytes, { httpMetadata: { contentType } });
  return jsonResponse6({ key });
}
__name(onRequestPost2, "onRequestPost");
async function onRequestOptions6() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400"
    }
  });
}
__name(onRequestOptions6, "onRequestOptions");

// api/trip/index.ts
var MAX_SIZE3 = 200 * 1024;
var TTL_SECONDS = 60 * 60 * 24 * 180;
function jsonResponse7(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    }
  });
}
__name(jsonResponse7, "jsonResponse");
async function onRequestPost3(context) {
  const { request, env } = context;
  if (!env.TRIPS) {
    return jsonResponse7({ error: "KV namespace \u672A\u8A2D\u5B9A\uFF0C\u8ACB\u5230 Cloudflare \u63A7\u5236\u53F0\u7D81\u5B9A TRIPS" }, 500);
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse7({ error: "\u4E0D\u662F\u5408\u6CD5\u7684 JSON" }, 400);
  }
  const json = JSON.stringify(body);
  if (json.length > MAX_SIZE3) {
    return jsonResponse7({ error: `\u884C\u7A0B\u8CC7\u6599\u8D85\u904E ${MAX_SIZE3 / 1024}KB \u4E0A\u9650` }, 413);
  }
  const id = crypto.randomUUID().replace(/-/g, "").slice(0, 10);
  await env.TRIPS.put(`trip:${id}`, json, { expirationTtl: TTL_SECONDS });
  return jsonResponse7({ id }, 201);
}
__name(onRequestPost3, "onRequestPost");
async function onRequestOptions7() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400"
    }
  });
}
__name(onRequestOptions7, "onRequestOptions");

// api/trips/index.ts
var USER_ID_RE4 = /^[a-f0-9]{16,64}$/i;
function parseUserId2(url) {
  const u = url.searchParams.get("u");
  if (!u || !USER_ID_RE4.test(u)) return null;
  return u.toLowerCase();
}
__name(parseUserId2, "parseUserId");
function jsonResponse8(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    }
  });
}
__name(jsonResponse8, "jsonResponse");
async function onRequestGet5(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const userId = parseUserId2(url);
  if (!userId) return jsonResponse8({ error: "\u7121\u6548\u7684\u540C\u6B65 ID" }, 400);
  if (!env.TRIPS) return jsonResponse8({ error: "KV \u672A\u8A2D\u5B9A" }, 500);
  const prefix = `u:${userId}:trip:`;
  const trips = [];
  let cursor;
  for (let i = 0; i < 5; i++) {
    const page = await env.TRIPS.list({ prefix, limit: 1e3, cursor });
    for (const k of page.keys) {
      const raw = await env.TRIPS.get(k.name);
      if (raw) {
        try {
          trips.push(JSON.parse(raw));
        } catch {
        }
      }
    }
    if (page.list_complete || !page.cursor) break;
    cursor = page.cursor;
  }
  trips.sort((a, b) => {
    const aU = typeof a.updatedAt === "number" ? a.updatedAt : 0;
    const bU = typeof b.updatedAt === "number" ? b.updatedAt : 0;
    return bU - aU;
  });
  return jsonResponse8(trips);
}
__name(onRequestGet5, "onRequestGet");
async function onRequestOptions8() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400"
    }
  });
}
__name(onRequestOptions8, "onRequestOptions");

// ../.wrangler/tmp/pages-5eI0zt/functionsRoutes-0.41067936173654185.mjs
var routes = [
  {
    routePath: "/api/auth/check",
    mountPath: "/api/auth",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet]
  },
  {
    routePath: "/api/auth/check",
    mountPath: "/api/auth",
    method: "OPTIONS",
    middlewares: [],
    modules: [onRequestOptions]
  },
  {
    routePath: "/api/auth/register",
    mountPath: "/api/auth",
    method: "OPTIONS",
    middlewares: [],
    modules: [onRequestOptions2]
  },
  {
    routePath: "/api/auth/register",
    mountPath: "/api/auth",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost]
  },
  {
    routePath: "/api/trip/:id",
    mountPath: "/api/trip",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet2]
  },
  {
    routePath: "/api/trip/:id",
    mountPath: "/api/trip",
    method: "OPTIONS",
    middlewares: [],
    modules: [onRequestOptions3]
  },
  {
    routePath: "/api/trips/:id",
    mountPath: "/api/trips",
    method: "DELETE",
    middlewares: [],
    modules: [onRequestDelete]
  },
  {
    routePath: "/api/trips/:id",
    mountPath: "/api/trips",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet3]
  },
  {
    routePath: "/api/trips/:id",
    mountPath: "/api/trips",
    method: "OPTIONS",
    middlewares: [],
    modules: [onRequestOptions4]
  },
  {
    routePath: "/api/trips/:id",
    mountPath: "/api/trips",
    method: "PUT",
    middlewares: [],
    modules: [onRequestPut]
  },
  {
    routePath: "/api/asset/:path*",
    mountPath: "/api/asset",
    method: "DELETE",
    middlewares: [],
    modules: [onRequestDelete2]
  },
  {
    routePath: "/api/asset/:path*",
    mountPath: "/api/asset",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet4]
  },
  {
    routePath: "/api/asset/:path*",
    mountPath: "/api/asset",
    method: "OPTIONS",
    middlewares: [],
    modules: [onRequestOptions5]
  },
  {
    routePath: "/api/asset",
    mountPath: "/api/asset",
    method: "OPTIONS",
    middlewares: [],
    modules: [onRequestOptions6]
  },
  {
    routePath: "/api/asset",
    mountPath: "/api/asset",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost2]
  },
  {
    routePath: "/api/trip",
    mountPath: "/api/trip",
    method: "OPTIONS",
    middlewares: [],
    modules: [onRequestOptions7]
  },
  {
    routePath: "/api/trip",
    mountPath: "/api/trip",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost3]
  },
  {
    routePath: "/api/trips",
    mountPath: "/api/trips",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet5]
  },
  {
    routePath: "/api/trips",
    mountPath: "/api/trips",
    method: "OPTIONS",
    middlewares: [],
    modules: [onRequestOptions8]
  }
];

// C:/Users/胖齊/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/path-to-regexp/dist.es2015/index.js
function lexer(str) {
  var tokens = [];
  var i = 0;
  while (i < str.length) {
    var char = str[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str[i++] });
      continue;
    }
    if (char === ":") {
      var name = "";
      var j = i + 1;
      while (j < str.length) {
        var code = str.charCodeAt(j);
        if (
          // `0-9`
          code >= 48 && code <= 57 || // `A-Z`
          code >= 65 && code <= 90 || // `a-z`
          code >= 97 && code <= 122 || // `_`
          code === 95
        ) {
          name += str[j++];
          continue;
        }
        break;
      }
      if (!name)
        throw new TypeError("Missing parameter name at ".concat(i));
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      var count = 1;
      var pattern = "";
      var j = i + 1;
      if (str[j] === "?") {
        throw new TypeError('Pattern cannot start with "?" at '.concat(j));
      }
      while (j < str.length) {
        if (str[j] === "\\") {
          pattern += str[j++] + str[j++];
          continue;
        }
        if (str[j] === ")") {
          count--;
          if (count === 0) {
            j++;
            break;
          }
        } else if (str[j] === "(") {
          count++;
          if (str[j + 1] !== "?") {
            throw new TypeError("Capturing groups are not allowed at ".concat(j));
          }
        }
        pattern += str[j++];
      }
      if (count)
        throw new TypeError("Unbalanced pattern at ".concat(i));
      if (!pattern)
        throw new TypeError("Missing pattern at ".concat(i));
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
__name(lexer, "lexer");
function parse(str, options) {
  if (options === void 0) {
    options = {};
  }
  var tokens = lexer(str);
  var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a, _b = options.delimiter, delimiter = _b === void 0 ? "/#?" : _b;
  var result = [];
  var key = 0;
  var i = 0;
  var path = "";
  var tryConsume = /* @__PURE__ */ __name(function(type) {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  }, "tryConsume");
  var mustConsume = /* @__PURE__ */ __name(function(type) {
    var value2 = tryConsume(type);
    if (value2 !== void 0)
      return value2;
    var _a2 = tokens[i], nextType = _a2.type, index = _a2.index;
    throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
  }, "mustConsume");
  var consumeText = /* @__PURE__ */ __name(function() {
    var result2 = "";
    var value2;
    while (value2 = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value2;
    }
    return result2;
  }, "consumeText");
  var isSafe = /* @__PURE__ */ __name(function(value2) {
    for (var _i = 0, delimiter_1 = delimiter; _i < delimiter_1.length; _i++) {
      var char2 = delimiter_1[_i];
      if (value2.indexOf(char2) > -1)
        return true;
    }
    return false;
  }, "isSafe");
  var safePattern = /* @__PURE__ */ __name(function(prefix2) {
    var prev = result[result.length - 1];
    var prevText = prefix2 || (prev && typeof prev === "string" ? prev : "");
    if (prev && !prevText) {
      throw new TypeError('Must have text between two parameters, missing text after "'.concat(prev.name, '"'));
    }
    if (!prevText || isSafe(prevText))
      return "[^".concat(escapeString(delimiter), "]+?");
    return "(?:(?!".concat(escapeString(prevText), ")[^").concat(escapeString(delimiter), "])+?");
  }, "safePattern");
  while (i < tokens.length) {
    var char = tryConsume("CHAR");
    var name = tryConsume("NAME");
    var pattern = tryConsume("PATTERN");
    if (name || pattern) {
      var prefix = char || "";
      if (prefixes.indexOf(prefix) === -1) {
        path += prefix;
        prefix = "";
      }
      if (path) {
        result.push(path);
        path = "";
      }
      result.push({
        name: name || key++,
        prefix,
        suffix: "",
        pattern: pattern || safePattern(prefix),
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    var value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path += value;
      continue;
    }
    if (path) {
      result.push(path);
      path = "";
    }
    var open = tryConsume("OPEN");
    if (open) {
      var prefix = consumeText();
      var name_1 = tryConsume("NAME") || "";
      var pattern_1 = tryConsume("PATTERN") || "";
      var suffix = consumeText();
      mustConsume("CLOSE");
      result.push({
        name: name_1 || (pattern_1 ? key++ : ""),
        pattern: name_1 && !pattern_1 ? safePattern(prefix) : pattern_1,
        prefix,
        suffix,
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    mustConsume("END");
  }
  return result;
}
__name(parse, "parse");
function match(str, options) {
  var keys = [];
  var re = pathToRegexp(str, keys, options);
  return regexpToFunction(re, keys, options);
}
__name(match, "match");
function regexpToFunction(re, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.decode, decode = _a === void 0 ? function(x) {
    return x;
  } : _a;
  return function(pathname) {
    var m = re.exec(pathname);
    if (!m)
      return false;
    var path = m[0], index = m.index;
    var params = /* @__PURE__ */ Object.create(null);
    var _loop_1 = /* @__PURE__ */ __name(function(i2) {
      if (m[i2] === void 0)
        return "continue";
      var key = keys[i2 - 1];
      if (key.modifier === "*" || key.modifier === "+") {
        params[key.name] = m[i2].split(key.prefix + key.suffix).map(function(value) {
          return decode(value, key);
        });
      } else {
        params[key.name] = decode(m[i2], key);
      }
    }, "_loop_1");
    for (var i = 1; i < m.length; i++) {
      _loop_1(i);
    }
    return { path, index, params };
  };
}
__name(regexpToFunction, "regexpToFunction");
function escapeString(str) {
  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
__name(escapeString, "escapeString");
function flags(options) {
  return options && options.sensitive ? "" : "i";
}
__name(flags, "flags");
function regexpToRegexp(path, keys) {
  if (!keys)
    return path;
  var groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
  var index = 0;
  var execResult = groupsRegex.exec(path.source);
  while (execResult) {
    keys.push({
      // Use parenthesized substring match if available, index otherwise
      name: execResult[1] || index++,
      prefix: "",
      suffix: "",
      modifier: "",
      pattern: ""
    });
    execResult = groupsRegex.exec(path.source);
  }
  return path;
}
__name(regexpToRegexp, "regexpToRegexp");
function arrayToRegexp(paths, keys, options) {
  var parts = paths.map(function(path) {
    return pathToRegexp(path, keys, options).source;
  });
  return new RegExp("(?:".concat(parts.join("|"), ")"), flags(options));
}
__name(arrayToRegexp, "arrayToRegexp");
function stringToRegexp(path, keys, options) {
  return tokensToRegexp(parse(path, options), keys, options);
}
__name(stringToRegexp, "stringToRegexp");
function tokensToRegexp(tokens, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode = _d === void 0 ? function(x) {
    return x;
  } : _d, _e = options.delimiter, delimiter = _e === void 0 ? "/#?" : _e, _f = options.endsWith, endsWith = _f === void 0 ? "" : _f;
  var endsWithRe = "[".concat(escapeString(endsWith), "]|$");
  var delimiterRe = "[".concat(escapeString(delimiter), "]");
  var route = start ? "^" : "";
  for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
    var token = tokens_1[_i];
    if (typeof token === "string") {
      route += escapeString(encode(token));
    } else {
      var prefix = escapeString(encode(token.prefix));
      var suffix = escapeString(encode(token.suffix));
      if (token.pattern) {
        if (keys)
          keys.push(token);
        if (prefix || suffix) {
          if (token.modifier === "+" || token.modifier === "*") {
            var mod = token.modifier === "*" ? "?" : "";
            route += "(?:".concat(prefix, "((?:").concat(token.pattern, ")(?:").concat(suffix).concat(prefix, "(?:").concat(token.pattern, "))*)").concat(suffix, ")").concat(mod);
          } else {
            route += "(?:".concat(prefix, "(").concat(token.pattern, ")").concat(suffix, ")").concat(token.modifier);
          }
        } else {
          if (token.modifier === "+" || token.modifier === "*") {
            throw new TypeError('Can not repeat "'.concat(token.name, '" without a prefix and suffix'));
          }
          route += "(".concat(token.pattern, ")").concat(token.modifier);
        }
      } else {
        route += "(?:".concat(prefix).concat(suffix, ")").concat(token.modifier);
      }
    }
  }
  if (end) {
    if (!strict)
      route += "".concat(delimiterRe, "?");
    route += !options.endsWith ? "$" : "(?=".concat(endsWithRe, ")");
  } else {
    var endToken = tokens[tokens.length - 1];
    var isEndDelimited = typeof endToken === "string" ? delimiterRe.indexOf(endToken[endToken.length - 1]) > -1 : endToken === void 0;
    if (!strict) {
      route += "(?:".concat(delimiterRe, "(?=").concat(endsWithRe, "))?");
    }
    if (!isEndDelimited) {
      route += "(?=".concat(delimiterRe, "|").concat(endsWithRe, ")");
    }
  }
  return new RegExp(route, flags(options));
}
__name(tokensToRegexp, "tokensToRegexp");
function pathToRegexp(path, keys, options) {
  if (path instanceof RegExp)
    return regexpToRegexp(path, keys);
  if (Array.isArray(path))
    return arrayToRegexp(path, keys, options);
  return stringToRegexp(path, keys, options);
}
__name(pathToRegexp, "pathToRegexp");

// C:/Users/胖齊/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/templates/pages-template-worker.ts
var escapeRegex = /[.+?^${}()|[\]\\]/g;
function* executeRequest(request) {
  const requestPath = new URL(request.url).pathname;
  for (const route of [...routes].reverse()) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult) {
      for (const handler of route.middlewares.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: mountMatchResult.path
        };
      }
    }
  }
  for (const route of routes) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: true
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult && route.modules.length) {
      for (const handler of route.modules.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: matchResult.path
        };
      }
      break;
    }
  }
}
__name(executeRequest, "executeRequest");
var pages_template_worker_default = {
  async fetch(originalRequest, env, workerContext) {
    let request = originalRequest;
    const handlerIterator = executeRequest(request);
    let data = {};
    let isFailOpen = false;
    const next = /* @__PURE__ */ __name(async (input, init) => {
      if (input !== void 0) {
        let url = input;
        if (typeof input === "string") {
          url = new URL(input, request.url).toString();
        }
        request = new Request(url, init);
      }
      const result = handlerIterator.next();
      if (result.done === false) {
        const { handler, params, path } = result.value;
        const context = {
          request: new Request(request.clone()),
          functionPath: path,
          next,
          params,
          get data() {
            return data;
          },
          set data(value) {
            if (typeof value !== "object" || value === null) {
              throw new Error("context.data must be an object");
            }
            data = value;
          },
          env,
          waitUntil: workerContext.waitUntil.bind(workerContext),
          passThroughOnException: /* @__PURE__ */ __name(() => {
            isFailOpen = true;
          }, "passThroughOnException")
        };
        const response = await handler(context);
        if (!(response instanceof Response)) {
          throw new Error("Your Pages function should return a Response");
        }
        return cloneResponse(response);
      } else if ("ASSETS") {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      } else {
        const response = await fetch(request);
        return cloneResponse(response);
      }
    }, "next");
    try {
      return await next();
    } catch (error) {
      if (isFailOpen) {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      }
      throw error;
    }
  }
};
var cloneResponse = /* @__PURE__ */ __name((response) => (
  // https://fetch.spec.whatwg.org/#null-body-status
  new Response(
    [101, 204, 205, 304].includes(response.status) ? null : response.body,
    response
  )
), "cloneResponse");

// C:/Users/胖齊/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// C:/Users/胖齊/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    const body = JSON.stringify(error);
    const headers = {
      "Content-Type": "application/json",
      "MF-Experimental-Error-Stack": "true"
    };
    const encoded = encodeURIComponent(body);
    if (encoded.length <= 8192) {
      headers["MF-Experimental-Error-Stack-Payload"] = encoded;
    }
    return new Response(body, { status: 500, headers });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// ../.wrangler/tmp/bundle-efTdx7/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = pages_template_worker_default;

// C:/Users/胖齊/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// ../.wrangler/tmp/bundle-efTdx7/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=functionsWorker-0.8233910539521414.mjs.map
