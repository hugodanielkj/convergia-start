import { describe, expect, it } from 'vitest';
import {
  acessosAvisados,
  etapaInicial,
  liberacaoEtapas,
  proximaEtapa,
  type FatosLiberacao,
} from './index.js';

const nada: FatosLiberacao = {
  formularioEnviado: false,
  acessosAvisados: false,
  reuniaoAgendada: false,
  captacaoAgendada: false,
};
const liberadas = (f: Partial<FatosLiberacao>) =>
  liberacaoEtapas({ ...nada, ...f })
    .filter((e) => e.liberada)
    .map((e) => e.etapa);

describe('RN-79 liberação sequencial das etapas', () => {
  it('no começo só o formulário está liberado', () => {
    expect(liberadas({})).toEqual(['formulario']);
  });

  it('formulário enviado libera Acessos', () => {
    expect(liberadas({ formularioEnviado: true })).toEqual(['formulario', 'acessos']);
  });

  it('avisar em todas as plataformas libera Reunião', () => {
    expect(liberadas({ formularioEnviado: true, acessosAvisados: true })).toEqual([
      'formulario',
      'acessos',
      'reuniao',
    ]);
  });

  it('reunião agendada libera Captação', () => {
    expect(
      liberadas({ formularioEnviado: true, acessosAvisados: true, reuniaoAgendada: true }),
    ).toEqual(['formulario', 'acessos', 'reuniao', 'captacao']);
  });

  it('formulário reaberto com os acessos já avisados: nada volta a travar', () => {
    expect(liberadas({ acessosAvisados: true })).toEqual(['formulario', 'acessos', 'reuniao']);
  });

  it('formulário reaberto antes dos avisos: Acessos volta a travar', () => {
    expect(liberadas({ formularioEnviado: false })).toEqual(['formulario']);
  });

  it('formulário reaberto: Acessos já feita continua liberada, e a Reunião também', () => {
    expect(liberadas({ acessosAvisados: true, reuniaoAgendada: true })).toEqual([
      'formulario',
      'acessos',
      'reuniao',
      'captacao',
    ]);
  });

  it('acesso inválido antes de agendar: a Reunião volta a travar', () => {
    expect(liberadas({ formularioEnviado: true, acessosAvisados: false })).toEqual([
      'formulario',
      'acessos',
    ]);
  });

  it('acesso inválido com a reunião já agendada: a reunião continua valendo', () => {
    expect(liberadas({ formularioEnviado: true, reuniaoAgendada: true })).toEqual([
      'formulario',
      'acessos',
      'reuniao',
      'captacao',
    ]);
  });

  it('marca o que já foi feito', () => {
    const r = liberacaoEtapas({ ...nada, formularioEnviado: true });
    expect(r.map((e) => [e.etapa, e.feita])).toEqual([
      ['formulario', true],
      ['acessos', false],
      ['reuniao', false],
      ['captacao', false],
    ]);
  });
});

describe('RN-79 acessos avisados', () => {
  it('todas as escolhidas avisadas pelo cliente ou concedidas pela agência', () => {
    expect(
      acessosAvisados([
        { status: 'pendente', informado: true },
        { status: 'concedido', informado: false },
      ]),
    ).toBe(true);
  });

  it('falta avisar uma: não libera', () => {
    expect(
      acessosAvisados([
        { status: 'pendente', informado: true },
        { status: 'pendente', informado: false },
      ]),
    ).toBe(false);
  });

  it('inválida não conta, mesmo que o cliente tenha avisado antes', () => {
    expect(acessosAvisados([{ status: 'invalido', informado: true }])).toBe(false);
  });

  it('sem plataformas não libera', () => {
    expect(acessosAvisados([])).toBe(false);
  });
});

describe('RN-79 navegação do cliente', () => {
  it('abre na primeira etapa liberada que ainda não foi feita', () => {
    expect(etapaInicial(liberacaoEtapas({ ...nada, formularioEnviado: true }))).toBe('acessos');
  });

  it('com tudo feito, abre na última', () => {
    const tudo = { formularioEnviado: true, acessosAvisados: true };
    expect(
      etapaInicial(liberacaoEtapas({ ...tudo, reuniaoAgendada: true, captacaoAgendada: true })),
    ).toBe('captacao');
  });

  it('a próxima depois da captação não existe', () => {
    expect(proximaEtapa('formulario')).toBe('acessos');
    expect(proximaEtapa('captacao')).toBeNull();
  });
});
