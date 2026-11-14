import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Armazenamento } from '@convergia/core/uploads';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ArmazenamentoLocal } from './local.js';

let pasta: string;
let storage: Armazenamento;

beforeAll(async () => {
  pasta = await mkdtemp(join(tmpdir(), 'convergia-storage-'));
  storage = new ArmazenamentoLocal(pasta);
});
afterAll(() => rm(pasta, { recursive: true, force: true }));

describe('RN-69 storage local', () => {
  it('guarda, lê e apaga por chave, criando as pastas', async () => {
    await storage.guardar('ag/cli/a.png', Uint8Array.from([1, 2, 3]), 'image/png');
    expect([...((await storage.ler('ag/cli/a.png')) ?? [])]).toEqual([1, 2, 3]);
    await storage.apagar('ag/cli/a.png');
    expect(await storage.ler('ag/cli/a.png')).toBeNull();
  });

  it('apagar chave inexistente não dá erro', async () => {
    await expect(storage.apagar('nao/existe.png')).resolves.toBeUndefined();
  });

  it('recusa chave que sai da pasta raiz', async () => {
    await expect(storage.guardar('../fora.png', Uint8Array.from([1]), 'image/png')).rejects.toThrow(
      /inválida/,
    );
    await expect(storage.ler('../../etc/passwd')).rejects.toThrow(/inválida/);
  });
});
