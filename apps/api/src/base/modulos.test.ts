import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { encontrarModulos, registrarModulos } from './modulos.js';

describe('carregamento de módulos', () => {
  it('encontra o index de cada módulo, inclusive em subpastas', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'modulos-'));
    await mkdir(join(dir, 'b'), { recursive: true });
    await mkdir(join(dir, 'a', 'sub'), { recursive: true });
    await writeFile(join(dir, 'b', 'index.ts'), '');
    await writeFile(join(dir, 'a', 'sub', 'index.js'), '');
    await writeFile(join(dir, 'a', 'rotas.ts'), '');
    await writeFile(join(dir, 'b', 'index.test.ts'), '');

    expect(await encontrarModulos(dir)).toEqual([
      join(dir, 'a', 'sub', 'index.js'),
      join(dir, 'b', 'index.ts'),
    ]);
  });

  it('falha ao iniciar se um módulo não exporta plugin padrão', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'modulos-'));
    await mkdir(join(dir, 'quebrado'));
    await writeFile(join(dir, 'quebrado', 'index.js'), 'export const nada = 1;');
    const app = Fastify();
    registrarModulos(app, dir);

    await expect(app.ready()).rejects.toThrow(/sem plugin padrão/);
  });
});
