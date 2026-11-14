import type { Canal, Mensageria, MensagemSaida, ResultadoEnvio } from '@convergia/core/base';
import { ERRO_CANAL_NAO_CONFIGURADO } from '@convergia/core/envio';

/**
 * Escolhe o adaptador pelo canal da mensagem (RN-71). Canal sem credencial responde "não
 * configurado": a mensagem não se perde, vai para o outro canal ou fica pendente (RN-60).
 */
export function criarRoteadorMensageria(canais: Record<Canal, Mensageria | null>): Mensageria {
  return {
    enviar(mensagem: MensagemSaida): Promise<ResultadoEnvio> {
      const adaptador = canais[mensagem.canal];
      if (!adaptador) {
        return Promise.resolve({ ok: false, erro: ERRO_CANAL_NAO_CONFIGURADO, temporario: true });
      }
      return adaptador.enviar(mensagem);
    },
  };
}
