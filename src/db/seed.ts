import { prisma } from "../db/client";
import { logger } from "../logger";
import * as fs from "fs";
import * as path from "path";

async function seed() {
  logger.info("Starting database seed...");

  // Read CSV file
  const csvPath = path.join(process.cwd(), "data.csv");
  const csvContent = fs.readFileSync(csvPath, "utf-8");
  const lines = csvContent.split("\n").filter(line => line.trim());
  
  // Skip header
  const dataLines = lines.slice(1);
  
  logger.info(`Found ${dataLines.length} rows to import`);

  // Parse and insert data
  for (const line of dataLines) {
    // Parse CSV: "body","time"
    const match = line.match(/^"(.*)","(.*)"$/);
    if (!match) continue;
    
    const [, body, timeStr] = match;
    const time = new Date(timeStr);

    await prisma.post.create({
      data: {
        body: body.replace(/""/g, '"'), // Unescape quotes
        time,
      },
    });
  }

  logger.info("Seed completed successfully");
}

seed()
  .catch((e) => {
    logger.error(e, "Seed failed");
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
