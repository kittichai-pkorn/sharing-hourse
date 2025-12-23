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

  // ==================== วงที่ 1: DRAFT (สมาชิกครบ - พร้อมเปิด) ====================
  const group1 = await prisma.shareGroup.create({
    data: {
      tenantId: tenant.id,
      hostId: admin.id,
      name: 'วงแชร์พร้อมเปิด (DRAFT)',
      type: 'STEP_INTEREST',
      maxMembers: 5,
      principalAmount: 1000,
      cycleType: 'MONTHLY',
      cycleDays: 0,
      startDate: new Date('2025-01-15'),
      status: 'DRAFT',
    },
  });

  // Add deduction templates
  await prisma.groupDeductionTemplate.createMany({
    data: [
      { shareGroupId: group1.id, name: 'ค่าดูแลวง', amount: 100 },
      { shareGroupId: group1.id, name: 'หักท้ายท้าว', amount: 50 },
    ],
  });

  // Add host as first member
  const host1 = await prisma.groupMember.create({
    data: { shareGroupId: group1.id, userId: admin.id, nickname: 'ท้าวแชร์' },
  });

  // Add 4 more members (total 5)
  for (let i = 0; i < 4; i++) {
    await prisma.groupMember.create({
      data: { shareGroupId: group1.id, memberId: members[i].id, nickname: members[i].nickname },
    });
  }

  // Create rounds
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
  console.log('Group 1 (DRAFT - พร้อมเปิด):', group1.name);

  // ==================== วงที่ 2: DRAFT (สมาชิกไม่ครบ) ====================
  const group2 = await prisma.shareGroup.create({
    data: {
      tenantId: tenant.id,
      hostId: admin.id,
      name: 'วงแชร์สมาชิกไม่ครบ (DRAFT)',
      type: 'BID_INTEREST',
      maxMembers: 10,
      principalAmount: 2000,
      cycleType: 'MONTHLY',
      cycleDays: 0,
      startDate: new Date('2025-02-01'),
      status: 'DRAFT',
    },
  });

  // Add only host and 2 members (3/10)
  const host2 = await prisma.groupMember.create({
    data: { shareGroupId: group2.id, userId: admin.id, nickname: 'ท้าวแชร์' },
  });
  await prisma.groupMember.create({
    data: { shareGroupId: group2.id, memberId: members[0].id, nickname: members[0].nickname },
  });
  await prisma.groupMember.create({
    data: { shareGroupId: group2.id, memberId: members[1].id, nickname: members[1].nickname },
  });

  // Create rounds
  let date2 = new Date('2025-02-01');
  for (let i = 1; i <= 10; i++) {
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
  console.log('Group 2 (DRAFT - สมาชิกไม่ครบ):', group2.name);

  // ==================== วงที่ 3: OPEN (กำลังดำเนินการ) ====================
  const group3 = await prisma.shareGroup.create({
    data: {
      tenantId: tenant.id,
      hostId: admin.id,
      name: 'วงแชร์กำลังดำเนินการ (OPEN)',
      type: 'STEP_INTEREST',
      maxMembers: 5,
      principalAmount: 1500,
      cycleType: 'MONTHLY',
      cycleDays: 0,
      startDate: new Date('2024-10-01'),
      status: 'OPEN',
    },
  });

  await prisma.groupDeductionTemplate.createMany({
    data: [
      { shareGroupId: group3.id, name: 'ค่าดูแลวง', amount: 150 },
    ],
  });

  const host3 = await prisma.groupMember.create({
    data: { shareGroupId: group3.id, userId: admin.id, nickname: 'ท้าวแชร์' },
  });

  const group3Members = [host3];
  for (let i = 0; i < 4; i++) {
    const gm = await prisma.groupMember.create({
      data: { shareGroupId: group3.id, memberId: members[i].id, nickname: members[i].nickname },
    });
    group3Members.push(gm);
  }

  // Create rounds - some completed
  let date3 = new Date('2024-10-01');
  for (let i = 1; i <= 5; i++) {
    const isCompleted = i <= 2; // งวด 1-2 เสร็จแล้ว
    await prisma.round.create({
      data: {
        shareGroupId: group3.id,
        roundNumber: i,
        dueDate: new Date(date3),
        status: isCompleted ? 'COMPLETED' : 'PENDING',
        winnerId: isCompleted ? group3Members[i - 1].id : (i === 1 ? host3.id : null),
        winningBid: isCompleted && i > 1 ? 80 : 0,
        payoutAmount: isCompleted ? 7500 - 150 - (i > 1 ? 80 : 0) : null,
      },
    });

    // Create deductions for completed rounds
    if (isCompleted) {
      await prisma.deduction.create({
        data: {
          roundId: (await prisma.round.findFirst({ where: { shareGroupId: group3.id, roundNumber: i } }))!.id,
          type: 'OTHER',
          amount: 150,
          note: 'ค่าดูแลวง',
        },
      });
      if (i > 1) {
        await prisma.deduction.create({
          data: {
            roundId: (await prisma.round.findFirst({ where: { shareGroupId: group3.id, roundNumber: i } }))!.id,
            type: 'INTEREST',
            amount: 80,
            note: 'ดอกเบี้ย',
          },
        });
      }
    }

    date3.setMonth(date3.getMonth() + 1);
  }
  console.log('Group 3 (OPEN - 2/5 งวดเสร็จ):', group3.name);

  // ==================== วงที่ 4: COMPLETED (เสร็จสิ้น) ====================
  const group4 = await prisma.shareGroup.create({
    data: {
      tenantId: tenant.id,
      hostId: admin.id,
      name: 'วงแชร์เสร็จสิ้นแล้ว (COMPLETED)',
      type: 'STEP_INTEREST',
      maxMembers: 3,
      principalAmount: 500,
      cycleType: 'WEEKLY',
      cycleDays: 0,
      startDate: new Date('2024-06-01'),
      status: 'COMPLETED',
    },
  });

  const host4 = await prisma.groupMember.create({
    data: { shareGroupId: group4.id, userId: admin.id, nickname: 'ท้าวแชร์' },
  });

  const group4Members = [host4];
  for (let i = 0; i < 2; i++) {
    const gm = await prisma.groupMember.create({
      data: { shareGroupId: group4.id, memberId: members[i].id, nickname: members[i].nickname },
    });
    group4Members.push(gm);
  }

  // All rounds completed
  let date4 = new Date('2024-06-01');
  for (let i = 1; i <= 3; i++) {
    await prisma.round.create({
      data: {
        shareGroupId: group4.id,
        roundNumber: i,
        dueDate: new Date(date4),
        status: 'COMPLETED',
        winnerId: group4Members[i - 1].id,
        winningBid: i === 1 ? 0 : 30,
        payoutAmount: 1500 - (i === 1 ? 0 : 30),
      },
    });
    date4.setDate(date4.getDate() + 7);
  }
  console.log('Group 4 (COMPLETED):', group4.name);

  // ==================== Sample Notifications ====================
  // Delete old notifications
  await prisma.notification.deleteMany({
    where: { tenantId: tenant.id },
  });

  // Create sample notifications for the admin
  const round3 = await prisma.round.findFirst({
    where: { shareGroupId: group3.id, roundNumber: 3 },
  });

  await prisma.notification.createMany({
    data: [
      {
        tenantId: tenant.id,
        userId: admin.id,
        type: 'ROUND_UPCOMING',
        title: 'งวดใกล้ถึงกำหนด',
        message: `งวดที่ 3 ของ "${group3.name}" ถึงกำหนดพรุ่งนี้`,
        isRead: false,
        referenceId: round3?.id,
        referenceType: 'round',
        createdAt: new Date(),
      },
      {
        tenantId: tenant.id,
        userId: admin.id,
        type: 'WINNER_PENDING',
        title: 'รอบันทึกผู้ชนะ',
        message: `รอบันทึกผู้ชนะงวดที่ 3 ของ "${group3.name}"`,
        isRead: false,
        referenceId: round3?.id,
        referenceType: 'round',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
      },
      {
        tenantId: tenant.id,
        userId: admin.id,
        type: 'WINNER_RECORDED',
        title: 'บันทึกผู้ชนะแล้ว',
        message: `พี่เอ ชนะงวดที่ 2 ของ "${group3.name}"`,
        isRead: true,
        referenceId: (await prisma.round.findFirst({ where: { shareGroupId: group3.id, roundNumber: 2 } }))?.id,
        referenceType: 'round',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
        readAt: new Date(Date.now() - 1000 * 60 * 60 * 23),
      },
      {
        tenantId: tenant.id,
        userId: admin.id,
        type: 'GROUP_COMPLETED',
        title: 'วงเสร็จสิ้น',
        message: `วง "${group4.name}" เสร็จสิ้นแล้ว`,
        isRead: true,
        referenceId: group4.id,
        referenceType: 'shareGroup',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3), // 3 days ago
        readAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2),
      },
    ],
  });
  console.log('Sample notifications created');

  console.log('\n========================================');
  console.log('--- Login Credentials ---');
  console.log('SuperAdmin: admin@platform.com / admin123');
  console.log('Tenant Admin: demo-share / 0891234567 / password123');
  console.log('\n--- Test Share Groups ---');
  console.log('1. วงแชร์พร้อมเปิด (DRAFT) - สมาชิกครบ 5/5 คน, มีตารางงวด -> สามารถเปิดได้');
  console.log('2. วงแชร์สมาชิกไม่ครบ (DRAFT) - สมาชิก 3/10 คน -> ไม่สามารถเปิดได้');
  console.log('3. วงแชร์กำลังดำเนินการ (OPEN) - เสร็จ 2/5 งวด -> คลิกบันทึกผู้ชนะได้');
  console.log('4. วงแชร์เสร็จสิ้นแล้ว (COMPLETED) - เสร็จ 3/3 งวด -> ดูสรุป');
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
