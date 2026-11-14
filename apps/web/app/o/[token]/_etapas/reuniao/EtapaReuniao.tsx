import { notFound, redirect } from 'next/navigation';
import { URL_API } from '../../../../_lib/url-api';
import { CartaoEtapa } from '../../_componentes/CartaoEtapa';
import { AgendamentoAtual } from './AgendamentoAtual';
import { criarApiReuniao } from './api';
import { SeletorHorario } from './SeletorHorario';

/**
 * Etapa C: o cliente escolhe o horário da reunião online (RN-30 a RN-33) e pode reagendar dentro
 * do limite (RN-35). Falta de comparecimento volta a oferecer horários novos (RN-37).
 */
export async function EtapaReuniao({ token }: { token: string }) {
  const resultado = await criarApiReuniao({ baseUrl: URL_API, fetcher: fetch }).listarAgendamentos(
    token,
  );
  if (resultado.tipo === 'expirado') redirect(`/o/${encodeURIComponent(token)}/expirado`);
  if (resultado.tipo === 'invalido') notFound();
  if (resultado.tipo === 'falha') throw new Error(resultado.mensagem);

  const reunioes = resultado.agendamentos.filter((a) => a.tipo === 'reuniao');
  const atual = reunioes.find((a) => a.status === 'agendado' || a.status === 'reagendado');
  const realizada = reunioes.some((a) => a.status === 'realizado');
  const faltou = reunioes.some((a) => a.status === 'nao_compareceu');

  return (
    <CartaoEtapa titulo="Primeira reunião" status={atual || realizada ? 'concluida' : 'pendente'}>
      {realizada && !atual ? (
        <p>Reunião realizada. Obrigado pelo seu tempo!</p>
      ) : atual ? (
        <AgendamentoAtual agendamento={atual} token={token} />
      ) : (
        <>
          <p>
            {faltou
              ? 'Não conseguimos nos encontrar na última reunião. Escolha um novo horário.'
              : 'Escolha o melhor horário para a nossa reunião online de alinhamento.'}
          </p>
          <SeletorHorario token={token} modo={{ tipo: 'novo' }} />
        </>
      )}
    </CartaoEtapa>
  );
}
