import { describe, expect, it } from 'vitest';
import {
  PLATAFORMAS_ACESSO,
  etapaAcessos,
  instrucoesDe,
  validarMarcacao,
  type SituacaoAcesso,
} from './index.js';

const obrigatorias = ['instagram', 'facebook'] as const;
const s = (status: SituacaoAcesso['status'], informado = false): SituacaoAcesso => ({
  status,
  informado,
});

describe('RN-27 status da etapa de acessos', () => {
  it('conclui só quando todas as obrigatórias estão concedidas', () => {
    expect(
      etapaAcessos(
        { instagram: s('concedido'), facebook: s('concedido'), tiktok: s('pendente') },
        obrigatorias,
      ),
    ).toBe('concluida');
  });

  it('opcional pendente ou inválida não impede a conclusão', () => {
    expect(
      etapaAcessos(
        { instagram: s('concedido'), facebook: s('concedido'), google: s('invalido') },
        obrigatorias,
      ),
    ).toBe('concluida');
  });

  it('obrigatória pendente ou inválida mantém a etapa aberta', () => {
    expect(etapaAcessos({ instagram: s('concedido'), facebook: s('invalido') }, obrigatorias)).toBe(
      'em_andamento',
    );
  });

  it('fica pendente sem nenhuma atividade', () => {
    expect(etapaAcessos({ instagram: s('pendente'), facebook: s('pendente') }, obrigatorias)).toBe(
      'pendente',
    );
  });

  it('cliente que avisou ter adicionado a agência já coloca a etapa em andamento', () => {
    expect(
      etapaAcessos({ instagram: s('pendente', true), facebook: s('pendente') }, obrigatorias),
    ).toBe('em_andamento');
  });
});

describe('RN-28 marcação manual pela agência', () => {
  it('concedido não precisa de motivo', () => {
    expect(validarMarcacao('concedido', undefined)).toEqual({ ok: true, motivo: null });
  });

  it('inválido exige motivo', () => {
    expect(validarMarcacao('invalido', '  ')).toEqual({ ok: false, erro: 'motivo_obrigatorio' });
    expect(validarMarcacao('invalido', ' Convite não encontrado ')).toEqual({
      ok: true,
      motivo: 'Convite não encontrado',
    });
  });

  it('limita o tamanho do motivo', () => {
    expect(validarMarcacao('invalido', 'x'.repeat(501))).toEqual({
      ok: false,
      erro: 'motivo_longo',
    });
  });
});

describe('RN-22 e RN-29 instruções', () => {
  it('toda plataforma tem passos e cita o identificador da agência', () => {
    for (const p of PLATAFORMAS_ACESSO) {
      const { passos } = instrucoesDe(p, 'agencia@exemplo.com');
      expect(passos.length).toBeGreaterThan(1);
      expect(passos.join(' ')).toContain('agencia@exemplo.com');
    }
  });

  it('nunca pede senha', () => {
    for (const p of PLATAFORMAS_ACESSO) {
      const texto = instrucoesDe(p, null).passos.join(' ').toLowerCase();
      expect(texto).not.toMatch(/(informe|envie|compartilhe|digite) (a |sua )?senha/);
    }
  });

  it('sem identificador configurado, orienta a pedir à agência', () => {
    expect(instrucoesDe('instagram', null).passos.join(' ')).toContain('peça');
  });
});
