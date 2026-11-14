import type { CampoFormulario, TipoCampo } from './modelo.js';

function campo(
  chave: string,
  rotulo: string,
  tipo: TipoCampo,
  extra: { obrigatorio?: boolean; ajuda?: string } = {},
): CampoFormulario {
  return {
    chave,
    rotulo,
    tipo,
    obrigatorio: extra.obrigatorio ?? false,
    arquivado: false,
    ...extra,
  };
}

/** Modelo padrão sugerido pela RN-19; a agência pode editar tudo e publicar nova versão. */
export function modeloPadrao(): CampoFormulario[] {
  return [
    campo('nome_empresa', 'Nome da empresa', 'texto_curto', { obrigatorio: true }),
    campo('segmento', 'Segmento de atuação', 'texto_curto', { obrigatorio: true }),
    campo('publico_alvo', 'Quem é o seu público-alvo?', 'texto_longo'),
    campo('concorrentes', 'Quem são seus principais concorrentes?', 'texto_longo'),
    campo('tom_de_voz', 'Qual o tom de voz da marca?', 'texto_longo', {
      ajuda: 'Ex.: descontraído, formal, inspirador.',
    }),
    campo('redes_sociais', 'Redes sociais atuais', 'texto_longo', {
      ajuda: 'Links ou @ dos perfis que a empresa já tem.',
    }),
    campo('objetivos', 'O que você espera alcançar com o conteúdo?', 'texto_longo'),
    campo('restricoes', 'Pontos proibidos ou restrições', 'texto_longo', {
      ajuda: 'Assuntos, palavras ou estilos que devemos evitar.',
    }),
    campo('datas_e_produtos', 'Datas e produtos importantes', 'texto_longo'),
    campo('contato_aprovacao', 'Contato para aprovação de conteúdo', 'texto_curto', {
      obrigatorio: true,
      ajuda: 'Nome e WhatsApp ou e-mail de quem aprova as postagens.',
    }),
    campo('logo', 'Logo da empresa', 'upload'),
    campo('manual_de_marca', 'Manual de marca', 'upload'),
  ];
}
