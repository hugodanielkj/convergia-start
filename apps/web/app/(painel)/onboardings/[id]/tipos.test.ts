import { describe, expect, it } from 'vitest';
import { detalheDoItem, nomeDoAtor, rotuloAcaoAuditoria, textoDaResposta } from './tipos';

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
