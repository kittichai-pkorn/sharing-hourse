import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Create SuperAdmin
  const hashedPassword = await bcrypt.hash('admin123', 10);

  const superAdmin = await prisma.superAdmin.upsert({
    where: { email: 'admin@platform.com' },
    update: {},
    create: {
      email: 'admin@platform.com',
      password: hashedPassword,
    },
  });

  console.log('SuperAdmin created:', superAdmin.email);

  // Create sample tenant with admin for testing
  const tenantPassword = await bcrypt.hash('password123', 10);

  const tenant = await prisma.tenant.upsert({
    where: { slug: 'demo-share' },
    update: {},
    create: {
      name: 'วงแชร์ป้าแดง',
      slug: 'demo-share',
      status: 'ACTIVE',
    },
  });

  const admin = await prisma.user.upsert({
    where: {
      tenantId_phone: {
        tenantId: tenant.id,
        phone: '0891234567',
      },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      firstName: 'สมศรี',
      lastName: 'แดงประดิษฐ์',
      phone: '0891234567',
      email: 'somsri@demo.com',
      password: tenantPassword,
      role: 'ADMIN',
    },
  });

  console.log('Demo Tenant created:', tenant.slug);
  console.log('Demo Admin created:', admin.phone);

  // Clear old data
  await prisma.notification.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.shareGroup.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.member.deleteMany({ where: { tenantId: tenant.id } });
  console.log('Old data cleared');

  console.log('\n========================================');
  console.log('--- Login Credentials ---');
  console.log('SuperAdmin: admin@platform.com / admin123');
  console.log('Tenant Admin: demo-share / 0891234567 / password123');
  console.log('========================================\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
