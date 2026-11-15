import { relogioFixo, type UsuarioAutenticado } from '@convergia/core/base';
import { MensageriaEmMemoria } from '../adapters/mensageria/em-memoria.js';
import type { Dependencias } from '../base/dependencias.js';
import { criarBarramentoEmMemoria } from '../base/eventos.js';
import { criarPrisma } from '../base/prisma.js';

export const URL_BANCO_TESTE =
  process.env['DATABASE_URL'] ?? 'postgresql://convergia:convergia@localhost:55432/convergia';

/** Chave fixa do link cifrado nos testes (nunca usar fora deles). */
export const CHAVE_LINK_TESTE = new Uint8Array(32).fill(42);

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
    mensageria: new MensageriaEmMemoria(),
    calendario: null,
    relogio: relogioFixo(AGORA_TESTE),
    chaveLink: CHAVE_LINK_TESTE,
    resolverSessao: () => Promise.resolve(null),
    auth: {
      segredoCookie: 'segredo-de-teste-com-mais-de-32-caracteres',
      urlApp: 'http://localhost:3000',
      duracaoSessaoHoras: 168,
      identidade: null,
    },
    // Sem limite: os testes dos módulos fazem muitas chamadas do mesmo IP. Os do limite ligam.
    http: { confiarProxy: false, hsts: false, limites: null },
    ...parcial,
  };
}
