import { buildApp } from './app';
import { env } from './config/env';
import { runMigrations } from './db/migrate';

async function start() {
  try {
    // Run DB migrations automatically on startup
    runMigrations();

    const app = await buildApp();

    const address = await app.listen({
      port: env.PORT,
      host: env.HOST,
    });

    console.log(`🚀 QuizForge Backend running at ${address}`);
    console.log(`📊 Health check available at ${address}/api/health`);

    const shutdown = async (signal: string) => {
      console.log(`\nReceived ${signal}. Shutting down gracefully...`);
      await app.close();
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
