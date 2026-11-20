/** Configurações › Geral como a API devolve (S8-2, RN-03). */
export interface ConfigGeral {
  nomeAgencia: string;
  canalNotificacaoPadrao: 'whatsapp' | 'email';
  prazoProducaoDiasUteis: number;
  validadeLinkDias: number;
  antecedenciaMinimaHoras: number;
  intervaloReuniaoCaptacaoDiasMin: number;
  limiteReagendamentos: number;
  antecedenciaReagendamentoHoras: number;
  duracaoReuniaoMinutos: number;
  duracaoCaptacaoMinutos: number;
  diasSemAcaoParaAlerta: number;
  intervaloMinimoReenvioHoras: number;
  diasConclusaoAutomatica: number;
}

export type CampoNumerico = Exclude<keyof ConfigGeral, 'nomeAgencia' | 'canalNotificacaoPadrao'>;
export type Limites = Record<CampoNumerico, { min: number; max: number }>;

interface DefinicaoCampo {
  readonly campo: CampoNumerico;
  readonly rotulo: string;
  readonly unidade: string;
  readonly dica?: string;
}

/** Campos numéricos por seção, na ordem da tela. */
export const SECOES: readonly { titulo: string; campos: readonly DefinicaoCampo[] }[] = [
  {
    titulo: 'Prazos',
    campos: [
      {
        campo: 'prazoProducaoDiasUteis',
        rotulo: 'Prazo de produção',
        unidade: 'dias úteis',
        dica: 'Contados a partir da captação para liberar o primeiro conteúdo.',
      },
      {
        campo: 'validadeLinkDias',
        rotulo: 'Validade do link',
        unidade: 'dias',
        dica: 'Vale para os links gerados depois de salvar.',
      },
      {
        campo: 'diasConclusaoAutomatica',
        rotulo: 'Conclusão automática',
        unidade: 'dias após a entrega',
      },
    ],
  },
  {
    titulo: 'Agenda',
    campos: [
      {
        campo: 'antecedenciaMinimaHoras',
        rotulo: 'Antecedência mínima para agendar',
        unidade: 'horas',
      },
      {
        campo: 'intervaloReuniaoCaptacaoDiasMin',
        rotulo: 'Intervalo entre reunião e captação',
        unidade: 'dias',
      },
      { campo: 'duracaoReuniaoMinutos', rotulo: 'Duração da reunião', unidade: 'minutos' },
      { campo: 'duracaoCaptacaoMinutos', rotulo: 'Duração da captação', unidade: 'minutos' },
      { campo: 'limiteReagendamentos', rotulo: 'Limite de reagendamentos', unidade: 'vezes' },
      {
        campo: 'antecedenciaReagendamentoHoras',
        rotulo: 'Antecedência para reagendar',
        unidade: 'horas',
      },
    ],
  },
  {
    titulo: 'Avisos e reenvios',
    campos: [
      {
        campo: 'diasSemAcaoParaAlerta',
        rotulo: 'Avisar a agência se o cliente ficar parado',
        unidade: 'dias',
      },
      {
        campo: 'intervaloMinimoReenvioHoras',
        rotulo: 'Intervalo mínimo entre reenvios',
        unidade: 'horas',
      },
    ],
  },
];

/** "Entre 1 e 30 dias úteis." */
export const textoLimite = (limite: { min: number; max: number }, unidade: string): string =>
  `Entre ${String(limite.min)} e ${String(limite.max)} ${unidade}.`;

/** Lê um campo numérico digitado; `null` se não for inteiro dentro do limite. */
export function lerNumero(texto: string, limite: { min: number; max: number }): number | null {
  if (!/^\d+$/.test(texto.trim())) return null;
  const n = Number(texto);
  return n >= limite.min && n <= limite.max ? n : null;
}
