import { relogioFixo, type UsuarioAutenticado } from '@convergia/core/base';
import { MensageriaEmMemoria } from '../adapters/mensageria/em-memoria.js';
import { ArmazenamentoEmMemoria } from '../adapters/storage/em-memoria.js';
import type { Dependencias } from '../base/dependencias.js';
import { criarBarramentoEmMemoria } from '../base/eventos.js';
import { criarPrisma } from '../base/prisma.js';

export const URL_BANCO_TESTE =
  process.env['DATABASE_URL'] ?? 'postgresql://convergia:convergia@localhost:55432/convergia';

export const AGORA_TESTE = new Date('2026-11-16T12:00:00Z');

export const usuarioTeste = (parcial: Partial<UsuarioAutenticado> = {}): UsuarioAutenticado => ({
  id: 'usuario-teste',
  agenciaId: 'agencia-teste',
  nome: 'Usuária Teste',
  email: 'teste@exemplo.com',
  papel: 'admin',
  ...parcial,
});

/**
 * Dependências para testes. O Prisma só conecta na primeira consulta, então testes
 * unitários que não tocam o banco não precisam de Postgres.
 */
export function dependenciasDeTeste(parcial: Partial<Dependencias> = {}): Dependencias {
  return {
    prisma: criarPrisma(URL_BANCO_TESTE),
    eventos: criarBarramentoEmMemoria((erro) => {
      throw erro;
    }),
    armazenamento: new ArmazenamentoEmMemoria(),
    mensageria: new MensageriaEmMemoria(),
    calendario: null,
    relogio: relogioFixo(AGORA_TESTE),
    resolverSessao: () => Promise.resolve(null),
    auth: {
      segredoCookie: 'segredo-de-teste-com-mais-de-32-caracteres',
      urlApp: 'http://localhost:3000',
      duracaoSessaoHoras: 168,
      identidade: null,
    },
    ...parcial,
  };
}
