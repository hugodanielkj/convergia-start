import { describe, expect, it } from 'vitest';
import { indicadoresAtencao, progressoEtapas, type EntradaAtencao } from './index.js';

const AGORA = new Date('2026-11-16T12:00:00Z');
const diasAtras = (d: number) => new Date(AGORA.getTime() - d * 86_400_000);
const base: EntradaAtencao = {
  statusGeral: 'em_andamento',
  acessoInvalido: false,
  linkExpirado: false,
  ultimaAtividade: diasAtras(1),
  agora: AGORA,
  diasSemAcao: 3,
};

describe('RN-63 progresso', () => {
  it('conta etapas concluídas sobre o total de 4', () => {
    expect(
      progressoEtapas([
        { status: 'concluida' },
        { status: 'concluida' },
        { status: 'em_andamento' },
        { status: 'pendente' },
      ]),
    ).toEqual({ concluidas: 2, total: 4 });
  });
});

describe('RN-63 indicadores de atenção', () => {
  it('sem problemas, sem indicadores', () => {
    expect(indicadoresAtencao(base)).toEqual([]);
  });

  it('acesso inválido e link expirado aparecem', () => {
    expect(indicadoresAtencao({ ...base, acessoInvalido: true, linkExpirado: true })).toEqual([
      'acesso_invalido',
      'link_expirado',
    ]);
  });

  it('parado quando passou do limite de dias sem ação (RN-58)', () => {
    expect(indicadoresAtencao({ ...base, ultimaAtividade: diasAtras(3) })).toEqual(['parado']);
    expect(indicadoresAtencao({ ...base, ultimaAtividade: diasAtras(2) })).toEqual([]);
  });

  it('onboarding encerrado ou pausado não pede atenção de prazo/link/inatividade', () => {
    for (const statusGeral of ['concluido', 'cancelado', 'pausado'] as const) {
      expect(
        indicadoresAtencao({
          ...base,
          statusGeral,
          linkExpirado: true,
          ultimaAtividade: diasAtras(30),
        }),
      ).toEqual([]);
    }
  });
});
