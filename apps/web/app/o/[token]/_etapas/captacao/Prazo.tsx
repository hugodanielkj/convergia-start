import { formatarDia } from '../reuniao/formatar';
import type { PrazoDoCliente } from './api';
import estilos from './captacao.module.css';

/** Previsão de liberação dos primeiros conteúdos, ou o aviso de que ainda será definida (RN-45). */
export function Prazo({ prazo }: { prazo: PrazoDoCliente }) {
  return (
    <p className={estilos.prazo} role="status">
      {prazo.definido ? (
        <>
          Previsão de liberação dos primeiros conteúdos:{' '}
          <strong>
            <time dateTime={prazo.data}>{formatarDia(prazo.data)}</time>
          </strong>
          .
        </>
      ) : (
        'O prazo dos primeiros conteúdos será definido após o agendamento da captação.'
      )}
    </p>
  );
}
