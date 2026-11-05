import { MongoClient } from "mongodb";

if (!process.env.MONGO_URI) {
  throw new Error("MONGO_URI is required. Copy .env.example to .env and set it.");
}

export const client = new MongoClient(process.env.MONGO_URI, {
  serverSelectionTimeoutMS: 5000,
});
export const db = client.db(process.env.MONGO_DB || "social_spark");

let connection;
export function connectDatabase() {
  if (!connection) {
    connection = (async () => {
      await client.connect();
      await db.command({ ping: 1 });
      await db.collection("events").createIndex({ date: 1, createdAt: -1 });
      await db.collection("events").createIndex({ createdById: 1, date: 1 });
      await db.collection("joins").createIndex({ userId: 1, eventId: 1 }, { unique: true });
      await db.collection("joins").createIndex({ userId: 1, joinedAt: -1 });
    })().catch((error) => {
      connection = null;
      throw error;
    });
  }
  return connection;
}
