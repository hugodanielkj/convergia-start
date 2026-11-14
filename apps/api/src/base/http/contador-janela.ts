/** Situação de um contador de janela fixa. */
export interface SituacaoContador {
  readonly total: number;
  /** Instante (ms desde a época) em que a janela recomeça do zero. */
  readonly reiniciaEm: number;
}

/**
 * Porta dos contadores do limite de requisições (RN-76). Hoje em memória, porque a API roda em
 * uma instância; com mais de uma, entra uma implementação no Redis sem mudar as regras
 * (decisão 2026-11-14-a-protecoes-link-publico).
 */
export interface ContadorJanela {
  incrementar(chave: string, janelaMs: number): Promise<SituacaoContador>;
  consultar(chave: string): Promise<SituacaoContador | null>;
}

/** Teto de chaves guardadas, para um ataque com muitos IPs não esgotar a memória. */
const MAXIMO_CHAVES_PADRAO = 100_000;

export class ContadorEmMemoria implements ContadorJanela {
  private readonly janelas = new Map<string, { total: number; reiniciaEm: number }>();

  constructor(
    private readonly agora: () => number = Date.now,
    private readonly maximoChaves: number = MAXIMO_CHAVES_PADRAO,
  ) {}

  incrementar(chave: string, janelaMs: number): Promise<SituacaoContador> {
    const instante = this.agora();
    const atual = this.janelas.get(chave);
    if (atual && atual.reiniciaEm > instante) {
      atual.total += 1;
      return Promise.resolve({ ...atual });
    }
    this.janelas.delete(chave);
    this.abrirEspaco(instante);
    const nova = { total: 1, reiniciaEm: instante + janelaMs };
    this.janelas.set(chave, nova);
    return Promise.resolve({ ...nova });
  }

  consultar(chave: string): Promise<SituacaoContador | null> {
    const atual = this.janelas.get(chave);
    if (!atual || atual.reiniciaEm <= this.agora()) return Promise.resolve(null);
    return Promise.resolve({ ...atual });
  }

  /** Cheio: apaga as janelas vencidas; se ainda faltar espaço, a mais antiga. */
  private abrirEspaco(instante: number): void {
    if (this.janelas.size < this.maximoChaves) return;
    for (const [chave, janela] of this.janelas) {
      if (janela.reiniciaEm <= instante) this.janelas.delete(chave);
    }
    const maisAntiga = this.janelas.keys().next();
    if (this.janelas.size >= this.maximoChaves && !maisAntiga.done) {
      this.janelas.delete(maisAntiga.value);
    }
  }
}
