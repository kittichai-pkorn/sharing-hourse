# Documentation

เอกสาร Blueprint สำหรับการพัฒนาและ Deploy ระบบ Multi-tenant SaaS Platform

---

## เอกสารที่มี

### Business Logic
| เอกสาร | รายละเอียด |
|--------|------------|
| [HOW_TO_PLAY.md](./specs/HOW_TO_PLAY.md) | วิธีการเล่นวงแชร์พื้นฐาน |
| [SHARE_GROUP_TYPES.md](./specs/SHARE_GROUP_TYPES.md) | ประเภทวงแชร์ทั้งหมด |
| [CREATE_SHARE_GROUP.md](./specs/CREATE_SHARE_GROUP.md) | วิธีสร้างวงแชร์ใหม่ |

### Technical
| เอกสาร | รายละเอียด |
|--------|------------|
| [TECH_STACK.md](./TECH_STACK.md) | Tech Stack ทั้งหมด (React, Node.js, Prisma, etc.) |
| [SUPER_ADMIN_BLUEPRINT.md](./SUPER_ADMIN_BLUEPRINT.md) | Blueprint ระบบ Super Admin Panel |
| [DEPLOYMENT_DOCKER.md](./DEPLOYMENT_DOCKER.md) | คู่มือ Deploy ด้วย Docker Compose |
| [DEPLOYMENT_DIGITALOCEAN.md](./DEPLOYMENT_DIGITALOCEAN.md) | คู่มือ Deploy บน DigitalOcean |

---

## การนำไปใช้

เอกสารเหล่านี้ออกแบบให้เป็น **Blueprint** ที่สามารถนำไปใช้กับโปรเจคใหม่ได้ โดย:

1. เปลี่ยน placeholder `your-app` เป็นชื่อโปรเจคจริง
2. เปลี่ยน `yourdomain.com` เป็น domain จริง
3. ปรับ database schema ตามความต้องการของระบบ

---

## Tech Stack Overview

| Layer | Technology |
|-------|------------|
| Frontend | React + TypeScript + Vite |
| Backend | Node.js + Express + TypeScript |
| Database | MySQL + Prisma ORM |
| State | Zustand |
| Styling | SCSS |

---

## Quick Start

```bash
# Backend
cd backend
npm install
cp .env.example .env
npx prisma migrate dev
npm run dev

# Frontend
cd frontend
npm install
cp .env.example .env
npm run dev
```

---

*Last Updated: December 2024*
