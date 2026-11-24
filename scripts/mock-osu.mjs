// Fake osu! API for local end-to-end testing (no real credentials needed).
// Usage: node scripts/mock-osu.mjs [port]  then run the app with
//   OSU_CLIENT_ID=1 OSU_CLIENT_SECRET=test OSU_BASE_URL=http://localhost:<port>
import http from "node:http";
const port = Number(process.argv[2] ?? 3299);
const users = {
  mockplayer: { id: 7562902, username: "MockPlayer", country: { code: "KR", name: "South Korea" } },
  slowpoke: { id: 1111, username: "slowpoke", country: { code: "CA", name: "Canada" } },
};
const stats = (seed) => ({ global_rank: 1500 * seed, country_rank: 80 * seed, pp: 9000 / seed, hit_accuracy: 99 - seed / 2, play_count: 50000 / seed, ranked_score: 3e10 / seed, level: { current: 102 - seed, progress: 11 * seed } });
const modeSeed = { osu: 1, taiko: 3, fruits: 5, mania: 7 };
http.createServer((req, res) => {
  const send = (code, body, headers = {}) => { res.writeHead(code, { "content-type": "application/json", ...headers }); res.end(JSON.stringify(body)); };
  if (req.url === "/oauth/token") return send(200, { access_token: "mock-token", expires_in: 86400, token_type: "Bearer" });
  if (req.headers.authorization !== "Bearer mock-token") return send(401, { authentication: "basic" });
  const m = req.url.match(/^\/api\/v2\/users\/([^/]+)\/(osu|taiko|fruits|mania)$/);
  if (!m) return send(404, {});
  const key = decodeURIComponent(m[1]);
  if (key.toLowerCase() === "@ratelimited") return send(429, {}, { "retry-after": "17" });
  if (key.toLowerCase() === "@broken") return send(500, {});
  const u = Object.values(users).find((x) => `@${x.username.toLowerCase()}` === key.toLowerCase() || String(x.id) === key);
  if (!u) return send(404, { error: null });
  const seed = modeSeed[m[2]];
  send(200, { ...u, avatar_url: "https://a.ppy.sh/2", country_code: u.country.code, cover: { url: null }, user_achievements: Array(150).fill({}),
    statistics: m[2] === "mania" && u.id === 1111 ? { global_rank: null, pp: 0, hit_accuracy: 0, play_count: 0, ranked_score: 0, level: { current: 1, progress: 0 } } : stats(seed) });
}).listen(port, () => console.log(`mock osu! on :${port}`));
