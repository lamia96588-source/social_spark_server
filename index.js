import express from "express";
import cors from "cors";
import { MongoClient } from 'mongodb';
import "dotenv/config";

const app = express();
app.use(cors());
app.use(express.json());


const client = new MongoClient(process.env.MONGO_URI);
export async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");
    return client;
  } catch (err) {
    console.dir(err);
  }
}


connectToMongoDB();


const PORT = Number(process.env.PORT) || 5000;

app.get("/", (req, res) => {
  res.json({
    message: "Social Spark server is running",
    status: "ok",
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.post("/api/message", (req, res) => {
  const { message } = req.body ?? {};

  res.json({
    message: "Message received",
    data: { message },
  });
});

app.listen(PORT, () => {
  console.log(`Social Spark server running on http://localhost:${PORT}`);
});
