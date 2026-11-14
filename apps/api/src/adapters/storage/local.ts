import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import type { Armazenamento } from '@convergia/core/uploads';

/**
 * Storage em pasta local, para desenvolvimento e testes. Em produção entra um adaptador
 * S3 compatível com a mesma interface (RN-69, D-12).
 */
export class ArmazenamentoLocal implements Armazenamento {
  private readonly raiz: string;

  constructor(pasta: string) {
    this.raiz = resolve(pasta);
  }

  /** Impede que uma chave maliciosa ("../") saia da pasta raiz. */
  private caminho(chave: string): string {
    const destino = resolve(this.raiz, chave);
    if (!destino.startsWith(this.raiz + sep)) throw new Error('Chave de armazenamento inválida');
    return destino;
  }

  async guardar(chave: string, conteudo: Uint8Array): Promise<void> {
    const destino = this.caminho(chave);
    await mkdir(dirname(destino), { recursive: true });
    await writeFile(destino, conteudo);
  }

  async ler(chave: string): Promise<Uint8Array | null> {
    try {
      return await readFile(this.caminho(chave));
    } catch (erro) {
      if ((erro as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw erro;
    }
  }

  async apagar(chave: string): Promise<void> {
    await rm(this.caminho(chave), { force: true });
  }
}
