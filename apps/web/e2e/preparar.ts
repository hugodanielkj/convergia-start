import { writeFile } from 'node:fs/promises';
import { z } from 'zod';
import { ARQUIVO_DADOS, URL_API, type DadosE2E } from './ambiente';

// Prepara os dados dos testes pela própria API, com o login de desenvolvimento. Os clientes têm
// e-mail fixo: rodar de novo reaproveita o cliente e só gera um link novo, sem encher o banco.

const esquemaCriado = z.object({
  cliente: z.object({ onboarding: z.object({ id: z.string() }).nullable() }),
  link: z.object({ token: z.string() }),
});
const esquemaDuplicado = z.object({ duplicidades: z.array(z.object({ clienteId: z.string() })) });
const esquemaLista = z.object({
  clientes: z.array(
    z.object({ id: z.string(), onboarding: z.object({ id: z.string() }).nullable() }),
  ),
});
const esquemaLink = z.object({ link: z.object({ token: z.string() }) });
const esquemaTermo = z.object({ termo: z.object({ versao: z.string() }) });

async function chamar(caminho: string, metodo: 'GET' | 'POST', corpo?: unknown) {
  return fetch(`${URL_API}${caminho}`, {
    method: metodo,
    headers: corpo === undefined ? {} : { 'content-type': 'application/json' },
    body: corpo === undefined ? null : JSON.stringify(corpo),
  });
}

/** Cria o cliente de teste ou, se já existe, gera um link novo para ele. */
async function clienteDeTeste(
  nomeEmpresa: string,
  email: string,
): Promise<{ token: string; onboardingId: string }> {
  const r = await chamar('/clientes', 'POST', { nomeEmpresa, nomeContato: 'Contato E2E', email });
  if (r.status === 201) {
    const criado = esquemaCriado.parse(await r.json());
    if (!criado.cliente.onboarding) throw new Error('Cliente criado sem onboarding');
    return { token: criado.link.token, onboardingId: criado.cliente.onboarding.id };
  }
  if (r.status !== 409) throw new Error(`POST /clientes respondeu ${String(r.status)}`);

  const [duplicado] = esquemaDuplicado.parse(await r.json()).duplicidades;
  const lista = esquemaLista.parse(await (await chamar('/clientes', 'GET')).json());
  const onboardingId = lista.clientes.find((c) => c.id === duplicado?.clienteId)?.onboarding?.id;
  if (!onboardingId) throw new Error(`Cliente de teste ${email} sem onboarding`);
  const novo = await chamar(`/onboardings/${onboardingId}/link/regenerar`, 'POST');
  if (!novo.ok) throw new Error(`Regenerar link respondeu ${String(novo.status)}`);
  return { token: esquemaLink.parse(await novo.json()).link.token, onboardingId };
}

async function aceitarTermo(token: string): Promise<void> {
  const base = `/publico/onboardings/${token}`;
  await chamar(`${base}/abrir`, 'POST');
  const { termo } = esquemaTermo.parse(await (await chamar(`${base}/consentimento`, 'GET')).json());
  const r = await chamar(`${base}/consentimento`, 'POST', { versao: termo.versao });
  if (!r.ok) throw new Error(`Aceite do termo respondeu ${String(r.status)}`);
}

export default async function preparar(): Promise<void> {
  const principal = await clienteDeTeste('E2E Celular', 'e2e-celular@exemplo.com');
  await aceitarTermo(principal.token);
  const semTermo = await clienteDeTeste('E2E Termo', 'e2e-termo@exemplo.com');

  const dados: DadosE2E = {
    token: principal.token,
    tokenSemTermo: semTermo.token,
    onboardingId: principal.onboardingId,
  };
  await writeFile(ARQUIVO_DADOS, JSON.stringify(dados));
}
