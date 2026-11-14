import { notFound, redirect } from 'next/navigation';
import { URL_API } from '../../../../_lib/url-api';
import { CartaoEtapa } from '../../_componentes/CartaoEtapa';
import { criarApiReuniao } from '../reuniao/api';
import { buscarPrazo, buscarSituacaoCaptacao } from './api';
import { CaptacaoMarcada, NovaCaptacao } from './CaptacaoCliente';
import { Prazo } from './Prazo';

/**
 * Etapa D: captação presencial. Fica bloqueada até a reunião ser agendada (RN-39); depois o
 * cliente informa o local (RN-40) e escolhe o dia, com as mesmas regras da reunião (RN-41).
 */
export async function EtapaCaptacao({ token }: { token: string }) {
  const [resultado, prazo] = await Promise.all([
    buscarSituacaoCaptacao(URL_API, token, fetch),
    buscarPrazo(URL_API, token, fetch),
  ]);
  if (resultado.tipo === 'expirado') redirect(`/o/${encodeURIComponent(token)}/expirado`);
  if (resultado.tipo === 'invalido') notFound();
  if (resultado.tipo === 'falha') throw new Error(resultado.mensagem);
  const { situacao, motivoBloqueio, agendamento } = resultado.situacao;

  if (situacao === 'bloqueada') {
    return (
      <CartaoEtapa titulo="Primeira captação" status="bloqueada">
        <p>{motivoBloqueio}</p>
        <Prazo prazo={prazo} />
      </CartaoEtapa>
    );
  }
  if (situacao === 'realizada') {
    return (
      <CartaoEtapa titulo="Primeira captação" status="concluida">
        <p>Captação realizada. Obrigado!</p>
        <Prazo prazo={prazo} />
      </CartaoEtapa>
    );
  }
  if (situacao === 'agendada' && agendamento) {
    const lista = await criarApiReuniao({ baseUrl: URL_API, fetcher: fetch }).listarAgendamentos(
      token,
    );
    if (lista.tipo !== 'ok') throw new Error('Não foi possível carregar a captação.');
    const doCliente = lista.agendamentos.find((a) => a.id === agendamento.id);
    if (doCliente) {
      return (
        <CartaoEtapa titulo="Primeira captação" status="concluida">
          <CaptacaoMarcada token={token} agendamento={doCliente} dados={agendamento.dados} />
          <Prazo prazo={prazo} />
        </CartaoEtapa>
      );
    }
  }
  return (
    <CartaoEtapa titulo="Primeira captação" status="pendente">
      <NovaCaptacao token={token} />
      <Prazo prazo={prazo} />
    </CartaoEtapa>
  );
}
