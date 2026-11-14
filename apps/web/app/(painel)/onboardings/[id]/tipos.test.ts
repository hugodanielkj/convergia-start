import { describe, expect, it } from 'vitest';
import {
  descreverNotificacao,
  detalheDoItem,
  nomeDoAtor,
  rotuloAcaoAuditoria,
  textoDaResposta,
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
  const arquivos = [{ id: 'a1', nomeOriginal: 'logo.png' }];

  it('mostra texto, listas e o nome do arquivo enviado', () => {
    expect(textoDaResposta({ tipo: 'texto_curto', valor: 'Moda' }, arquivos)).toBe('Moda');
    expect(textoDaResposta({ tipo: 'multipla_escolha', valor: ['A', 'B'] }, arquivos)).toBe('A, B');
    expect(textoDaResposta({ tipo: 'upload', valor: ['a1', 'x'] }, arquivos)).toBe(
      'logo.png, arquivo removido',
    );
    expect(textoDaResposta({ tipo: 'numero', valor: null }, arquivos)).toBe('—');
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
