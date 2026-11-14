/** Violação de regra de negócio. `codigo` é o ID da regra, ex. "RN-07". */
export class RegraVioladaError extends Error {
  override readonly name = 'RegraVioladaError';

  constructor(
    readonly codigo: `RN-${string}`,
    mensagem: string,
  ) {
    super(mensagem);
  }
}

export class NaoEncontradoError extends Error {
  override readonly name = 'NaoEncontradoError';

  constructor(recurso: string) {
    super(`${recurso} não encontrado`);
  }
}

export class NaoAutenticadoError extends Error {
  override readonly name = 'NaoAutenticadoError';

  constructor() {
    super('Sessão inválida ou expirada');
  }
}

export class ProibidoError extends Error {
  override readonly name = 'ProibidoError';

  constructor(readonly codigo: `RN-${string}`) {
    super('Você não tem permissão para esta ação');
  }
}
