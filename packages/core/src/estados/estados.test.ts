import { describe, expect, it } from 'vitest';
import { RegraVioladaError } from '../base/erros.js';
import { STATUS_ONBOARDING, type StatusOnboarding } from '../onboarding/index.js';
import {
  acoesDisponiveis,
  derivarStatus,
  destinoDaAcao,
  exigeAdmin,
  garantirReabertura,
  garantirTransicao,
  motivoDaAcao,
  motivoObrigatorio,
  proximoStatusAutomatico,
  recebeLembretes,
  situacaoAgendamento,
  transicaoPermitida,
  venceuConclusaoAutomatica,
  type FatosOnboarding,
} from './index.js';

const fatos = (parcial: Partial<FatosOnboarding> = {}): FatosOnboarding => ({
  abriuLink: true,
  conviteEnviado: false,
  formularioConcluido: false,
  acessosConcluidos: false,
  reuniao: 'nenhum',
  captacao: 'nenhum',
  entregueEm: null,
  ...parcial,
});

const prontoParaAgendar = { formularioConcluido: true, acessosConcluidos: true };

describe('RN-49 transições do status geral', () => {
  it('segue a jornada na ordem da spec', () => {
    const jornada: StatusOnboarding[] = [
      'criado',
      'convite_enviado',
      'em_andamento',
      'aguardando_agendamentos',
      'aguardando_reuniao',
      'aguardando_captacao',
      'em_producao',
      'primeiro_conteudo_entregue',
      'concluido',
    ];
    jornada.slice(1).forEach((para, i) => {
      expect(transicaoPermitida(jornada[i] ?? 'criado', para)).toBe(true);
    });
  });

  it('volta para trás enquanto a captação não aconteceu (reabertura ou agendamento cancelado)', () => {
    expect(transicaoPermitida('aguardando_reuniao', 'aguardando_agendamentos')).toBe(true);
    expect(transicaoPermitida('aguardando_captacao', 'em_andamento')).toBe(true);
  });

  it('não volta depois da captação realizada nem pula a entrega', () => {
    expect(transicaoPermitida('em_producao', 'aguardando_captacao')).toBe(false);
    expect(transicaoPermitida('em_producao', 'concluido')).toBe(false);
    expect(transicaoPermitida('em_andamento', 'primeiro_conteudo_entregue')).toBe(false);
  });

  it('pausa e cancela de qualquer status ativo', () => {
    for (const s of STATUS_ONBOARDING) {
      if (s === 'concluido' || s === 'cancelado' || s === 'pausado') continue;
      expect(transicaoPermitida(s, 'pausado')).toBe(true);
      expect(transicaoPermitida(s, 'cancelado')).toBe(true);
    }
    expect(transicaoPermitida('pausado', 'cancelado')).toBe(true);
  });

  it('concluído e cancelado são finais', () => {
    for (const s of STATUS_ONBOARDING) {
      expect(transicaoPermitida('concluido', s)).toBe(false);
      expect(transicaoPermitida('cancelado', s)).toBe(false);
    }
  });

  it('ao retomar, sai da pausa para a jornada, mas não direto para concluído', () => {
    expect(transicaoPermitida('pausado', 'aguardando_reuniao')).toBe(true);
    expect(transicaoPermitida('pausado', 'concluido')).toBe(false);
    expect(transicaoPermitida('pausado', 'pausado')).toBe(false);
  });

  it('rejeita transição inválida com erro de regra (seção 7)', () => {
    expect(() => {
      garantirTransicao('cancelado', 'em_andamento');
    }).toThrow(RegraVioladaError);
    expect(() => {
      garantirTransicao('em_andamento', 'aguardando_agendamentos');
    }).not.toThrow();
  });
});

describe('RN-49 a RN-52 status derivado das etapas e dos agendamentos', () => {
  it('sem abrir o link fica criado, ou convite_enviado se o convite saiu', () => {
    expect(derivarStatus(fatos({ abriuLink: false }))).toBe('criado');
    expect(derivarStatus(fatos({ abriuLink: false, conviteEnviado: true }))).toBe(
      'convite_enviado',
    );
  });

  it('RN-50 abriu o link e tem formulário ou acessos pendentes: em_andamento', () => {
    expect(derivarStatus(fatos())).toBe('em_andamento');
    expect(derivarStatus(fatos({ formularioConcluido: true, reuniao: 'agendado' }))).toBe(
      'em_andamento',
    );
  });

  it('formulário e acessos prontos, faltando algum agendamento: aguardando_agendamentos', () => {
    expect(derivarStatus(fatos(prontoParaAgendar))).toBe('aguardando_agendamentos');
    expect(derivarStatus(fatos({ ...prontoParaAgendar, reuniao: 'agendado' }))).toBe(
      'aguardando_agendamentos',
    );
    expect(derivarStatus(fatos({ ...prontoParaAgendar, reuniao: 'realizado' }))).toBe(
      'aguardando_agendamentos',
    );
  });

  it('tudo agendado: aguarda a reunião e depois a captação', () => {
    const agendados = { ...prontoParaAgendar, captacao: 'agendado' as const };
    expect(derivarStatus(fatos({ ...agendados, reuniao: 'agendado' }))).toBe('aguardando_reuniao');
    expect(derivarStatus(fatos({ ...agendados, reuniao: 'realizado' }))).toBe(
      'aguardando_captacao',
    );
  });

  it('RN-51 captação realizada: em_producao', () => {
    expect(derivarStatus(fatos({ captacao: 'realizado' }))).toBe('em_producao');
  });

  it('RN-52 entrega registrada: primeiro_conteudo_entregue', () => {
    expect(
      derivarStatus(fatos({ captacao: 'realizado', entregueEm: new Date('2026-11-20') })),
    ).toBe('primeiro_conteudo_entregue');
  });
});

describe('RN-49 situação dos agendamentos de um tipo', () => {
  it('realizado vale mais que ativo; ativo é agendado ou reagendado', () => {
    expect(situacaoAgendamento([])).toBe('nenhum');
    expect(situacaoAgendamento(['cancelado', 'nao_compareceu'])).toBe('nenhum');
    expect(situacaoAgendamento(['cancelado', 'reagendado'])).toBe('agendado');
    expect(situacaoAgendamento(['agendado'])).toBe('agendado');
    expect(situacaoAgendamento(['agendado', 'realizado'])).toBe('realizado');
  });
});

describe('RN-49 próximo status automático', () => {
  it('avança quando os fatos mudam', () => {
    expect(proximoStatusAutomatico('criado', fatos())).toBe('em_andamento');
    expect(proximoStatusAutomatico('em_andamento', fatos(prontoParaAgendar))).toBe(
      'aguardando_agendamentos',
    );
  });

  it('não mexe em pausado, cancelado nem concluído', () => {
    for (const s of ['pausado', 'cancelado', 'concluido'] as const) {
      expect(proximoStatusAutomatico(s, fatos({ captacao: 'realizado' }))).toBe(s);
    }
  });

  it('mantém o atual quando o derivado seria uma transição inválida', () => {
    expect(proximoStatusAutomatico('convite_enviado', fatos({ abriuLink: false }))).toBe(
      'convite_enviado',
    );
  });
});

describe('RN-52 conclusão automática', () => {
  const entrega = new Date('2026-11-10T15:00:00Z');

  it('conclui quando passaram N dias da entrega', () => {
    expect(venceuConclusaoAutomatica(entrega, new Date('2026-11-17T15:00:00Z'), 7)).toBe(true);
    expect(venceuConclusaoAutomatica(entrega, new Date('2026-11-17T14:59:59Z'), 7)).toBe(false);
  });
});

describe('RN-52 e RN-53 ações manuais', () => {
  it('só o Admin pausa, retoma e cancela; entrega e encerramento também o responsável', () => {
    expect(exigeAdmin('pausar')).toBe(true);
    expect(exigeAdmin('retomar')).toBe(true);
    expect(exigeAdmin('cancelar')).toBe(true);
    expect(exigeAdmin('registrar_entrega')).toBe(false);
    expect(exigeAdmin('encerrar')).toBe(false);
  });

  it('RN-53 pausar e cancelar exigem motivo; os outros aceitam sem', () => {
    expect(() => motivoDaAcao('pausar', '   ')).toThrow(RegraVioladaError);
    expect(() => motivoDaAcao('cancelar', undefined)).toThrow(RegraVioladaError);
    expect(motivoDaAcao('cancelar', '  cliente desistiu ')).toBe('cliente desistiu');
    expect(motivoDaAcao('retomar', undefined)).toBeNull();
    expect(motivoDaAcao('encerrar', ' ')).toBeNull();
  });

  it('pausar leva a pausado; não pausa duas vezes nem o que já terminou', () => {
    expect(destinoDaAcao('pausar', 'aguardando_reuniao', fatos())).toBe('pausado');
    expect(() => destinoDaAcao('pausar', 'pausado', fatos())).toThrow(RegraVioladaError);
    expect(() => destinoDaAcao('pausar', 'concluido', fatos())).toThrow(RegraVioladaError);
  });

  it('retomar volta ao status que as etapas indicam', () => {
    expect(destinoDaAcao('retomar', 'pausado', fatos(prontoParaAgendar))).toBe(
      'aguardando_agendamentos',
    );
    expect(() => destinoDaAcao('retomar', 'em_andamento', fatos())).toThrow(RegraVioladaError);
  });

  it('cancelar vale para qualquer ativo, inclusive pausado; não cancela o encerrado', () => {
    expect(destinoDaAcao('cancelar', 'pausado', fatos())).toBe('cancelado');
    expect(destinoDaAcao('cancelar', 'criado', fatos())).toBe('cancelado');
    expect(() => destinoDaAcao('cancelar', 'cancelado', fatos())).toThrow(RegraVioladaError);
    expect(() => destinoDaAcao('cancelar', 'concluido', fatos())).toThrow(RegraVioladaError);
  });

  it('RN-52 entrega só em produção; encerramento só depois da entrega', () => {
    expect(destinoDaAcao('registrar_entrega', 'em_producao', fatos())).toBe(
      'primeiro_conteudo_entregue',
    );
    expect(() => destinoDaAcao('registrar_entrega', 'aguardando_captacao', fatos())).toThrow(
      RegraVioladaError,
    );
    expect(destinoDaAcao('encerrar', 'primeiro_conteudo_entregue', fatos())).toBe('concluido');
    expect(() => destinoDaAcao('encerrar', 'em_producao', fatos())).toThrow(RegraVioladaError);
  });
});

describe('RN-52 e RN-53 ações disponíveis na tela', () => {
  it('Admin vê pausar e cancelar num ativo; membro não', () => {
    expect(acoesDisponiveis('em_andamento', true)).toEqual(['pausar', 'cancelar']);
    expect(acoesDisponiveis('em_andamento', false)).toEqual([]);
  });

  it('pausado: retomar e cancelar; em produção: entrega para qualquer um da equipe', () => {
    expect(acoesDisponiveis('pausado', true)).toEqual(['retomar', 'cancelar']);
    expect(acoesDisponiveis('em_producao', false)).toEqual(['registrar_entrega']);
    expect(acoesDisponiveis('primeiro_conteudo_entregue', false)).toEqual(['encerrar']);
  });

  it('encerrado não tem ação', () => {
    expect(acoesDisponiveis('cancelado', true)).toEqual([]);
    expect(acoesDisponiveis('concluido', true)).toEqual([]);
  });
});

describe('RN-53 lembretes cessam', () => {
  it('pausado, cancelado e concluído não recebem lembretes', () => {
    expect(recebeLembretes('pausado')).toBe(false);
    expect(recebeLembretes('cancelado')).toBe(false);
    expect(recebeLembretes('concluido')).toBe(false);
    expect(recebeLembretes('em_andamento')).toBe(true);
  });
});

describe('RN-54 reabrir etapa', () => {
  it('exige motivo', () => {
    expect(() => motivoObrigatorio('RN-54', ' ')).toThrow(RegraVioladaError);
    expect(motivoObrigatorio('RN-54', ' faltou o CNPJ ')).toBe('faltou o CNPJ');
  });

  it('reabre o formulário concluído de um onboarding ativo', () => {
    expect(() => {
      garantirReabertura('formulario', 'concluida', 'aguardando_reuniao');
    }).not.toThrow();
    expect(() => {
      garantirReabertura('formulario', 'concluida', 'pausado');
    }).not.toThrow();
  });

  it('recusa etapa não concluída, outras etapas e onboarding encerrado', () => {
    expect(() => {
      garantirReabertura('formulario', 'pendente', 'em_andamento');
    }).toThrow(RegraVioladaError);
    expect(() => {
      garantirReabertura('acessos', 'concluida', 'em_andamento');
    }).toThrow(RegraVioladaError);
    expect(() => {
      garantirReabertura('formulario', 'concluida', 'cancelado');
    }).toThrow(RegraVioladaError);
    expect(() => {
      garantirReabertura('formulario', 'concluida', 'concluido');
    }).toThrow(RegraVioladaError);
  });
});
