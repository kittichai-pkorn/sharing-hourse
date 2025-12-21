import slugify from 'slugify';
import prisma from './prisma.js';

export function createSlug(text: string): string {
  return slugify(text, {
    lower: true,
    strict: true,
    locale: 'th',
  });
}

export async function generateUniqueSlug(baseName: string): Promise<string> {
  let slug = createSlug(baseName);
  let counter = 0;
  let uniqueSlug = slug;

  while (true) {
    const existing = await prisma.tenant.findUnique({
      where: { slug: uniqueSlug },
    });

    if (!existing) {
      return uniqueSlug;
    }

    counter++;
    uniqueSlug = `${slug}-${counter}`;
  }
}
