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
      name: 'วงแชร์ทดสอบ',
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
      firstName: 'สมชาย',
      lastName: 'ใจดี',
      phone: '0891234567',
      email: 'somchai@demo.com',
      password: tenantPassword,
      role: 'ADMIN',
    },
  });

  console.log('Demo Tenant created:', tenant.slug);
  console.log('Demo Admin created:', admin.phone);

  // Delete old members first
  await prisma.member.deleteMany({
    where: { tenantId: tenant.id },
  });
  console.log('Old members deleted');

  // Create sample Members (ลูกแชร์)
  const membersData = [
    { memberCode: 'A001', nickname: 'พี่เอ', phone: '0891111111', lineId: 'line_a' },
    { memberCode: 'A002', nickname: 'น้องบี', phone: '0892222222', lineId: null },
    { memberCode: 'A003', nickname: 'ลุงซี', phone: '0893333333', lineId: 'line_c' },
    { memberCode: 'A004', nickname: 'ป้าดี', phone: null, lineId: 'line_d' },
    { memberCode: 'A005', nickname: 'น้าอี', phone: '0895555555', lineId: null },
  ];

  for (const data of membersData) {
    await prisma.member.upsert({
      where: {
        tenantId_memberCode: {
          tenantId: tenant.id,
          memberCode: data.memberCode,
        },
      },
      update: {},
      create: {
        tenantId: tenant.id,
        memberCode: data.memberCode,
        nickname: data.nickname,
        phone: data.phone,
        lineId: data.lineId,
      },
    });
  }

  console.log('Sample Members created:', membersData.length);

  // Delete old share groups first
  await prisma.shareGroup.deleteMany({
    where: { tenantId: tenant.id },
  });
  console.log('Old share groups deleted');

  // Get created members
  const members = await prisma.member.findMany({
    where: { tenantId: tenant.id },
    orderBy: { memberCode: 'asc' },
  });

  // ====================================================================================
  // Test Cases สำหรับ Auto-fill (ค่าดูแลวง และ ดอกเบี้ย แสดงเสมอ แม้เป็น 0)
  // ====================================================================================

  // ==================== วงที่ 1: มีทั้ง managementFee และ interestRate ====================
  // ทดสอบ: ค่าดูแลวง = 500, ดอกเบี้ย = 100 × งวดที่
  const group1 = await prisma.shareGroup.create({
    data: {
      tenantId: tenant.id,
      hostId: admin.id,
      name: '1. มีค่าดูแล + มีดอก',
      type: 'STEP_INTEREST',
      maxMembers: 5,
      principalAmount: 10000,
      managementFee: 500, // ✓ มีค่าดูแลวง
      interestRate: 100, // ✓ มีดอกเบี้ย
      cycleType: 'MONTHLY',
      cycleDays: 0,
      startDate: new Date('2025-01-15'),
      status: 'OPEN',
    },
  });

  await prisma.groupDeductionTemplate.createMany({
    data: [
      { shareGroupId: group1.id, name: 'หักท้ายท้าว', amount: 200 },
    ],
  });

  const host1 = await prisma.groupMember.create({
    data: { shareGroupId: group1.id, userId: admin.id, nickname: 'ท้าวแชร์' },
  });
  for (let i = 0; i < 4; i++) {
    await prisma.groupMember.create({
      data: { shareGroupId: group1.id, memberId: members[i].id, nickname: members[i].nickname },
    });
  }

  let date1 = new Date('2025-01-15');
  for (let i = 1; i <= 5; i++) {
    await prisma.round.create({
      data: {
        shareGroupId: group1.id,
        roundNumber: i,
        dueDate: new Date(date1),
        status: 'PENDING',
        winnerId: i === 1 ? host1.id : null,
      },
    });
    date1.setMonth(date1.getMonth() + 1);
  }
  console.log('Group 1:', group1.name);

  // ==================== วงที่ 2: ไม่มี managementFee (แสดง 0) ====================
  // ทดสอบ: ค่าดูแลวง = 0, ดอกเบี้ย = winningBid
  const group2 = await prisma.shareGroup.create({
    data: {
      tenantId: tenant.id,
      hostId: admin.id,
      name: '2. ไม่มีค่าดูแล (แสดง 0)',
      type: 'BID_INTEREST',
      maxMembers: 5,
      principalAmount: 5000,
      // ไม่มี managementFee → แสดง 0
      cycleType: 'MONTHLY',
      cycleDays: 0,
      startDate: new Date('2024-11-01'),
      status: 'OPEN',
    },
  });

  const host2 = await prisma.groupMember.create({
    data: { shareGroupId: group2.id, userId: admin.id, nickname: 'ท้าวแชร์' },
  });
  for (let i = 0; i < 4; i++) {
    await prisma.groupMember.create({
      data: { shareGroupId: group2.id, memberId: members[i].id, nickname: members[i].nickname },
    });
  }

  let date2 = new Date('2024-11-01');
  for (let i = 1; i <= 5; i++) {
    await prisma.round.create({
      data: {
        shareGroupId: group2.id,
        roundNumber: i,
        dueDate: new Date(date2),
        status: 'PENDING',
        winnerId: i === 1 ? host2.id : null,
        winningBid: i === 2 ? 500 : 0, // งวด 2 มียอดประมูล
      },
    });
    date2.setMonth(date2.getMonth() + 1);
  }
  console.log('Group 2:', group2.name);

  // ==================== วงที่ 3: ไม่มี interestRate (แสดง 0) ====================
  // ทดสอบ: ค่าดูแลวง = 1000, ดอกเบี้ย = 0 (ไม่มี interestRate)
  const group3 = await prisma.shareGroup.create({
    data: {
      tenantId: tenant.id,
      hostId: admin.id,
      name: '3. ไม่มีดอกเบี้ย (แสดง 0)',
      type: 'STEP_INTEREST',
      maxMembers: 5,
      principalAmount: 20000,
      managementFee: 1000, // ✓ มีค่าดูแลวง
      // ไม่มี interestRate → แสดง 0
      cycleType: 'MONTHLY',
      cycleDays: 0,
      startDate: new Date('2024-10-01'),
      status: 'OPEN',
    },
  });

  await prisma.groupDeductionTemplate.createMany({
    data: [
      { shareGroupId: group3.id, name: 'ค่าน้ำชา', amount: 500 },
    ],
  });

  const host3 = await prisma.groupMember.create({
    data: { shareGroupId: group3.id, userId: admin.id, nickname: 'ท้าวแชร์' },
  });
  for (let i = 0; i < 4; i++) {
    await prisma.groupMember.create({
      data: { shareGroupId: group3.id, memberId: members[i].id, nickname: members[i].nickname },
    });
  }

  let date3 = new Date('2024-10-01');
  for (let i = 1; i <= 5; i++) {
    await prisma.round.create({
      data: {
        shareGroupId: group3.id,
        roundNumber: i,
        dueDate: new Date(date3),
        status: 'PENDING',
        winnerId: i === 1 ? host3.id : null,
      },
    });
    date3.setMonth(date3.getMonth() + 1);
  }
  console.log('Group 3:', group3.name);

  // ==================== วงที่ 4: ไม่มีทั้ง managementFee และ interestRate ====================
  // ทดสอบ: ค่าดูแลวง = 0, ดอกเบี้ย = 0
  const group4 = await prisma.shareGroup.create({
    data: {
      tenantId: tenant.id,
      hostId: admin.id,
      name: '4. ไม่มีทั้งคู่ (แสดง 0 ทั้งสอง)',
      type: 'STEP_INTEREST',
      maxMembers: 3,
      principalAmount: 3000,
      // ไม่มี managementFee → แสดง 0
      // ไม่มี interestRate → แสดง 0
      cycleType: 'MONTHLY',
      cycleDays: 0,
      startDate: new Date('2024-06-01'),
      status: 'OPEN',
    },
  });

  const host4 = await prisma.groupMember.create({
    data: { shareGroupId: group4.id, userId: admin.id, nickname: 'ท้าวแชร์' },
  });
  for (let i = 0; i < 2; i++) {
    await prisma.groupMember.create({
      data: { shareGroupId: group4.id, memberId: members[i].id, nickname: members[i].nickname },
    });
  }

  let date4 = new Date('2024-06-01');
  for (let i = 1; i <= 3; i++) {
    await prisma.round.create({
      data: {
        shareGroupId: group4.id,
        roundNumber: i,
        dueDate: new Date(date4),
        status: 'PENDING',
        winnerId: i === 1 ? host4.id : null,
      },
    });
    date4.setMonth(date4.getMonth() + 1);
  }
  console.log('Group 4:', group4.name);

  // ==================== Sample Notifications ====================
  await prisma.notification.deleteMany({
    where: { tenantId: tenant.id },
  });
  console.log('Sample notifications cleared');

  console.log('\n========================================');
  console.log('--- Login Credentials ---');
  console.log('SuperAdmin: admin@platform.com / admin123');
  console.log('Tenant Admin: demo-share / 0891234567 / password123');
  console.log('');
  console.log('========================================');
  console.log('Test Cases: Auto-fill (แสดงเสมอ แม้เป็น 0)');
  console.log('========================================');
  console.log('');
  console.log('1. มีค่าดูแล + มีดอก');
  console.log('   ค่าดูแลวง: 500  |  ดอกเบี้ย: 100×งวด');
  console.log('   → งวด 1: ค่าดูแล 500, ดอก 0');
  console.log('   → งวด 2: ค่าดูแล 500, ดอก 200');
  console.log('');
  console.log('2. ไม่มีค่าดูแล (แสดง 0)');
  console.log('   ค่าดูแลวง: 0  |  ดอกเบี้ย: winningBid');
  console.log('   → งวด 1: ค่าดูแล 0, ดอก 0');
  console.log('   → งวด 2: ค่าดูแล 0, ดอก 500');
  console.log('');
  console.log('3. ไม่มีดอกเบี้ย (แสดง 0)');
  console.log('   ค่าดูแลวง: 1000  |  ดอกเบี้ย: 0 (ไม่มี interestRate)');
  console.log('   → งวด 2: ค่าดูแล 1000, ดอก 0');
  console.log('');
  console.log('4. ไม่มีทั้งคู่ (แสดง 0 ทั้งสอง)');
  console.log('   ค่าดูแลวง: 0  |  ดอกเบี้ย: 0');
  console.log('   → งวด 2: ค่าดูแล 0, ดอก 0');
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
