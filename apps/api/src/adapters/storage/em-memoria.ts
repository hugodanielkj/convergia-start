import type { Armazenamento } from '@convergia/core/uploads';

/** Storage em memória para testes. */
export class ArmazenamentoEmMemoria implements Armazenamento {
  readonly arquivos = new Map<string, { conteudo: Uint8Array; tipo: string }>();

  guardar(chave: string, conteudo: Uint8Array, tipo: string): Promise<void> {
    this.arquivos.set(chave, { conteudo, tipo });
    return Promise.resolve();
  }

  ler(chave: string): Promise<Uint8Array | null> {
    return Promise.resolve(this.arquivos.get(chave)?.conteudo ?? null);
  }

  apagar(chave: string): Promise<void> {
    this.arquivos.delete(chave);
    return Promise.resolve();
  }
}
