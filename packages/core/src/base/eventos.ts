/**
 * Catálogo de eventos de domínio. Cada módulo declara os seus eventos no próprio
 * arquivo, por declaration merging, sem editar este (evita conflito entre trilhas):
 *
 *   declare module '@convergia/core/base' {
 *     interface MapaEventos { 'cliente.criado': { clienteId: string } }
 *   }
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- ampliado por declaration merging
export interface MapaEventos {}

export type TipoEvento = keyof MapaEventos;

export interface EventoDominio<T extends TipoEvento = TipoEvento> {
  tipo: T;
  agenciaId: string;
  ocorridoEm: Date;
  dados: MapaEventos[T];
}

export type TratadorEvento<T extends TipoEvento> = (evento: EventoDominio<T>) => Promise<void>;

export interface PublicadorEventos {
  publicar<T extends TipoEvento>(evento: EventoDominio<T>): Promise<void>;
}

export interface AssinanteEventos {
  assinar<T extends TipoEvento>(tipo: T, tratador: TratadorEvento<T>): void;
}
