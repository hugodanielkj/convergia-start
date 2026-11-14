import { describe, expect, it } from 'vitest';
import { RegraVioladaError } from '../base/erros.js';
import {
  garantirConfirmacao,
  garantirExclusao,
  interpretarAtor,
  nomeArquivoExportacao,
} from './index.js';

describe('RN-73 exclusão dos dados de um cliente', () => {
  it('só exclui quando todos os onboardings foram cancelados ou concluídos', () => {
    expect(() => {
      garantirExclusao(['cancelado', 'concluido']);
    }).not.toThrow();
    expect(() => {
      garantirExclusao([]);
    }).not.toThrow();
  });

  it('recusa com algum onboarding ativo, inclusive pausado', () => {
    for (const ativo of ['em_andamento', 'pausado', 'primeiro_conteudo_entregue'] as const) {
      expect(() => {
        garantirExclusao(['cancelado', ativo]);
      }).toThrow(RegraVioladaError);
    }
  });

  it('a confirmação é o nome da empresa, sem diferenciar maiúsculas e espaços extras', () => {
    expect(() => {
      garantirConfirmacao('Padaria São João', '  padaria   são joão ');
    }).not.toThrow();
  });

  it('confirmação diferente ou vazia é recusada', () => {
    expect(() => {
      garantirConfirmacao('Padaria São João', 'Padaria Sao Joao');
    }).toThrow(RegraVioladaError);
    expect(() => {
      garantirConfirmacao('Padaria São João', '');
    }).toThrow(RegraVioladaError);
  });
});

describe('RN-73 exportação dos dados', () => {
  it('nomeia o arquivo com a empresa e a data, sem acentos nem símbolos', () => {
    expect(nomeArquivoExportacao('Padaria São João & Cia.', new Date('2026-11-14T23:30:00Z'))).toBe(
      'dados-padaria-sao-joao-cia-2026-11-14.json',
    );
  });

  it('empresa sem letras vira só "cliente"', () => {
    expect(nomeArquivoExportacao('***', new Date('2026-11-14T10:00:00Z'))).toBe(
      'dados-cliente-2026-11-14.json',
    );
  });
});

describe('RN-77 quem fez a ação na auditoria', () => {
  it('reconhece usuário, cliente e sistema', () => {
    expect(interpretarAtor('usuario:abc')).toEqual({ tipo: 'usuario', id: 'abc' });
    expect(interpretarAtor('cliente:o1')).toEqual({ tipo: 'cliente', id: 'o1' });
    expect(interpretarAtor('sistema')).toEqual({ tipo: 'sistema', id: null });
  });

  it('formato desconhecido é tratado como sistema', () => {
    expect(interpretarAtor('outro')).toEqual({ tipo: 'sistema', id: null });
    expect(interpretarAtor('usuario:')).toEqual({ tipo: 'sistema', id: null });
  });
});
