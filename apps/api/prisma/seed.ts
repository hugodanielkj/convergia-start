// Seed idempotente da agência única (D-01, D-22). Uso: `pnpm --filter @convergia/api db:seed`.
import { CONFIG_PADRAO } from '@convergia/core/base';
import { criarPrisma } from '../src/base/prisma.js';

const obrigatoria = (nome: string): string => {
  const valor = process.env[nome];
  if (!valor) throw new Error(`Defina ${nome} no .env para rodar o seed.`);
  return valor;
};

const prisma = criarPrisma(obrigatoria('DATABASE_URL'));
const adminEmail = obrigatoria('SEED_ADMIN_EMAIL').trim().toLowerCase();

try {
  const agencia =
    (await prisma.agencia.findFirst({ orderBy: { criadoEm: 'asc' } })) ??
    (await prisma.agencia.create({
      data: { nome: process.env['SEED_AGENCIA_NOME'] ?? 'Agência' },
    }));

  const config = { ...CONFIG_PADRAO };
  await prisma.configAgencia.upsert({
    where: { agenciaId: agencia.id },
    create: { agenciaId: agencia.id, ...config },
    update: {},
  });

  await prisma.usuario.upsert({
    where: { agenciaId_email: { agenciaId: agencia.id, email: adminEmail } },
    create: {
      agenciaId: agencia.id,
      email: adminEmail,
      nome: process.env['SEED_ADMIN_NOME'] ?? 'Admin',
      papel: 'admin',
    },
    update: { papel: 'admin', ativo: true },
  });

  process.stdout.write(`Seed concluído para a agência "${agencia.nome}".\n`);
} finally {
  await prisma.$disconnect();
}
