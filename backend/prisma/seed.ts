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

  // Delete old members first
  await prisma.member.deleteMany({
    where: { tenantId: tenant.id },
  });
  console.log('Old members deleted');

  // Create sample Members (ลูกแชร์) - ชื่อสมจริง
  const membersData = [
    { memberCode: 'M001', nickname: 'ป้าเล็ก', phone: '0891111111', lineId: 'palek99' },
    { memberCode: 'M002', nickname: 'น้องแอ๋ม', phone: '0892222222', lineId: null },
    { memberCode: 'M003', nickname: 'ลุงสมบัติ', phone: '0893333333', lineId: 'sombat_share' },
    { memberCode: 'M004', nickname: 'พี่นก', phone: '0894444444', lineId: 'nok_bird' },
    { memberCode: 'M005', nickname: 'น้าหมู', phone: '0895555555', lineId: null },
    { memberCode: 'M006', nickname: 'ป้าจัน', phone: '0896666666', lineId: 'chan_auntie' },
    { memberCode: 'M007', nickname: 'พี่ต๋อย', phone: null, lineId: 'toy_share' },
    { memberCode: 'M008', nickname: 'น้องเบล', phone: '0898888888', lineId: null },
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
  // Test Cases สำหรับ Group Info Section (ค่าดูแลวง และ ดอกเบี้ย)
  // ====================================================================================

  // ==================== วงที่ 1: STEP_INTEREST - มีทั้ง managementFee และ interestRate ====================
  // Group Info: ค่าดูแลวง 500 บาท | ดอกเบี้ย 100 บาท
  const group1 = await prisma.shareGroup.create({
    data: {
      tenantId: tenant.id,
      hostId: admin.id,
      name: 'วงออมทรัพย์หมู่บ้าน',
      type: 'STEP_INTEREST',
      maxMembers: 5,
      principalAmount: 10000,
      managementFee: 500,
      interestRate: 100,
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
    data: { shareGroupId: group1.id, userId: admin.id, nickname: 'ป้าแดง (ท้าว)' },
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
        status: i === 1 ? 'COMPLETED' : 'PENDING',
        winnerId: i === 1 ? host1.id : null,
      },
    });
    date1.setMonth(date1.getMonth() + 1);
  }
  console.log('Group 1:', group1.name, '(STEP_INTEREST - มีทั้งค่าดูแลและดอก)');

  // ==================== วงที่ 2: FIXED_INTEREST - มีทั้ง managementFee และ interestRate ====================
  // Group Info: ค่าดูแลวง 300 บาท | ดอกเบี้ย 150 บาท
  const group2 = await prisma.shareGroup.create({
    data: {
      tenantId: tenant.id,
      hostId: admin.id,
      name: 'วงดอกคงที่ตลาดนัด',
      type: 'FIXED_INTEREST',
      maxMembers: 5,
      principalAmount: 5000,
      managementFee: 300,
      interestRate: 150,
      cycleType: 'MONTHLY',
      cycleDays: 0,
      startDate: new Date('2025-02-01'),
      status: 'OPEN',
    },
  });

  const host2 = await prisma.groupMember.create({
    data: { shareGroupId: group2.id, userId: admin.id, nickname: 'ป้าแดง (ท้าว)' },
  });
  for (let i = 0; i < 4; i++) {
    await prisma.groupMember.create({
      data: { shareGroupId: group2.id, memberId: members[i + 4].id, nickname: members[i + 4].nickname },
    });
  }

  let date2 = new Date('2025-02-01');
  for (let i = 1; i <= 5; i++) {
    await prisma.round.create({
      data: {
        shareGroupId: group2.id,
        roundNumber: i,
        dueDate: new Date(date2),
        status: 'PENDING',
        winnerId: i === 1 ? host2.id : null,
      },
    });
    date2.setMonth(date2.getMonth() + 1);
  }
  console.log('Group 2:', group2.name, '(FIXED_INTEREST - มีทั้งค่าดูแลและดอก)');

  // ==================== วงที่ 3: BID_INTEREST - มี managementFee แต่ไม่มี interestRate ====================
  // Group Info: ค่าดูแลวง 200 บาท | (ไม่แสดงดอกเบี้ย เพราะเป็นประมูล)
  const group3 = await prisma.shareGroup.create({
    data: {
      tenantId: tenant.id,
      hostId: admin.id,
      name: 'วงประมูลเพื่อนบ้าน',
      type: 'BID_INTEREST',
      maxMembers: 5,
      principalAmount: 8000,
      managementFee: 200,
      // ไม่มี interestRate - BID_INTEREST ใช้การประมูล
      cycleType: 'MONTHLY',
      cycleDays: 0,
      startDate: new Date('2025-01-01'),
      status: 'OPEN',
    },
  });

  const host3 = await prisma.groupMember.create({
    data: { shareGroupId: group3.id, userId: admin.id, nickname: 'ป้าแดง (ท้าว)' },
  });
  for (let i = 0; i < 4; i++) {
    await prisma.groupMember.create({
      data: { shareGroupId: group3.id, memberId: members[i].id, nickname: members[i].nickname },
    });
  }

  let date3 = new Date('2025-01-01');
  for (let i = 1; i <= 5; i++) {
    await prisma.round.create({
      data: {
        shareGroupId: group3.id,
        roundNumber: i,
        dueDate: new Date(date3),
        status: i <= 2 ? 'COMPLETED' : 'PENDING',
        winnerId: i === 1 ? host3.id : null,
        winningBid: i === 2 ? 500 : 0,
      },
    });
    date3.setMonth(date3.getMonth() + 1);
  }
  console.log('Group 3:', group3.name, '(BID_INTEREST - มีค่าดูแล ไม่แสดงดอก)');

  // ==================== วงที่ 4: STEP_INTEREST - มี interestRate แต่ไม่มี managementFee ====================
  // Group Info: ค่าดูแลวง 0 บาท | ดอกเบี้ย 50 บาท
  const group4 = await prisma.shareGroup.create({
    data: {
      tenantId: tenant.id,
      hostId: admin.id,
      name: 'วงกลุ่มเพื่อนเก่า',
      type: 'STEP_INTEREST',
      maxMembers: 4,
      principalAmount: 3000,
      // ไม่มี managementFee → แสดง 0
      interestRate: 50,
      cycleType: 'MONTHLY',
      cycleDays: 0,
      startDate: new Date('2025-03-01'),
      status: 'DRAFT',
    },
  });

  const host4 = await prisma.groupMember.create({
    data: { shareGroupId: group4.id, userId: admin.id, nickname: 'ป้าแดง (ท้าว)' },
  });
  for (let i = 0; i < 3; i++) {
    await prisma.groupMember.create({
      data: { shareGroupId: group4.id, memberId: members[i].id, nickname: members[i].nickname },
    });
  }

  let date4 = new Date('2025-03-01');
  for (let i = 1; i <= 4; i++) {
    await prisma.round.create({
      data: {
        shareGroupId: group4.id,
        roundNumber: i,
        dueDate: new Date(date4),
        status: 'PENDING',
      },
    });
    date4.setMonth(date4.getMonth() + 1);
  }
  console.log('Group 4:', group4.name, '(STEP_INTEREST - ไม่มีค่าดูแล มีดอก)');

  // ==================== วงที่ 5: STEP_INTEREST - ไม่มีทั้ง managementFee และ interestRate ====================
  // Group Info: ค่าดูแลวง 0 บาท | ดอกเบี้ย 0 บาท
  const group5 = await prisma.shareGroup.create({
    data: {
      tenantId: tenant.id,
      hostId: admin.id,
      name: 'วงเล็กๆ ไม่หักอะไร',
      type: 'STEP_INTEREST',
      maxMembers: 3,
      principalAmount: 1000,
      // ไม่มี managementFee → แสดง 0
      // ไม่มี interestRate → แสดง 0
      cycleType: 'WEEKLY',
      cycleDays: 7,
      startDate: new Date('2025-04-01'),
      status: 'DRAFT',
    },
  });

  await prisma.groupMember.create({
    data: { shareGroupId: group5.id, userId: admin.id, nickname: 'ป้าแดง (ท้าว)' },
  });
  for (let i = 0; i < 2; i++) {
    await prisma.groupMember.create({
      data: { shareGroupId: group5.id, memberId: members[i].id, nickname: members[i].nickname },
    });
  }

  let date5 = new Date('2025-04-01');
  for (let i = 1; i <= 3; i++) {
    await prisma.round.create({
      data: {
        shareGroupId: group5.id,
        roundNumber: i,
        dueDate: new Date(date5),
        status: 'PENDING',
      },
    });
    date5.setDate(date5.getDate() + 7);
  }
  console.log('Group 5:', group5.name, '(STEP_INTEREST - ไม่มีทั้งค่าดูแลและดอก)');

  // ==================== วงที่ 6: BID_INTEREST - ไม่มี managementFee ====================
  // Group Info: ค่าดูแลวง 0 บาท | (ไม่แสดงดอกเบี้ย เพราะเป็นประมูล)
  const group6 = await prisma.shareGroup.create({
    data: {
      tenantId: tenant.id,
      hostId: admin.id,
      name: 'วงประมูลไม่มีค่าดูแล',
      type: 'BID_INTEREST',
      maxMembers: 4,
      principalAmount: 5000,
      // ไม่มี managementFee → แสดง 0
      // ไม่มี interestRate - BID_INTEREST ใช้การประมูล
      cycleType: 'MONTHLY',
      cycleDays: 0,
      startDate: new Date('2025-05-01'),
      status: 'DRAFT',
    },
  });

  await prisma.groupMember.create({
    data: { shareGroupId: group6.id, userId: admin.id, nickname: 'ป้าแดง (ท้าว)' },
  });

  console.log('Group 6:', group6.name, '(BID_INTEREST - ไม่มีค่าดูแล)');

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
  console.log('Test Cases: Group Info Section');
  console.log('========================================');
  console.log('');
  console.log('1. วงออมทรัพย์หมู่บ้าน (STEP_INTEREST)');
  console.log('   → ค่าดูแลวง: 500 บาท | ดอกเบี้ย: 100 บาท');
  console.log('');
  console.log('2. วงดอกคงที่ตลาดนัด (FIXED_INTEREST)');
  console.log('   → ค่าดูแลวง: 300 บาท | ดอกเบี้ย: 150 บาท');
  console.log('');
  console.log('3. วงประมูลเพื่อนบ้าน (BID_INTEREST)');
  console.log('   → ค่าดูแลวง: 200 บาท | ไม่แสดงดอกเบี้ย');
  console.log('');
  console.log('4. วงกลุ่มเพื่อนเก่า (STEP_INTEREST)');
  console.log('   → ค่าดูแลวง: 0 บาท | ดอกเบี้ย: 50 บาท');
  console.log('');
  console.log('5. วงเล็กๆ ไม่หักอะไร (STEP_INTEREST)');
  console.log('   → ค่าดูแลวง: 0 บาท | ดอกเบี้ย: 0 บาท');
  console.log('');
  console.log('6. วงประมูลไม่มีค่าดูแล (BID_INTEREST)');
  console.log('   → ค่าดูแลวง: 0 บาท | ไม่แสดงดอกเบี้ย');
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
