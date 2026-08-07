// =============================================================
// 墨墨背单词 代理 — Cloudflare Workers 版（经典 Service Worker 格式）
// -------------------------------------------------------------
// 用途：浏览器页面（github.io / file://）直连墨墨 API 会被 CORS 403 拦截
//      （墨墨对所有带 Origin 头的鉴权请求返回 common_permission_denied）。
//      本 Worker 在服务端转发请求、且不带 Origin，从而绕过限制。
//
// 部署步骤（免费）：
//   1. 登录 https://dash.cloudflare.com → Workers & Pages → 创建 Worker
//   2. 把本文件内容粘贴进编辑器，保存并部署
//   3. 获得地址：https://<你的子域>.workers.dev
//   4. 在研途学习台「墨墨背单词」模块里，把代理地址填成该 workers.dev 地址
//
// 前端调用约定（与本地 server.js 完全一致）：
//   POST <worker>/maimemo/<path>
//   Header: Authorization: Bearer <你的墨墨Token>
//   Body: JSON
//   Worker 转发到 https://open.maimemo.com/open/api/v1/<path>
// =============================================================

const MAIMEMO_BASE = 'https://open.maimemo.com/open/api/v1';

// 只允许自己的页面调用此代理，防止 Token 泄露后被他人滥用
const ALLOWED_ORIGIN = 'https://genghaonanaml.github.io';

addEventListener('fetch', function (event) {
  event.respondWith(handle(event.request));
});

async function handle(request) {
  const url = new URL(request.url);

  // 预检 OPTIONS：必须返回 204 + CORS 头，否则浏览器拦截真实请求
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders()
    });
  }

  // 仅处理 /maimemo/ 前缀
  if (!url.pathname.startsWith('/maimemo/')) {
    return new Response('maimemo-proxy worker ready. POST to /maimemo/<path>', {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }

  // 来源校验：浏览器跨域请求带 Origin；非本页来源直接拒绝
  const origin = request.headers.get('Origin');
  if (origin && origin !== ALLOWED_ORIGIN) {
    return new Response('forbidden', { status: 403, headers: { 'Content-Type': 'text/plain' } });
  }

  const apiPath = url.pathname.replace(/^\/maimemo\//, '');
  const target = MAIMEMO_BASE + '/' + apiPath + (url.search || '');

  // 透传 Authorization，但【不要】设置 Origin（关键）
  const headers = new Headers();
  const auth = request.headers.get('Authorization');
  if (auth) headers.set('Authorization', auth);
  headers.set('Content-Type', request.headers.get('Content-Type') || 'application/json');

  const init = {
    method: request.method,
    headers: headers,
    redirect: 'follow'
  };
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = request.body;
  }

  try {
    const resp = await fetch(target, init);
    const out = new Response(resp.body, resp);
    setCors(out.headers);
    return out;
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 502,
      headers: Object.assign({ 'Content-Type': 'application/json' }, corsHeaders())
    });
  }
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };
}
function setCors(h) {
  h.set('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  h.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  h.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
}
