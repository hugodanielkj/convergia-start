import { describe, expect, it } from 'vitest';
import { mensagemDoErro } from './mensagens';

describe('mensagens de erro dos templates (RN-29, RN-55)', () => {
  it('explica variável desconhecida, pedido de senha e falta do link', () => {
    expect(mensagemDoErro({ codigo: 'variavel_desconhecida', detalhe: 'apelido' })).toBe(
      'A variável {{apelido}} não existe.',
    );
    expect(mensagemDoErro({ codigo: 'pede_senha' })).toMatch(/senha/);
    expect(mensagemDoErro({ codigo: 'sem_link' })).toMatch(/link_onboarding/);
    expect(mensagemDoErro({ codigo: 'novo' })).toBe('Texto inválido.');
  });
});
