import { describe, expect, it } from 'vitest';
import {
  alertaPedeEmail,
  destinatariosDoAlerta,
  ehTipoAlerta,
  lembretesEsgotados,
  proximoPassoEmailAlerta,
  semAcaoHaDias,
  textoDoAlerta,
} from './index.js';

const agora = new Date('2026-11-16T12:00:00Z');
const horas = (h: number) => new Date(agora.getTime() - h * 3_600_000);

describe('RN-58 alertas internos', () => {
  it('monta o texto com a empresa e o complemento', () => {
    expect(textoDoAlerta('concluiu', 'Padaria')).toBe(
      'Padaria concluiu todas as etapas do onboarding.',
    );
    expect(textoDoAlerta('acesso_invalido', 'Padaria', 'instagram')).toBe(
      'Padaria tem um acesso marcado como inválido. (instagram)',
    );
    expect(ehTipoAlerta('concluiu')).toBe(true);
    expect(ehTipoAlerta('outro')).toBe(false);
  });

  it('acesso inválido e não comparecimento marcados pelo próprio responsável não pedem e-mail', () => {
    expect(alertaPedeEmail('acesso_invalido', 'ana', 'ana')).toBe(false);
    expect(alertaPedeEmail('nao_compareceu', 'ana', 'ana')).toBe(false);
    expect(alertaPedeEmail('acesso_invalido', 'ana', 'rui')).toBe(true);
    expect(alertaPedeEmail('concluiu', 'ana', 'ana')).toBe(true);
    expect(alertaPedeEmail('nao_compareceu', 'ana', null)).toBe(true);
  });

  it('e-mail vai ao responsável; se inativo, aos Admins ativos', () => {
    const ana = { email: 'ana@x.com', ativo: true };
    const admins = [
      { email: 'chefe@x.com', ativo: true },
      { email: 'ex@x.com', ativo: false },
    ];
    expect(destinatariosDoAlerta(ana, admins)).toEqual(['ana@x.com']);
    expect(destinatariosDoAlerta({ ...ana, ativo: false }, admins)).toEqual(['chefe@x.com']);
    expect(destinatariosDoAlerta({ ...ana, ativo: false }, [])).toEqual([]);
  });

  it('sem ação: a partir de X dias da última atividade', () => {
    expect(semAcaoHaDias(horas(71), agora, 3)).toBe(false);
    expect(semAcaoHaDias(horas(72), agora, 3)).toBe(true);
  });

  it('lembretes esgotados: 24h depois do último lembrete', () => {
    expect(lembretesEsgotados(horas(23), agora)).toBe(false);
    expect(lembretesEsgotados(horas(24), agora)).toBe(true);
  });
});

describe('retentativa do e-mail do alerta', () => {
  it('sucesso encerra; falha espera 1 e 5 minutos e desiste na terceira', () => {
    expect(proximoPassoEmailAlerta(0, { ok: true }, agora)).toEqual({ acao: 'enviado' });
    expect(proximoPassoEmailAlerta(0, { ok: false, semCredencial: false }, agora)).toEqual({
      acao: 'aguardar',
      em: new Date(agora.getTime() + 60_000),
      contaTentativa: true,
    });
    expect(proximoPassoEmailAlerta(1, { ok: false, semCredencial: false }, agora)).toEqual({
      acao: 'aguardar',
      em: new Date(agora.getTime() + 300_000),
      contaTentativa: true,
    });
    expect(proximoPassoEmailAlerta(2, { ok: false, semCredencial: false }, agora)).toEqual({
      acao: 'falhou',
    });
  });

  it('sem credencial de e-mail, espera 15 minutos sem gastar tentativa', () => {
    expect(proximoPassoEmailAlerta(2, { ok: false, semCredencial: true }, agora)).toEqual({
      acao: 'aguardar',
      em: new Date(agora.getTime() + 900_000),
      contaTentativa: false,
    });
  });
});
