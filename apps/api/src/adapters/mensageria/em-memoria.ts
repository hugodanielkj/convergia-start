import type { Mensageria, MensagemSaida, ResultadoEnvio } from '@convergia/core/base';

/** Mensageria fake: guarda as mensagens em memória. Usada em dev e testes até a S5-2. */
export class MensageriaEmMemoria implements Mensageria {
  readonly enviadas: MensagemSaida[] = [];

  enviar(mensagem: MensagemSaida): Promise<ResultadoEnvio> {
    this.enviadas.push(mensagem);
    return Promise.resolve({ ok: true, idExterno: `memoria-${String(this.enviadas.length)}` });
  }
}
