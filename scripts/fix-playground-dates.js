const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const now = new Date();

  const listCollections = await prisma.$runCommandRaw({
    listCollections: 1,
    nameOnly: true,
  });

  const availableCollections = (listCollections.cursor?.firstBatch || []).map(
    (item) => item.name
  );

  const collectionName = availableCollections.includes("Playground")
    ? "Playground"
    : availableCollections.includes("playground")
    ? "playground"
    : "Playground";

  const createdAtResult = await prisma.$runCommandRaw({
    update: collectionName,
    updates: [
      {
        q: {
          $or: [{ createdAt: null }, { createdAt: { $exists: false } }],
        },
        u: { $set: { createdAt: now } },
        multi: true,
      },
    ],
  });

  const updatedAtResult = await prisma.$runCommandRaw({
    update: collectionName,
    updates: [
      {
        q: {
          $or: [{ updatedAt: null }, { updatedAt: { $exists: false } }],
        },
        u: { $set: { updatedAt: now } },
        multi: true,
      },
    ],
  });

  const createdCount = createdAtResult?.nModified ?? 0;
  const updatedCount = updatedAtResult?.nModified ?? 0;

  console.log(`Collection: ${collectionName}`);
  console.log(`createdAt fixed: ${createdCount}`);
  console.log(`updatedAt fixed: ${updatedCount}`);
}

main()
  .catch((error) => {
    console.error("Failed to fix playground dates:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
