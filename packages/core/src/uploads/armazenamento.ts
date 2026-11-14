/** Porta do storage de arquivos (RN-69). Implementações: pasta local em dev, S3 compatível em produção. */
export interface Armazenamento {
  guardar(chave: string, conteudo: Uint8Array, tipo: string): Promise<void>;
  /** `null` quando a chave não existe. */
  ler(chave: string): Promise<Uint8Array | null>;
  apagar(chave: string): Promise<void>;
}
