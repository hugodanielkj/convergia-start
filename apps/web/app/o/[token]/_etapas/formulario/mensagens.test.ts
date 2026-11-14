import { describe, expect, it } from 'vitest';
import { mensagensPorCampo } from './mensagens';

describe('RN-17 mensagens de erro do formulário do cliente', () => {
  it('traduz cada erro para o campo certo', () => {
    expect(
      mensagensPorCampo([
        { chave: 'segmento', codigo: 'obrigatorio' },
        { chave: 'site', codigo: 'url_invalida' },
      ]),
    ).toEqual({
      segmento: 'Preencha este campo.',
      site: 'Informe um link começando com http:// ou https://.',
    });
  });

  it('usa mensagem genérica para código desconhecido', () => {
    expect(mensagensPorCampo([{ chave: 'x', codigo: 'novo' }])).toEqual({
      x: 'Confira este campo.',
    });
  });
});
