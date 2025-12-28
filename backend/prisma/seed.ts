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

  // Clear old data first (in correct order due to foreign keys)
  console.log('Clearing old data...');

  // Get all share groups for this tenant
  const oldGroups = await prisma.shareGroup.findMany({
    where: { tenantId: tenant.id },
    select: { id: true },
  });
  const groupIds = oldGroups.map(g => g.id);

  if (groupIds.length > 0) {
    // Delete round-related data first
    await prisma.roundPayment.deleteMany({
      where: { round: { shareGroupId: { in: groupIds } } },
    });
    await prisma.memberRoundDeduction.deleteMany({
      where: { round: { shareGroupId: { in: groupIds } } },
    });
    await prisma.round.deleteMany({
      where: { shareGroupId: { in: groupIds } },
    });

    // Delete group members
    await prisma.groupMember.deleteMany({
      where: { shareGroupId: { in: groupIds } },
    });

    // Delete deductions and templates
    await prisma.deduction.deleteMany({
      where: { round: { shareGroupId: { in: groupIds } } },
    });
    await prisma.groupDeductionTemplate.deleteMany({
      where: { shareGroupId: { in: groupIds } },
    });
  }

  // Now delete main entities
  await prisma.notification.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.shareGroup.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.member.deleteMany({ where: { tenantId: tenant.id } });

  console.log('Old data cleared.');

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
      firstName: 'ป้าแดง',
      lastName: 'ท้าวแชร์',
      phone: '0891234567',
      email: 'padaeng@demo.com',
      password: tenantPassword,
      role: 'ADMIN',
    },
  });

  console.log('Demo Tenant created:', tenant.slug);
  console.log('Demo Admin created:', admin.phone);

  // ========================================
  // Create Members
  // ========================================
  console.log('\nCreating members...');

  const membersData = [
    { memberCode: 'A', nickname: 'เต้', phone: '0811111111' },
    { memberCode: 'B', nickname: 'เต้ง', phone: '0822222222' },
    { memberCode: 'C', nickname: 'ทิม', phone: '0833333333' },
    { memberCode: 'D', nickname: 'ต้น', phone: '0844444444' },
  ];

  const members = [];
  for (const data of membersData) {
    const member = await prisma.member.create({
      data: {
        tenantId: tenant.id,
        memberCode: data.memberCode,
        nickname: data.nickname,
        phone: data.phone,
      },
    });
    members.push(member);
    console.log(`  Created member: ${member.nickname} (${member.memberCode})`);
  }

  // ========================================
  // Create STEP_INTEREST Share Group
  // ========================================
  console.log('\nCreating STEP_INTEREST share group...');

  // ตัวอย่างจาก spec:
  // วง: เงินต้น 1,000 บาท, 5 มือ (รวมท้าว)
  // - ป้าแดง (ท้าว) - ยอดส่ง 0
  // - เต้ - ยอดส่ง 240/งวด
  // - เต้ง - ยอดส่ง 220/งวด
  // - ทิม - ยอดส่ง 180/งวด
  // - ต้น - ยอดส่ง 160/งวด (เพิ่มให้ครบ 5 คน)

  const shareGroup = await prisma.shareGroup.create({
    data: {
      tenantId: tenant.id,
      hostId: admin.id,
      name: 'วงขั้นบันได ทดสอบ',
      type: 'STEP_INTEREST',
      maxMembers: 5,
      principalAmount: 1000,
      managementFee: null,
      cycleType: 'MONTHLY',
      cycleDays: 0,
      startDate: new Date('2025-01-01'),
      status: 'DRAFT',
      tailDeductionRounds: 2, // หัก 2 งวดท้าย
    },
  });

  console.log(`  Created share group: ${shareGroup.name} (ID: ${shareGroup.id})`);

  // Add Host as first member (ท้าว - ไม่ต้องจ่าย)
  const hostMember = await prisma.groupMember.create({
    data: {
      shareGroupId: shareGroup.id,
      userId: admin.id,
      nickname: 'ป้าแดง (ท้าว)',
      paymentAmount: 0, // ท้าวไม่ต้องจ่าย
    },
  });
  console.log(`  Added host: ป้าแดง (ท้าว) - ยอดส่ง 0`);

  // Add other members with different payment amounts (ขั้นบันได)
  const memberPayments = [
    { member: members[0], paymentAmount: 240 }, // เต้
    { member: members[1], paymentAmount: 220 }, // เต้ง
    { member: members[2], paymentAmount: 180 }, // ทิม
    { member: members[3], paymentAmount: 160 }, // ต้น
  ];

  const groupMembers = [hostMember];
  for (const { member, paymentAmount } of memberPayments) {
    const gm = await prisma.groupMember.create({
      data: {
        shareGroupId: shareGroup.id,
        memberId: member.id,
        nickname: member.nickname,
        paymentAmount: paymentAmount,
      },
    });
    groupMembers.push(gm);
    console.log(`  Added member: ${member.nickname} - ยอดส่ง ${paymentAmount}`);
  }

  // Create rounds
  console.log('\nCreating rounds...');
  const rounds = [];
  let currentDate = new Date('2025-01-01');

  for (let i = 1; i <= shareGroup.maxMembers; i++) {
    const round = await prisma.round.create({
      data: {
        shareGroupId: shareGroup.id,
        roundNumber: i,
        dueDate: new Date(currentDate),
        status: 'PENDING',
        winnerId: i === 1 ? hostMember.id : null, // งวดแรก = ท้าว
      },
    });
    rounds.push(round);
    console.log(`  Created round ${i}: ${currentDate.toISOString().split('T')[0]}${i === 1 ? ' (ท้าว)' : ''}`);

    // Next month
    currentDate.setMonth(currentDate.getMonth() + 1);
  }

  // ========================================
  // Summary
  // ========================================
  console.log('\n========================================');
  console.log('STEP_INTEREST Share Group Summary');
  console.log('========================================');
  console.log(`Group: ${shareGroup.name}`);
  console.log(`Members: ${shareGroup.maxMembers} คน`);
  console.log(`Principal: ${shareGroup.principalAmount} บาท`);
  console.log(`Tail Deduction: ${shareGroup.tailDeductionRounds} งวดท้าย`);
  console.log('');
  console.log('Member Payments:');
  console.log('  - ป้าแดง (ท้าว): 0 บาท/งวด');
  console.log('  - เต้: 240 บาท/งวด');
  console.log('  - เต้ง: 220 บาท/งวด');
  console.log('  - ทิม: 180 บาท/งวด');
  console.log('  - ต้น: 160 บาท/งวด');
  console.log(`  รวมยอดส่ง: ${240 + 220 + 180 + 160} บาท/งวด`);
  console.log('');
  console.log('Expected Payouts:');
  console.log('  - งวด 1 (ท้าว): 240+220+180+160 = 800 บาท');
  console.log('  - งวด 2 (เต้): 1000-(220+180+160)-240 = 200 บาท');
  console.log('  - งวด 3 (เต้ง): 1000-(240+180+160)-220 = 200 บาท');
  console.log('  - งวด 4 (ทิม): 1000-(240+220+160)-180 = 200 บาท');
  console.log('  - งวด 5 (ต้น): 1000-(240+220+180)-160 = 200 บาท');

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
