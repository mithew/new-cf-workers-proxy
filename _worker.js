function logError(request, message) {
  console.error(
    `${message}, clientIp: ${request.headers.get(
      "cf-connecting-ip"
    )}, user-agent: ${request.headers.get("user-agent")}, url: ${request.url}`
  );
}

function createNewRequest(request, url, proxyHostname, originHostname) {
  const newRequestHeaders = new Headers(request.headers);
  for (const [key, value] of newRequestHeaders) {
    if (value.includes(originHostname)) {
      newRequestHeaders.set(
        key,
        value.replace(
          new RegExp(`(?<!\\.)\\b${originHostname}\\b`, "g"),
          proxyHostname
        )
      );
    }
  }
  return new Request(url.toString(), {
    method: request.method,
    headers: newRequestHeaders,
    body: request.body,
  });
}

function setResponseHeaders(
  originalResponse,
  proxyHostname,
  originHostname,
  DEBUG
) {
  const newResponseHeaders = new Headers(originalResponse.headers);
  for (const [key, value] of newResponseHeaders) {
    if (value.includes(proxyHostname)) {
      newResponseHeaders.set(
        key,
        value.replace(
          new RegExp(`(?<!\\.)\\b${proxyHostname}\\b`, "g"),
          originHostname
        )
      );
    }
  }
  if (DEBUG) {
    newResponseHeaders.delete("content-security-policy");
  }
  return newResponseHeaders;
}

/**
 * 替换内容
 * @param originalResponse 响应
 * @param proxyHostname 代理地址 hostname
 * @param pathnameRegex 代理地址路径匹配的正则表达式
 * @param originHostname 替换的字符串
 * @returns {Promise<*>}
 */
async function replaceResponseText(
  originalResponse,
  proxyHostname,
  pathnameRegex,
  originHostname
) {
  let text = await originalResponse.text();
  if (pathnameRegex) {
    pathnameRegex = pathnameRegex.replace(/^\^/, "");
    return text.replace(
      new RegExp(`((?<!\\.)\\b${proxyHostname}\\b)(${pathnameRegex})`, "g"),
      `${originHostname}$2`
    );
  } else {
    return text.replace(
      new RegExp(`(?<!\\.)\\b${proxyHostname}\\b`, "g"),
      originHostname
    );
  }
}

async function nginx() {
  // 生成随机的服务器信息
  const generateServerInfo = () => {
    const servers = ['nginx/1.20.1', 'Apache/2.4.41', 'LiteSpeed/6.0.11'];
    const os = ['Ubuntu Server 20.04 LTS', 'CentOS 8.4', 'Debian 11'];
    const domains = ['us-east.server.net', 'eu-central.server.net', 'asia-east.server.net'];
    return {
      server: servers[Math.floor(Math.random() * servers.length)],
      os: os[Math.floor(Math.random() * os.length)],
      domain: domains[Math.floor(Math.random() * domains.length)],
      uptime: Math.floor(Math.random() * 300) + ' days',
      load: (Math.random() * 2).toFixed(2)
    };
  };

  const serverInfo = generateServerInfo();
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>404 Not Found - System Error</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap');
        
        :root {
            --primary: #00ff9d;
            --secondary: #0066ff;
            --background: #1a1a1a;
            --text: #ffffff;
        }
        
        body {
            font-family: 'JetBrains Mono', monospace;
            background-color: var(--background);
            color: var(--text);
            margin: 0;
            padding: 20px;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow-x: hidden;
        }
        
        .error-container {
            max-width: 800px;
            padding: 30px;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 10px;
            backdrop-filter: blur(10px);
            box-shadow: 0 0 30px rgba(0, 255, 157, 0.1);
            position: relative;
            animation: containerFloat 3s ease-in-out infinite;
        }
        
        @keyframes containerFloat {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-10px); }
        }
        
        .error-code {
            font-size: 72px;
            color: var(--primary);
            margin: 0;
            font-weight: bold;
            text-shadow: 0 0 10px rgba(0, 255, 157, 0.5);
            animation: glitch 1s linear infinite;
        }
        
        @keyframes glitch {
            2%, 64% { transform: translate(2px,0) skew(0deg); }
            4%, 60% { transform: translate(-2px,0) skew(0deg); }
            62% { transform: translate(0,0) skew(5deg); }
        }
        
        .error-title {
            font-size: 24px;
            margin: 20px 0;
            color: var(--secondary);
            position: relative;
        }
        
        .error-details {
            border-top: 1px solid rgba(255, 255, 255, 0.1);
            margin-top: 20px;
            padding-top: 20px;
            font-size: 16px;
            line-height: 1.6;
        }
        
        .server-info {
            margin-top: 30px;
            background: rgba(0, 0, 0, 0.3);
            padding: 20px;
            border-radius: 5px;
            font-size: 14px;
        }
        
        .server-info p {
            margin: 5px 0;
            display: flex;
            justify-content: space-between;
        }
        
        .server-info span {
            color: var(--primary);
        }
        
        .matrix-bg {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: -1;
            opacity: 0.1;
        }
        
        .status-indicator {
            display: inline-block;
            width: 10px;
            height: 10px;
            background: var(--primary);
            border-radius: 50%;
            margin-right: 10px;
            animation: blink 1s infinite;
        }
        
        @keyframes blink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.3; }
        }
    </style>
</head>
<body>
    <canvas class="matrix-bg" id="matrixCanvas"></canvas>
    <div class="error-container">
        <div class="status-indicator"></div>
        <h1 class="error-code">404</h1>
        <p class="error-title">Resource Not Found</p>
        <div class="error-details">
            <p>The requested URL was not found on this server. The resource might have been removed, renamed, or temporarily unavailable.</p>
            <p>Request ID: ${Math.random().toString(36).substring(2, 15)}</p>
        </div>
        <div class="server-info">
            <p>Server: <span>${serverInfo.server}</span></p>
            <p>Operating System: <span>${serverInfo.os}</span></p>
            <p>Domain: <span>${serverInfo.domain}</span></p>
            <p>Server Time: <span>${new Date().toUTCString()}</span></p>
            <p>System Uptime: <span>${serverInfo.uptime}</span></p>
            <p>Load Average: <span>${serverInfo.load}</span></p>
            <p>Client IP: <span>${Array.from({length: 4}, () => Math.floor(Math.random() * 255)).join('.')}</span></p>
            <p>Protocol: <span>HTTP/2.0</span></p>
            <p>SSL/TLS Version: <span>TLS 1.3</span></p>
        </div>
    </div>
    
    <script>
        // Matrix rain effect
        const canvas = document.getElementById('matrixCanvas');
        const ctx = canvas.getContext('2d');
        
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        
        const chars = '0123456789ABCDEF';
        const fontSize = 14;
        const columns = canvas.width / fontSize;
        const drops = Array(Math.floor(columns)).fill(1);
        
        function draw() {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            ctx.fillStyle = '#0F0';
            ctx.font = fontSize + 'px monospace';
            
            for(let i = 0; i < drops.length; i++) {
                const text = chars[Math.floor(Math.random() * chars.length)];
                ctx.fillText(text, i * fontSize, drops[i] * fontSize);
                
                if(drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
                    drops[i] = 0;
                }
                drops[i]++;
            }
        }
        
        setInterval(draw, 33);
        
        window.addEventListener('resize', () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        });
    </script>
</body>
</html>`;
}

async function checkRequestRate(ip, store, env) {
  if (!ip || !store) {
    console.error("Missing required parameters for rate limiting");
    return false;
  }

  const key = `rate_limit:${ip}`;
  const now = Date.now();
  // 从环境变量读取配置，并提供默认值
  const windowMs = parseInt(env.RATE_LIMIT_WINDOW_MS) || 60 * 1000; // 默认 
  const limit = parseInt(env.RATE_LIMIT_MAX_REQUESTS) || 15; // 默认 

  try {
    let record = await store.get(key, { type: "json" });
    
    if (!record) {
      record = {
        count: 1,
        timestamp: now
      };
    } else {
      if (now - record.timestamp > windowMs) {
        record = {
          count: 1,
          timestamp: now
        };
      } else {
        record.count += 1;
      }
    }

    await store.put(key, JSON.stringify(record), {
      expirationTtl: 60 // 1分钟后自动过期
    });

    return record.count > limit;
  } catch (error) {
    console.error(`Rate limit check error for IP ${ip}: ${error.message}`);
    return false;
  }
}

export default {
  async fetch(request, env, ctx) {
    try {
      const {
        PROXY_HOSTNAME,
        PROXY_PROTOCOL = "https",
        PATHNAME_REGEX,
        UA_WHITELIST_REGEX,
        UA_BLACKLIST_REGEX,
        URL302,
        IP_WHITELIST_REGEX,
        IP_BLACKLIST_REGEX,
        REGION_WHITELIST_REGEX,
        REGION_BLACKLIST_REGEX,
        DEBUG = false,
        RATE_LIMIT_ENABLED = false, // 新增：是否启用频率限制
      } = env;

      const url = new URL(request.url);
      const originHostname = url.hostname;
      const clientIp = request.headers.get("cf-connecting-ip");

      // 检查请求频率
      if ((RATE_LIMIT_ENABLED === "true" || RATE_LIMIT_ENABLED === true) && env.RATE_LIMIT_STORE) {
        const isRateLimited = await checkRequestRate(clientIp, env.RATE_LIMIT_STORE, env);


        if (isRateLimited) {
          return new Response("Access frequency is too high", { status: 429 }); #■ 返回简单的文本消息而不是nginx页面
        }
      }

        if (PATHNAME_REGEX) {
          if (url.pathname === "/" || url.pathname === "") {
            return new Response(await nginx(), {
              headers: { "Content-Type": "text/html; charset=utf-8" },
            }); #■ 如果只访问域名，返回自定义nginx页面
          } else if (!new RegExp(PATHNAME_REGEX).test(url.pathname)) {
            return new Response("The requested resource does not exist", { status: 404 }); #■ 路径不匹配时返回简单的文本消息
          }
        }

      if (
        !PROXY_HOSTNAME ||
        (PATHNAME_REGEX && !new RegExp(PATHNAME_REGEX).test(url.pathname)) ||
        (UA_WHITELIST_REGEX &&
          !new RegExp(UA_WHITELIST_REGEX).test(
            request.headers.get("user-agent").toLowerCase()
          )) ||
        (UA_BLACKLIST_REGEX &&
          new RegExp(UA_BLACKLIST_REGEX).test(
            request.headers.get("user-agent").toLowerCase()
          )) ||
        (IP_WHITELIST_REGEX &&
          !new RegExp(IP_WHITELIST_REGEX).test(clientIp)) ||
        (IP_BLACKLIST_REGEX &&
          new RegExp(IP_BLACKLIST_REGEX).test(clientIp)) ||
        (REGION_WHITELIST_REGEX &&
          !new RegExp(REGION_WHITELIST_REGEX).test(
            request.headers.get("cf-ipcountry")
          )) ||
        (REGION_BLACKLIST_REGEX &&
          new RegExp(REGION_BLACKLIST_REGEX).test(
            request.headers.get("cf-ipcountry")
          ))
      ) {
        logError(request, "Invalid");
        return URL302
          ? Response.redirect(URL302, 302)
          : new Response(await nginx(), {
              headers: {
                "Content-Type": "text/html; charset=utf-8",
              },
            });
      }

      url.host = PROXY_HOSTNAME;
      url.protocol = PROXY_PROTOCOL;
      const newRequest = createNewRequest(
        request,
        url,
        PROXY_HOSTNAME,
        originHostname
      );
      const originalResponse = await fetch(newRequest);
      const newResponseHeaders = setResponseHeaders(
        originalResponse,
        PROXY_HOSTNAME,
        originHostname,
        DEBUG
      );
      const contentType = newResponseHeaders.get("content-type") || "";
      let body;
      if (contentType.includes("text/")) {
        body = await replaceResponseText(
          originalResponse,
          PROXY_HOSTNAME,
          PATHNAME_REGEX,
          originHostname
        );
      } else {
        body = originalResponse.body;
      }
      return new Response(body, {
        status: originalResponse.status,
        headers: newResponseHeaders,
      });
    } catch (error) {
      logError(request, `Fetch error: ${error.message}`);
      return new Response("Internal Server Error", { status: 500 });
    }
  },
};
