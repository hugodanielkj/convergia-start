import Link from 'next/link';
import { formatarDataHora } from '../../clientes/formatar';
import { rotuloEtapa, rotuloStatusEtapa, rotuloStatusOnboarding } from '../../clientes/mensagens';
import { rotuloAcesso } from './acessos/tipos';
import { AcoesRapidas } from './AcoesRapidas';
import estilos from './detalhe.module.css';
import { LinhaDoTempo } from './LinhaDoTempo';
import { PrazoDoOnboarding, type PrazoDoDetalhe } from './PrazoDoOnboarding';
import { descreverNotificacao, textoDaResposta, type Detalhe, type ItemAuditoria } from './tipos';

const ROTULO_AGENDAMENTO: Readonly<Record<string, string>> = {
  agendado: 'Agendado',
  reagendado: 'Reagendado',
  cancelado: 'Cancelado',
  realizado: 'Realizado',
  nao_compareceu: 'Não compareceu',
};

/** Tela de detalhe do onboarding (S4-2, RN-65). */
export function DetalheOnboarding({
  detalhe,
  linhaDoTempo,
  prazo,
}: {
  detalhe: Detalhe;
  linhaDoTempo: ItemAuditoria[];
  prazo: PrazoDoDetalhe;
}) {
  const { cliente, formulario, acessos, agendamentos } = detalhe;
  const contato = [cliente.nomeContato, cliente.whatsapp, cliente.email]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className={estilos.pagina}>
      <Link href="/onboardings" className={estilos.voltar}>
        ← Onboardings
      </Link>
      <header className={estilos.cabecalho}>
        <h1>{cliente.nomeEmpresa}</h1>
        <span className={estilos.status} data-status={detalhe.statusGeral}>
          {rotuloStatusOnboarding(detalhe.statusGeral)}
        </span>
        <p>
          {contato}
          <br />
          Responsável: {detalhe.responsavel.nome} · Criado em {formatarDataHora(detalhe.criadoEm)}
          {detalhe.link && <> · Link válido até {formatarDataHora(detalhe.link.expiraEm)}</>}
        </p>
        <Link href={`/onboardings/${detalhe.id}/personalizar`} className={estilos.personalizar}>
          Personalizar perguntas e acessos
        </Link>
      </header>

      <AcoesRapidas detalhe={detalhe} />

      <div className={estilos.grade}>
        <PrazoDoOnboarding id={detalhe.id} prazo={prazo} />
        <section className={estilos.secao} aria-labelledby="titulo-etapas">
          <h2 id="titulo-etapas">Etapas</h2>
          <ul className={estilos.etapas}>
            {detalhe.etapas.map((e) => (
              <li key={e.tipo} data-status={e.status}>
                <span>{rotuloEtapa(e.tipo)}</span>
                <strong>{rotuloStatusEtapa(e.status)}</strong>
              </li>
            ))}
          </ul>
        </section>

        <section className={estilos.secao} aria-labelledby="titulo-acessos">
          <div className={estilos.cabecalhoSecao}>
            <h2 id="titulo-acessos">Acessos</h2>
            <Link href={`/onboardings/${detalhe.id}/acessos`} className={estilos.linkAcao}>
              Confirmar acessos
            </Link>
          </div>
          <ul className={estilos.etapas}>
            {acessos.plataformas.map((a) => (
              <li key={a.plataforma} data-status={a.status}>
                <span>
                  {a.nome} {a.obrigatoria ? null : <small>(opcional)</small>}
                </span>
                <strong>{rotuloAcesso(a)}</strong>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className={estilos.secao} aria-labelledby="titulo-formulario">
        <h2 id="titulo-formulario">Respostas do formulário</h2>
        {!formulario || formulario.respostas.length === 0 ? (
          <p className={estilos.vazio}>O cliente ainda não respondeu.</p>
        ) : (
          <>
            <p className={estilos.dica}>
              Versão {formulario.versao}
              {formulario.enviadaEm
                ? ` · enviado em ${formatarDataHora(formulario.enviadaEm)}`
                : ' · rascunho'}
              {formulario.fechadaEm && ' · fechado para edição'}
              {formulario.reabertaEm && ` · reaberto em ${formatarDataHora(formulario.reabertaEm)}`}
            </p>
            <dl className={estilos.respostas}>
              {formulario.respostas.map((r) => (
                <div key={r.chave}>
                  <dt>{r.rotulo}</dt>
                  <dd>{textoDaResposta(r)}</dd>
                </div>
              ))}
            </dl>
          </>
        )}
      </section>

      <section className={estilos.secao} aria-labelledby="titulo-agendamentos">
        <h2 id="titulo-agendamentos">Agendamentos</h2>
        {agendamentos.length === 0 ? (
          <p className={estilos.vazio}>Nenhum agendamento ainda.</p>
        ) : (
          <ul className={estilos.lista}>
            {agendamentos.map((a) => (
              <li key={a.id}>
                <strong>{rotuloEtapa(a.tipo)}</strong> · {formatarDataHora(a.inicio)} ·{' '}
                {ROTULO_AGENDAMENTO[a.status] ?? a.status}
                {a.localOuLink && <small>{a.localOuLink}</small>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={estilos.secao} aria-labelledby="titulo-notificacoes">
        <h2 id="titulo-notificacoes">Notificações</h2>
        {detalhe.notificacoes.length === 0 ? (
          <p className={estilos.vazio}>Nenhuma mensagem enviada a este cliente ainda.</p>
        ) : (
          <ul className={estilos.lista}>
            {detalhe.notificacoes.map((n) => {
              const d = descreverNotificacao(n);
              return (
                <li key={n.id}>
                  <strong>{d.titulo}</strong> · {formatarDataHora(n.enviadaEm ?? n.criadoEm)} ·{' '}
                  {d.situacao}
                  {d.detalhe && <small>{d.detalhe}</small>}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <LinhaDoTempo onboardingId={detalhe.id} inicial={linhaDoTempo} />
    </div>
  );
}
