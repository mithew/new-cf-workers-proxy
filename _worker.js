// LRU Cache 实现
class LRUCache {
  constructor(maxSize = 10000) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  /**
   * 获取缓存中的记录，并将其移到 Map 的末尾以表示最近使用
   * @param {string} key 
   * @returns {object|null}
   */
  get(key) {
    if (!this.cache.has(key)) {
      return null;
    }
    const value = this.cache.get(key);
    // 将键移到 Map 的末尾，表示最近使用
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  /**
   * 设置缓存记录，并在超过最大容量时移除最少使用的记录
   * @param {string} key 
   * @param {object} value 
   */
  set(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // 移除最先插入的键，即最少使用的键
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }

  /**
   * 删除缓存中的特定键
   * @param {string} key 
   */
  delete(key) {
    this.cache.delete(key);
  }

  /**
   * 清空缓存
   */
  clear() {
    this.cache.clear();
  }

  /**
   * 获取缓存的大小
   * @returns {number}
   */
  size() {
    return this.cache.size;
  }
}

// 全局内存缓存实例
const MEMORY_CACHE = new LRUCache(10000); // 最大缓存容量为10,000

const CACHE_CLEANUP_INTERVAL = 60000; // 1分钟清理一次缓存

// 定期清理过期的内存缓存
function cleanupCache() {
  const now = Date.now();
  for (const [ip, data] of MEMORY_CACHE.cache.entries()) {
    if (now - data.timestamp > data.windowMs) {
      MEMORY_CACHE.delete(ip);
    }
  }
}

// 启动定期清理任务
setInterval(cleanupCache, CACHE_CLEANUP_INTERVAL);

/**
 * 日志记录错误信息
 * @param {Request} request 
 * @param {string} message 
 */
function logError(request, message) {
  console.error(
    `${message}, clientIp: ${request.headers.get("cf-connecting-ip")}, user-agent: ${request.headers.get("user-agent")}, url: ${request.url}`
  );
}

/**
 * 创建新的代理请求
 * @param {Request} request 
 * @param {URL} url 
 * @param {string} proxyHostname 
 * @param {string} originHostname 
 * @returns {Request}
 */
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

/**
 * 设置响应头
 * @param {Response} originalResponse 
 * @param {string} proxyHostname 
 * @param {string} originHostname 
 * @param {boolean} DEBUG 
 * @returns {Headers}
 */
function setResponseHeaders(originalResponse, proxyHostname, originHostname, DEBUG) {
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
 * 替换响应内容
 * @param {Response} originalResponse 
 * @param {string} proxyHostname 
 * @param {string} pathnameRegex 
 * @param {string} originHostname 
 * @returns {Promise<string|ReadableStream>}
 */
async function replaceResponseText(originalResponse, proxyHostname, pathnameRegex, originHostname) {
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

/**
 * 生成自定义 nginx 错误页面
 * @returns {Promise<string>}
 */
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

/**
 * 检查请求频率是否超过限制
 * @param {string} ip 客户端 IP
 * @param {KVNamespace} store KV 存储实例
 * @param {object} env 环境变量
 * @returns {Promise<boolean>} 是否被限制
 */
async function checkRequestRate(ip, store, env) {
  if (!ip || !store) {
    console.error("Missing required parameters for rate limiting");
    return false;
  }

  const windowMs = parseInt(env.RATE_LIMIT_WINDOW_MS) || 60 * 1000; // 默认 1分钟
  const limit = parseInt(env.RATE_LIMIT_MAX_REQUESTS) || 15; // 默认 15次
  const now = Date.now();
  const kvKey = `rate_limit:${ip}`;

  try {
    // 从内存缓存中获取记录
    let record = MEMORY_CACHE.get(ip);

    if (!record) {
      // 如果内存中没有，从 KV 中读取
      record = await store.get(kvKey, { type: "json" });

      if (record) {
        // 如果时间窗口已过期，重置计数
        if (now - record.timestamp > windowMs) {
          record = null;
        }
      }

      // 如果没有记录或已过期，创建新记录
      if (!record) {
        record = {
          count: 0,
          timestamp: now,
          windowMs: windowMs,
          lastKvUpdate: now
        };
      }

      // 放入内存缓存
      MEMORY_CACHE.set(ip, record);
    }

    // 增加计数
    record.count += 1;

    // 判断是否需要更新 KV
    const shouldUpdateKV = 
      record.count % 10 === 0 || 
      (now - record.lastKvUpdate) > 10000; // 每10次请求或10秒更新一次

    if (shouldUpdateKV) {
      await store.put(kvKey, JSON.stringify({
        count: record.count,
        timestamp: record.timestamp
      }), {
        expirationTtl: Math.ceil(windowMs / 1000) // 设置过期时间为窗口时间
      });
      record.lastKvUpdate = now;
    }

    // 更新内存缓存
    MEMORY_CACHE.set(ip, record);

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
        RATE_LIMIT_ENABLED = false, // 是否启用频率限制
      } = env;

      const url = new URL(request.url);
      const originHostname = url.hostname;
      const clientIp = request.headers.get("cf-connecting-ip");

      // 检查请求频率
      if ((RATE_LIMIT_ENABLED === "true" || RATE_LIMIT_ENABLED === true) && env.RATE_LIMIT_STORE) {
        const isRateLimited = await checkRequestRate(clientIp, env.RATE_LIMIT_STORE, env);

        if (isRateLimited) {
          // 返回简单的文本消息而不是 nginx 页面
          return new Response("Access frequency is too high", { status: 429 });
        }
      }

      // 路径匹配检查
      if (PATHNAME_REGEX) {
        if (url.pathname === "/" || url.pathname === "") {
          // 如果只访问域名，返回自定义 nginx 页面
          return new Response(await nginx(), {
            headers: { "Content-Type": "text/html; charset=utf-8" },
          });
        } else if (!new RegExp(PATHNAME_REGEX).test(url.pathname)) {
          // 路径不匹配时返回简单的文本消息
          return new Response("The requested resource does not exist", { status: 404 });
        }
      }

      // 其他验证检查
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

      // 修改请求的主机名和协议
      url.host = PROXY_HOSTNAME;
      url.protocol = PROXY_PROTOCOL;
      const newRequest = createNewRequest(
        request,
        url,
        PROXY_HOSTNAME,
        originHostname
      );

      // 发起代理请求
      const originalResponse = await fetch(newRequest);

      // 修改响应头
      const newResponseHeaders = setResponseHeaders(
        originalResponse,
        PROXY_HOSTNAME,
        originHostname,
        DEBUG
      );

      const contentType = newResponseHeaders.get("content-type") || "";
      let body;
      if (contentType.includes("text/")) {
        // 替换文本内容
        body = await replaceResponseText(
          originalResponse,
          PROXY_HOSTNAME,
          PATHNAME_REGEX,
          originHostname
        );
      } else {
        body = originalResponse.body;
      }

      // 返回修改后的响应
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
