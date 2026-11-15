/**
 * Só para testes de celular (apps/web/e2e) e demonstração local: leva um onboarding a `concluido`
 * (RN-52) com um link novo **já vencido**, e imprime o token. Assim a tela de resumo (RN-14) é
 * conferida sem percorrer o fluxo inteiro, e também prova que o resumo vale com link vencido.
 *
 * Uso: DATABASE_URL=... tsx --conditions=source src/testes/concluir-onboarding.ts <onboardingId>
 */
import { gerarTokenLink } from '@convergia/core/link';
import { criarPrisma } from '../base/prisma.js';

const onboardingId = process.argv[2];
const urlBanco = process.env['DATABASE_URL'];
if (process.env['NODE_ENV'] === 'production') throw new Error('Proibido em produção');
if (!onboardingId || !urlBanco) throw new Error('Uso: concluir-onboarding.ts <onboardingId>');

const prisma = criarPrisma(urlBanco);
const DIA = 86_400_000;
const agora = Date.now();
const { token, hash } = gerarTokenLink();

const onboarding = await prisma.onboarding.findUniqueOrThrow({
  where: { id: onboardingId },
  select: { agenciaId: true, statusGeral: true },
});
const { agenciaId } = onboarding;

await prisma.$transaction([
  prisma.linkOnboarding.update({
    where: { onboardingId },
    data: {
      tokenHash: hash,
      expiraEm: new Date(agora - DIA),
      regeneradoEm: new Date(agora - 15 * DIA),
    },
  }),
  prisma.transicaoStatus.deleteMany({
    where: { onboardingId, para: { in: ['primeiro_conteudo_entregue', 'concluido'] } },
  }),
  prisma.transicaoStatus.createMany({
    data: [
      {
        agenciaId,
        onboardingId,
        de: 'em_producao',
        para: 'primeiro_conteudo_entregue',
        ator: 'sistema:e2e',
        em: new Date(agora - 3 * DIA),
      },
      {
        agenciaId,
        onboardingId,
        de: 'primeiro_conteudo_entregue',
        para: 'concluido',
        ator: 'sistema:e2e',
        em: new Date(agora - DIA),
      },
    ],
  }),
  prisma.onboarding.update({ where: { id: onboardingId }, data: { statusGeral: 'concluido' } }),
]);

await prisma.$disconnect();
process.stdout.write(token);
