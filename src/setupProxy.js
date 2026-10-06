const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function setupProxy(app, target = process.env.API_PROXY_TARGET || `http://127.0.0.1:${process.env.API_PORT || 5000}`) {
  app.use(createProxyMiddleware({
    pathFilter: '/api',
    target,
    changeOrigin: true,
    proxyTimeout: 10000,
    on: {
      error: (error, req, res) => {
        if (res.headersSent) return res.end();
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'The backend is unavailable. Check the terminal running npm run dev; confirm MongoDB is running and MONGO_URI is correct.' }));
        console.error(`API proxy unavailable (${error.code || 'connection error'}). Check backend startup above.`);
      }
    }
  }));
};
