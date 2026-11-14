// Fuso da agência (D-14): datas vêm em UTC da API e são convertidas só aqui, na borda.
const FUSO_AGENCIA = 'America/Sao_Paulo';

/** `+5531999998888` vira `(31) 99999-8888`; números fora do padrão brasileiro ficam como estão. */
export function formatarTelefone(e164: string): string {
  const brasil = /^\+55(\d{2})(\d{4,5})(\d{4})$/.exec(e164);
  if (!brasil) return e164;
  const [, ddd, prefixo, final] = brasil;
  return `(${ddd ?? ''}) ${prefixo ?? ''}-${final ?? ''}`;
}

export function formatarDataHora(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: FUSO_AGENCIA,
  }).format(new Date(iso));
}

/** Monta o endereço completo do link a partir da origem do navegador. */
export function urlCompleta(origem: string, caminho: string): string {
  return `${origem.replace(/\/$/, '')}${caminho}`;
}
