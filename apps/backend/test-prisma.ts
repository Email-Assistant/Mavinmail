import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    const settings = await prisma.userSettings.findFirst();
    console.log("Settings found or empty:", settings);
    
    // Also try checking credits logic
    const user = await prisma.user.findFirst();
    console.log("User:", user?.id, user?.credits, user?.plan);
  } catch (err) {
    console.error("Prisma Error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
