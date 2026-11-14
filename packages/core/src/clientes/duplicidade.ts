/** Cliente já cadastrado na agência, com canais no formato guardado (E.164 e minúsculas). */
export interface ClienteExistente {
  readonly id: string;
  readonly nomeEmpresa: string;
  readonly whatsapp: string | null;
  readonly email: string | null;
}

/** Canais do cliente novo, já normalizados por `validarCadastroCliente`. */
export interface CanaisCliente {
  readonly whatsapp: string | null;
  readonly email: string | null;
}

export type MotivoDuplicidade = 'whatsapp' | 'email';

export interface Duplicidade {
  readonly cliente: ClienteExistente;
  readonly motivos: readonly MotivoDuplicidade[];
}

export interface OpcoesDuplicidade {
  /** Cliente que está sendo editado: não conta como duplicado de si mesmo. */
  readonly ignorarId?: string;
}

/**
 * Procura clientes da agência com o mesmo e-mail ou WhatsApp (RN-07). Quem chama deve passar só
 * clientes da própria agência (RN-75) e comparar canais já normalizados (RN-05), senão
 * "(31) 99999-8888" e "+5531999998888" não seriam reconhecidos como o mesmo número.
 */
export function encontrarDuplicidades(
  novo: CanaisCliente,
  existentes: readonly ClienteExistente[],
  opcoes: OpcoesDuplicidade = {},
): readonly Duplicidade[] {
  return existentes
    .filter((cliente) => cliente.id !== opcoes.ignorarId)
    .map((cliente) => ({ cliente, motivos: motivosDeCoincidencia(novo, cliente) }))
    .filter(({ motivos }) => motivos.length > 0);
}

function motivosDeCoincidencia(
  novo: CanaisCliente,
  existente: ClienteExistente,
): readonly MotivoDuplicidade[] {
  const motivos: MotivoDuplicidade[] = [];
  if (coincide(novo.whatsapp, existente.whatsapp)) motivos.push('whatsapp');
  if (coincide(novo.email, existente.email)) motivos.push('email');
  return motivos;
}

// Canal ausente nunca coincide: dois clientes sem e-mail não são duplicados por isso.
function coincide(a: string | null, b: string | null): boolean {
  return a !== null && a === b;
}
