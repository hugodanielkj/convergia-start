import { describe, expect, it } from 'vitest';
import {
  ERRO_CANAL_NAO_CONFIGURADO,
  POLITICA_RETENTATIVA,
  ESTADO_INICIAL,
  bloqueadaPorOptOut,
  comRodapeOptOut,
  destinoNoWhatsapp,
  ordemDosCanais,
  proximoPasso,
  type EstadoEnvio,
} from './index.js';

const AGORA = new Date('2026-11-16T12:00:00Z');
const minutos = (m: number) => new Date(AGORA.getTime() + m * 60_000);
const ok = { ok: true as const, idExterno: 'x1' };
const temporario = { ok: false as const, erro: 'timeout', temporario: true };
const definitivo = { ok: false as const, erro: 'numero invalido', temporario: false };
const semCredencial = { ok: false as const, erro: ERRO_CANAL_NAO_CONFIGURADO, temporario: true };
const ambos = ['whatsapp', 'email'] as const;

describe('RN-60 ordem dos canais', () => {
  it('começa pelo padrão da agência e cai para o outro', () => {
    expect(ordemDosCanais({ whatsapp: '+5531999998888', email: 'a@b.com' }, 'whatsapp')).toEqual([
      'whatsapp',
      'email',
    ]);
    expect(ordemDosCanais({ whatsapp: '+5531999998888', email: 'a@b.com' }, 'email')).toEqual([
      'email',
      'whatsapp',
    ]);
  });

  it('só usa o canal que tem contato', () => {
    expect(ordemDosCanais({ whatsapp: null, email: 'a@b.com' }, 'whatsapp')).toEqual(['email']);
    expect(ordemDosCanais({ whatsapp: '+5531999998888', email: null }, 'email')).toEqual([
      'whatsapp',
    ]);
    expect(ordemDosCanais({ whatsapp: null, email: null }, 'email')).toEqual([]);
  });
});

describe('RN-62 retentativa com espera crescente', () => {
  it('sucesso conclui no canal atual', () => {
    expect(proximoPasso(ESTADO_INICIAL, ambos, ok, AGORA)).toEqual({
      acao: 'enviada',
      canal: 'whatsapp',
      idExterno: 'x1',
    });
  });

  it('erro temporário tenta de novo no mesmo canal, esperando 1, 5 e depois troca', () => {
    const p1 = proximoPasso(ESTADO_INICIAL, ambos, temporario, AGORA);
    expect(p1).toEqual({
      acao: 'aguardar',
      estado: { ...ESTADO_INICIAL, tentativas: 1 },
      em: minutos(POLITICA_RETENTATIVA.esperasMinutos[0]),
      erro: 'timeout',
    });
    const e2: EstadoEnvio = { ...ESTADO_INICIAL, tentativas: 1 };
    expect(proximoPasso(e2, ambos, temporario, AGORA)).toMatchObject({
      acao: 'aguardar',
      estado: { tentativas: 2 },
      em: minutos(POLITICA_RETENTATIVA.esperasMinutos[1]),
    });
    // Terceira falha esgota as tentativas do WhatsApp: passa para o e-mail na hora (RN-60).
    const e3: EstadoEnvio = { ...ESTADO_INICIAL, tentativas: 2 };
    expect(proximoPasso(e3, ambos, temporario, AGORA)).toEqual({
      acao: 'trocar_canal',
      estado: { indice: 1, tentativas: 0, semCredencial: [], houveFalha: true },
      erro: 'timeout',
    });
  });

  it('erro definitivo troca de canal sem esperar', () => {
    expect(proximoPasso(ESTADO_INICIAL, ambos, definitivo, AGORA)).toMatchObject({
      acao: 'trocar_canal',
      estado: { indice: 1, tentativas: 0 },
    });
  });

  it('no último canal, esgotar ou erro definitivo falha de vez e registra o erro', () => {
    const ultimo: EstadoEnvio = { ...ESTADO_INICIAL, indice: 1, houveFalha: true };
    expect(proximoPasso(ultimo, ambos, definitivo, AGORA)).toEqual({
      acao: 'falhou',
      erro: 'numero invalido',
    });
    expect(
      proximoPasso(
        { ...ultimo, tentativas: POLITICA_RETENTATIVA.tentativasPorCanal - 1 },
        ambos,
        temporario,
        AGORA,
      ),
    ).toEqual({ acao: 'falhou', erro: 'timeout' });
  });

  it('sem contato nenhum falha na hora', () => {
    expect(proximoPasso(ESTADO_INICIAL, [], ok, AGORA)).toEqual({
      acao: 'falhou',
      erro: 'sem_contato',
    });
  });
});

describe('RN-60 canal sem credencial', () => {
  it('passa para o outro canal sem gastar tentativa', () => {
    expect(proximoPasso(ESTADO_INICIAL, ambos, semCredencial, AGORA)).toEqual({
      acao: 'trocar_canal',
      estado: { indice: 1, tentativas: 0, semCredencial: ['whatsapp'], houveFalha: false },
      erro: ERRO_CANAL_NAO_CONFIGURADO,
    });
  });

  it('nenhum canal configurado: fica pendente e recomeça mais tarde, sem perder a mensagem', () => {
    const e: EstadoEnvio = {
      indice: 1,
      tentativas: 0,
      semCredencial: ['whatsapp'],
      houveFalha: false,
    };
    expect(proximoPasso(e, ambos, semCredencial, AGORA)).toEqual({
      acao: 'aguardar',
      estado: ESTADO_INICIAL,
      em: minutos(POLITICA_RETENTATIVA.esperaSemCredencialMinutos),
      erro: ERRO_CANAL_NAO_CONFIGURADO,
    });
  });

  it('se o outro canal falhou de verdade e este não tem credencial, a mensagem falha', () => {
    const e: EstadoEnvio = { indice: 1, tentativas: 0, semCredencial: [], houveFalha: true };
    expect(proximoPasso(e, ambos, semCredencial, AGORA)).toEqual({
      acao: 'falhou',
      erro: ERRO_CANAL_NAO_CONFIGURADO,
    });
  });
});

describe('RN-61 opt-out de lembretes', () => {
  it('bloqueia só lembretes de quem pediu para parar', () => {
    expect(bloqueadaPorOptOut('lembrete', true)).toBe(true);
    expect(bloqueadaPorOptOut('lembrete', false)).toBe(false);
    expect(bloqueadaPorOptOut('transacional', true)).toBe(false);
  });

  it('acrescenta o link de parar ao final do lembrete', () => {
    expect(comRodapeOptOut('Oi!', 'https://x/parar-lembretes/t')).toBe(
      'Oi!\n\nPara não receber mais lembretes: https://x/parar-lembretes/t',
    );
  });
});

describe('WhatsApp: destino no formato do provedor', () => {
  it('tira o + e acrescenta o sufixo de contato', () => {
    expect(destinoNoWhatsapp('+5531999998888')).toBe('5531999998888@s.whatsapp.net');
  });
});
