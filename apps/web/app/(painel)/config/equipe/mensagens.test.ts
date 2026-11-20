import { describe, expect, it } from 'vitest';
import { mensagemDoErro, rotuloPapel, textoEmAndamento } from './mensagens';

describe('RN-03 mensagens da tela Equipe', () => {
  it('e-mail repetido', () => {
    expect(mensagemDoErro(409, { erro: 'EMAIL_EM_USO' })).toBe('Este e-mail já está cadastrado.');
  });

  it('traduz os códigos de validação', () => {
    expect(mensagemDoErro(422, { mensagem: 'email_invalido' })).toBe('Confira o e-mail.');
    expect(mensagemDoErro(422, { mensagem: 'nome_invalido' })).toContain('nome');
  });

  it('repete a frase da regra quando a API explica', () => {
    expect(
      mensagemDoErro(422, {
        mensagem: 'O administrador não pode desativar nem mudar o próprio papel',
      }),
    ).toBe('O administrador não pode desativar nem mudar o próprio papel.');
  });

  it('sem corpo, uma mensagem genérica', () => {
    expect(mensagemDoErro(500, null)).toBe('Não foi possível salvar. Tente de novo.');
    expect(mensagemDoErro(403, null)).toContain('administrador');
  });

  it('papel e contagem em português', () => {
    expect(rotuloPapel('admin')).toBe('Administrador');
    expect(rotuloPapel('membro')).toBe('Membro');
    expect(textoEmAndamento(1)).toBe('1 onboarding em andamento');
    expect(textoEmAndamento(3)).toBe('3 onboardings em andamento');
  });
});
