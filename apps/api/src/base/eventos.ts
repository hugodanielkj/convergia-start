import type {
  AssinanteEventos,
  EventoDominio,
  PublicadorEventos,
  TipoEvento,
  TratadorEvento,
} from '@convergia/core/base';

export type BarramentoEventos = PublicadorEventos & AssinanteEventos;

type TratadorQualquer = (evento: EventoDominio) => Promise<void>;

/**
 * Barramento em memória. Falha de um tratador não interrompe os outros nem quem publicou;
 * o erro vai para `aoFalhar` (ex.: log). Na Sprint 5 pode virar fila (BullMQ) sem mudar o contrato.
 */
export function criarBarramentoEmMemoria(
  aoFalhar: (erro: unknown, evento: EventoDominio) => void,
): BarramentoEventos {
  const tratadores = new Map<TipoEvento, TratadorQualquer[]>();

  return {
    assinar<T extends TipoEvento>(tipo: T, tratador: TratadorEvento<T>) {
      const lista = tratadores.get(tipo) ?? [];
      // O Map guarda tratadores de tipos diferentes; `publicar` só entrega eventos do mesmo tipo.
      lista.push(tratador as unknown as TratadorQualquer);
      tratadores.set(tipo, lista);
    },
    async publicar<T extends TipoEvento>(evento: EventoDominio<T>) {
      for (const tratador of tratadores.get(evento.tipo) ?? []) {
        try {
          await tratador(evento);
        } catch (erro) {
          aoFalhar(erro, evento);
        }
      }
    },
  };
}
