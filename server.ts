import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import { WebSocketServer } from 'ws';
import { createServer as createViteServer } from 'vite';
import { initDatabase, persistNow } from './server/persistence/index.ts';
import { RoomManager } from './server/game/RoomManager.ts';
import { createApiRouter } from './server/api/routes.ts';

async function bootstrap() {
  await initDatabase();

  const app = express();
  app.use(express.json({ limit: '1mb' }));

  const roomManager = new RoomManager();
  app.use('/api', createApiRouter(roomManager));

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });
  wss.on('connection', (ws) => {
    roomManager.handleConnection(ws);
  });

  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const port = Number(process.env.PORT || 3000);
  server.listen(port, '0.0.0.0', () => {
    console.log(`STRIKELINE server listening on http://0.0.0.0:${port}`);
  });

  const shutdown = () => {
    persistNow();
    server.close(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
