/**
 * setupProxy.js
 * 
 * Proxies all /api requests to the Spring Boot backend on port 8080.
 * This file is automatically picked up by react-scripts.
 * No import needed in index.js.
 */
const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://localhost:8080',
      changeOrigin: true,
      secure: false,
      logLevel: 'debug',
    })
  );
};
