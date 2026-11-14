import Link from 'next/link';
import { BotaoNovoLink } from './BotaoNovoLink';
import { formatarDataHora, formatarTelefone } from './formatar';
import {
  rotuloEtapa,
  rotuloStatusEtapa,
  rotuloStatusOnboarding,
  STATUS_ENCERRADOS,
} from './mensagens';
import { clienteApiDoServidor } from './servidor';
import estilos from './clientes.module.css';

// A lista muda a cada cadastro e depende do usuário logado: nunca é gerada em tempo de build.
export const dynamic = 'force-dynamic';

export default async function PaginaClientes() {
  const clientes = await (await clienteApiDoServidor()).listar();

  return (
    <>
      <div className={estilos.cabecalho}>
        <h1>Clientes</h1>
        <Link href="/clientes/novo" className={estilos.botao}>
          Novo cliente
        </Link>
      </div>

      {clientes.length === 0 ? (
        <p className={estilos.vazio}>
          Nenhum cliente ainda. Cadastre o primeiro para gerar o link de onboarding.
        </p>
      ) : (
        <ul className={estilos.lista}>
          {clientes.map((cliente) => {
            const { onboarding } = cliente;
            const ativo = onboarding !== null && !STATUS_ENCERRADOS.has(onboarding.statusGeral);
            return (
              <li key={cliente.id} className={estilos.cartao}>
                <div className={estilos.topoCartao}>
                  <h2>{cliente.nomeEmpresa}</h2>
                  {onboarding && (
                    <span className={estilos.status}>
                      {rotuloStatusOnboarding(onboarding.statusGeral)}
                    </span>
                  )}
                </div>
                <p>{cliente.nomeContato}</p>
                <p className={estilos.ajuda}>
                  {[cliente.whatsapp && formatarTelefone(cliente.whatsapp), cliente.email]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                {onboarding && (
                  <ul className={estilos.etapas} aria-label="Etapas do onboarding">
                    {onboarding.etapas.map((etapa) => (
                      <li key={etapa.tipo}>
                        {rotuloEtapa(etapa.tipo)}: {rotuloStatusEtapa(etapa.status)}
                      </li>
                    ))}
                  </ul>
                )}
                <p className={estilos.ajuda}>Cadastrado em {formatarDataHora(cliente.criadoEm)}</p>
                {ativo && (
                  <Link href={`/onboardings/${onboarding.id}/personalizar`}>Personalizar</Link>
                )}
                {ativo && <BotaoNovoLink onboardingId={onboarding.id} />}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
