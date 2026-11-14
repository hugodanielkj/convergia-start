import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { FastifyInstance, FastifyPluginAsync } from 'fastify';

const INDICE = /^index\.(ts|js)$/;

/** Caminhos de todos os `index.ts|js` abaixo de `dir`, em ordem estável. */
export async function encontrarModulos(dir: string): Promise<string[]> {
  const entradas = await readdir(dir, { withFileTypes: true, recursive: true });
  return entradas
    .filter((e) => e.isFile() && INDICE.test(e.name))
    .map((e) => join(e.parentPath, e.name))
    .sort();
}

/**
 * Registra cada pasta de `src/modulos` que tenha `index.ts` exportando um plugin Fastify (D-24).
 * Não há arquivo central de rotas, então duas trilhas criam módulos sem conflito.
 * O import dinâmico fica neste arquivo (e não numa lib) para funcionar igual no Vitest, tsx e Node.
 */
export function registrarModulos(app: FastifyInstance, dir: string): void {
  void app.register(async (escopo) => {
    for (const caminho of await encontrarModulos(dir)) {
      const modulo = (await import(caminho)) as { default?: FastifyPluginAsync };
      if (typeof modulo.default !== 'function') {
        throw new Error(`Módulo sem plugin padrão exportado: ${caminho}`);
      }
      await escopo.register(modulo.default);
    }
  });
}
