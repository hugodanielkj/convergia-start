import {
  FalhaCalendarioError,
  type Calendario,
  type EventoCalendario,
  type EventoCriado,
} from '@convergia/core/calendario';

/** Calendário em memória para testes e para desenvolvimento sem credenciais do Google (D-12). */
export class CalendarioEmMemoria implements Calendario {
  readonly eventos = new Map<string, EventoCalendario>();
  readonly chamadas: { acao: 'criar' | 'atualizar' | 'cancelar'; id: string }[] = [];
  private proximo = 1;
  private falhas: { restantes: number; transitoria: boolean } | null = null;

  /** As próximas `quantidade` chamadas falham, como se o Google estivesse fora do ar. */
  falharProximas(quantidade: number, transitoria = true): void {
    this.falhas = { restantes: quantidade, transitoria };
  }

  private podeFalhar(): void {
    if (this.falhas && this.falhas.restantes > 0) {
      this.falhas.restantes -= 1;
      throw new FalhaCalendarioError('Calendário indisponível (simulado)', this.falhas.transitoria);
    }
  }

  criarEvento(evento: EventoCalendario): Promise<EventoCriado> {
    this.podeFalhar();
    const id = `evento-${String(this.proximo++)}`;
    this.eventos.set(id, evento);
    this.chamadas.push({ acao: 'criar', id });
    return Promise.resolve({
      id,
      ...(evento.comVideochamada ? { linkVideochamada: `https://meet.exemplo.com/${id}` } : {}),
    });
  }

  atualizarEvento(id: string, evento: EventoCalendario): Promise<void> {
    this.podeFalhar();
    if (!this.eventos.has(id)) throw new FalhaCalendarioError('Evento não existe', false);
    this.eventos.set(id, evento);
    this.chamadas.push({ acao: 'atualizar', id });
    return Promise.resolve();
  }

  cancelarEvento(id: string): Promise<void> {
    this.podeFalhar();
    this.eventos.delete(id);
    this.chamadas.push({ acao: 'cancelar', id });
    return Promise.resolve();
  }
}
