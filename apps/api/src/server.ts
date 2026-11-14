import { construirApp } from './app.js';
import { carregarEnv } from './config/env.js';

const env = carregarEnv();
const app = construirApp(env);

const encerrar = async (): Promise<void> => {
  await app.close();
  process.exit(0);
};
process.on('SIGTERM', () => void encerrar());
process.on('SIGINT', () => void encerrar());

await app.listen({ port: env.API_PORT, host: '0.0.0.0' });
