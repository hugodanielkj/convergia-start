import { describe, expect, it } from 'vitest';
import {
  descreverNotificacao,
  detalheDoItem,
  nomeDoAtor,
  rotuloAcaoAuditoria,
  textoDaResposta,
  textoDoReenvio,
} from './tipos';

describe('linha do tempo do detalhe (RN-65)', () => {
  it('descreve mudança de status com motivo', () => {
    expect(
      detalheDoItem({ dados: { de: 'em_andamento', para: 'pausado', motivo: 'férias' } }),
    ).toBe('Em andamento → Pausado · Motivo: férias');
  });

  it('descreve etapa e plataforma; sem dados não há complemento', () => {
    expect(detalheDoItem({ dados: { etapa: 'formulario', motivo: 'faltou CNPJ' } })).toBe(
      'Formulário · Motivo: faltou CNPJ',
    );
    expect(detalheDoItem({ dados: { plataforma: 'instagram', motivo: null } })).toBe('Instagram');
    expect(detalheDoItem({ dados: null })).toBeNull();
  });

  it('nomeia quem agiu e traduz ações conhecidas', () => {
    expect(nomeDoAtor({ tipo: 'sistema', nome: null })).toBe('Sistema');
    expect(nomeDoAtor({ tipo: 'cliente', nome: 'Bia' })).toBe('Bia (cliente)');
    expect(nomeDoAtor({ tipo: 'usuario', nome: 'Ana' })).toBe('Ana');
    expect(rotuloAcaoAuditoria('etapa.reaberta')).toBe('Etapa reaberta');
    expect(rotuloAcaoAuditoria('acao.nova')).toBe('acao.nova');
  });
});

describe('respostas do formulário no detalhe', () => {
  it('mostra texto, números e listas', () => {
    expect(textoDaResposta({ valor: 'Moda' })).toBe('Moda');
    expect(textoDaResposta({ valor: 12 })).toBe('12');
    expect(textoDaResposta({ valor: ['A', 'B'] })).toBe('A, B');
    expect(textoDaResposta({ valor: null })).toBe('—');
  });
});

describe('histórico de notificações no detalhe (RN-62)', () => {
  const base = {
    id: 'n1',
    tipo: 'convite',
    categoria: 'transacional',
    status: 'enviada' as const,
    canal: 'email' as const,
    totalTentativas: 2,
    erro: null,
    criadoEm: '2026-11-16T12:00:00Z',
    enviadaEm: '2026-11-16T12:01:00Z',
  };

  it('mostra o canal e quantas tentativas levou', () => {
    expect(descreverNotificacao(base)).toEqual({
      titulo: 'Convite',
      situacao: 'Enviada · E-mail',
      detalhe: '2 tentativas',
    });
  });

  it('explica pendência sem credencial, opt-out e erro', () => {
    const pendente = {
      ...base,
      status: 'pendente' as const,
      canal: 'email' as const,
      totalTentativas: 0,
    };
    expect(descreverNotificacao({ ...pendente, erro: 'canal_nao_configurado' })).toEqual({
      titulo: 'Convite',
      situacao: 'Na fila',
      detalhe: 'Aguardando as credenciais de envio',
    });
    expect(
      descreverNotificacao({
        ...pendente,
        status: 'cancelada',
        erro: 'opt_out',
        tipo: 'lembrete_pendencia',
      }),
    ).toMatchObject({
      titulo: 'Lembrete de pendência',
      detalhe: 'O cliente pediu para não receber lembretes',
    });
    expect(
      descreverNotificacao({
        ...base,
        status: 'falhou',
        erro: 'numero invalido',
        totalTentativas: 1,
      }).detalhe,
    ).toBe('Erro: numero invalido');
  });
});

describe('RN-66 confirmação do reenvio', () => {
  const agora = new Date('2026-11-16T12:00:00.000Z');
  it('na janela, entra na fila', () => {
    expect(textoDoReenvio('convite', agora.toISOString(), agora)).toBe('Convite na fila de envio.');
  });
  it('fora da janela, diz quando sai (RN-59)', () => {
    expect(textoDoReenvio('lembrete', '2026-11-17T11:00:00.000Z', agora)).toBe(
      'Lembrete na fila: sai em 17/11/2026, 08:00, no horário permitido de envio.',
    );
  });
});
