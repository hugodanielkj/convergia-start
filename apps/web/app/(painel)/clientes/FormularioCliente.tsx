'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { cadastrarClienteAction } from './actions';
import { LinkParaCopiar } from './LinkParaCopiar';
import type { EstadoCadastro } from './processar';
import estilos from './clientes.module.css';

const INICIAL: EstadoCadastro = { tipo: 'inicial' };

export function FormularioCliente() {
  const [estado, enviar, pendente] = useActionState(cadastrarClienteAction, INICIAL);

  if (estado.tipo === 'criado') {
    return (
      <section className={estilos.sucesso} aria-live="polite">
        <h2>{estado.nomeEmpresa} foi cadastrado</h2>
        <p>O onboarding já foi criado. Envie este link ao cliente:</p>
        <LinkParaCopiar caminho={estado.link.caminho} expiraEm={estado.link.expiraEm} />
        <p className={estilos.aviso}>
          Copie agora: por segurança este link não é mostrado de novo. Depois, use “Gerar novo link”
          na lista de clientes.
        </p>
        <div className={estilos.acoes}>
          {/* Link comum, não do Next: recarrega a página e zera o formulário. */}
          <a href="/clientes/novo" className={estilos.botaoSecundario}>
            Cadastrar outro
          </a>
          <Link href="/clientes" className={estilos.botao}>
            Ver clientes
          </Link>
        </div>
      </section>
    );
  }

  const valores = estado.tipo === 'inicial' ? undefined : estado.valores;
  const erros = estado.tipo === 'invalido' ? estado.erros : {};

  return (
    <form action={enviar} noValidate className={estilos.formulario}>
      {estado.tipo === 'falha' && (
        <p role="alert" className={estilos.erroGeral}>
          {estado.mensagem}
        </p>
      )}

      <Campo
        nome="nomeEmpresa"
        rotulo="Nome da empresa"
        valor={valores?.nomeEmpresa}
        erro={erros['nomeEmpresa']}
        obrigatorio
      />
      <Campo
        nome="nomeContato"
        rotulo="Nome do contato"
        valor={valores?.nomeContato}
        erro={erros['nomeContato']}
        obrigatorio
      />
      <p className={estilos.ajuda}>Informe pelo menos um canal de contato.</p>
      {erros['contato'] && (
        <p role="alert" className={estilos.erroCampo}>
          {erros['contato']}
        </p>
      )}
      <Campo
        nome="whatsapp"
        rotulo="WhatsApp"
        tipo="tel"
        valor={valores?.whatsapp}
        erro={erros['whatsapp']}
        dica="(31) 99999-8888"
      />
      <Campo
        nome="email"
        rotulo="E-mail"
        tipo="email"
        valor={valores?.email}
        erro={erros['email']}
        dica="contato@empresa.com.br"
      />

      {estado.tipo === 'duplicado' && (
        <div role="alert" className={estilos.alertaDuplicidade}>
          <strong>Este cliente parece já estar cadastrado.</strong>
          <ul>
            {estado.avisos.map((aviso) => (
              <li key={aviso}>{aviso}</li>
            ))}
          </ul>
          <p>Confira a lista de clientes antes de continuar.</p>
        </div>
      )}

      <div className={estilos.acoes}>
        <button type="submit" disabled={pendente} className={estilos.botao}>
          {pendente ? 'Cadastrando…' : 'Cadastrar cliente'}
        </button>
        {estado.tipo === 'duplicado' && (
          <button
            type="submit"
            name="confirmarDuplicidade"
            value="true"
            disabled={pendente}
            className={estilos.botaoSecundario}
          >
            Cadastrar mesmo assim
          </button>
        )}
      </div>
    </form>
  );
}

interface CampoProps {
  readonly nome: string;
  readonly rotulo: string;
  readonly valor: string | undefined;
  readonly erro: string | undefined;
  readonly tipo?: 'text' | 'tel' | 'email';
  readonly dica?: string;
  readonly obrigatorio?: boolean;
}

function Campo({
  nome,
  rotulo,
  valor,
  erro,
  tipo = 'text',
  dica,
  obrigatorio = false,
}: CampoProps) {
  const idErro = `${nome}-erro`;
  return (
    <div className={estilos.campo}>
      <label htmlFor={nome}>
        {rotulo}
        {obrigatorio && <span aria-hidden="true"> *</span>}
      </label>
      <input
        id={nome}
        name={nome}
        type={tipo}
        defaultValue={valor}
        placeholder={dica}
        required={obrigatorio}
        maxLength={tipo === 'email' ? 320 : 200}
        aria-invalid={erro ? true : undefined}
        aria-describedby={erro ? idErro : undefined}
        autoComplete="off"
      />
      {erro && (
        <p id={idErro} role="alert" className={estilos.erroCampo}>
          {erro}
        </p>
      )}
    </div>
  );
}
