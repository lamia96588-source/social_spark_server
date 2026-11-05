import "dotenv/config";
import { client, connectDatabase, db } from "../src/db.js";

const daysFromNow = (offset) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offset);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(date);
};

const events = [
  {
    seedKey: "winter-clothes", title: "Winter Clothes Sorting Day", category: "Donation",
    description: "Help neighbours sort warm clothes by size, pack family bundles, and prepare them for a local winter distribution.",
    thumbnail: "/images/winter-clothes-sorting-reference.png", location: "Mirpur 10, Dhaka", date: daysFromNow(6),
  },
  {
    seedKey: "street-saplings", title: "A Sapling for Our Street", category: "Plantation",
    description: "Plant shade trees together and learn how to care for them through their first growing season.",
    thumbnail: "/images/community-planting.png", location: "Dhanmondi Lake, Dhaka", date: daysFromNow(10),
  },
  {
    seedKey: "clean-mirpur", title: "Clean Green Mirpur", category: "Cleanup",
    description: "Bring a pair of gloves and join a friendly morning clearing litter from shared paths and planting beds.",
    thumbnail: "/images/sure-we-can-earthday-clean-2021.jpg", location: "Mirpur 11, Dhaka", date: daysFromNow(14),
  },
  {
    seedKey: "book-exchange", title: "Little Neighbourhood Book Exchange", category: "Education",
    description: "Share a book you have loved, discover a new one, and help set up a small community reading corner.",
    thumbnail: "/images/hero-community-island.png", location: "Mohammadpur, Dhaka", date: daysFromNow(19),
  },
  {
    seedKey: "blanket-drive", title: "Blankets for the Cold Nights", category: "Donation",
    description: "Sort donated blankets, prepare care bundles, and help a neighbourhood team coordinate deliveries.",
    thumbnail: "/images/winter-clothes-sorting-reference.png", location: "Adabor, Dhaka", date: daysFromNow(24),
  },
  {
    seedKey: "garden-care", title: "A Morning in the Community Garden", category: "Community",
    description: "Water young plants, refresh the compost beds, and make a little more room for pollinators.",
    thumbnail: "/images/u-s-volunteers-join-okinawans-in-city.jpg", location: "Uttara Sector 7, Dhaka", date: daysFromNow(29),
  },
];

try {
  await connectDatabase();
  await db.collection("events").createIndex({ seedKey: 1 }, { unique: true, sparse: true });
  const now = new Date().toISOString();
  await db.collection("events").bulkWrite(events.map((event) => ({
    updateOne: {
      filter: { seedKey: event.seedKey },
      update: { $set: { ...event, createdById: "socialspark-seed", createdByEmail: "community@socialspark.example" }, $setOnInsert: { createdAt: now } },
      upsert: true,
    },
  })));
  console.log(`Seeded ${events.length} upcoming community events.`);
} finally {
  await client.close();
}
