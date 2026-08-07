// =============================================================
// 墨墨背单词 代理 — Cloudflare Workers 版
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

// 可选安全加固：仅允许你自己的前端域名调用（取消注释并改成你的 github.io 域名）
// 不配置则任何人都能用本 Worker 转发（个人使用无碍，但会消耗你的请求额度）。
// const ALLOWED_ORIGIN = 'https://genghaonanaml.github.io';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 预检 OPTIONS：必须返回 200 + CORS 头，否则浏览器拦截真实请求
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

    // 可选：来源校验
    // if (ALLOWED_ORIGIN && request.headers.get('Origin') !== ALLOWED_ORIGIN) {
    //   return new Response('forbidden', { status: 403 });
    // }

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
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };
}
function setCors(h) {
  h.set('Access-Control-Allow-Origin', '*');
  h.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  h.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
}
