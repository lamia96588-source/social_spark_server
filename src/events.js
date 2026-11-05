import { Router } from "express";
import { ObjectId } from "mongodb";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { z } from "zod";
import { appUrl } from "./auth.js";
import { db } from "./db.js";

export const eventRoutes = Router();
const jwks = createRemoteJWKSet(new URL(`${appUrl}/api/auth/jwks`));
const categories = ["Donation", "Plantation", "Cleanup", "Education", "Community", "Other"];

function todayInDhaka() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Dhaka", year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(new Date())
      .map(({ type, value }) => [type, value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

const eventInput = z.object({
  title: z.string().trim().min(5).max(90),
  description: z.string().trim().min(20).max(1000),
  category: z.enum(categories),
  thumbnail: z.string().url().refine((value) => value.startsWith("https://"), "Use an https:// image URL"),
  location: z.string().trim().min(3).max(120),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value && value > todayInDhaka();
  }, "Choose a future date"),
}).strict();

const eventId = (value) => /^[a-f\d]{24}$/i.test(value) ? new ObjectId(value) : null;
const asEvent = (record) => ({
  id: record._id.toString(),
  title: record.title,
  description: record.description,
  category: record.category,
  thumbnail: record.thumbnail,
  location: record.location,
  date: record.date,
  createdBy: record.createdByEmail,
  createdAt: record.createdAt,
});

async function requireAuth(req, res, next) {
  const token = /^Bearer\s+(.+)$/i.exec(req.headers.authorization || "")?.[1];
  if (!token) return res.status(401).json({ error: "Please log in to continue." });
  try {
    const { payload } = await jwtVerify(token, jwks, { issuer: appUrl, audience: appUrl, algorithms: ["EdDSA"] });
    if (typeof payload.sub !== "string" || typeof payload.email !== "string") throw new Error("Invalid user claims");
    res.locals.authUser = { id: payload.sub, email: payload.email, name: typeof payload.name === "string" ? payload.name : payload.email };
    next();
  } catch {
    res.status(401).json({ error: "Your session expired. Please log in again." });
  }
}

function parseInput(req, res) {
  const parsed = eventInput.safeParse(req.body);
  if (parsed.success) return parsed.data;
  res.status(400).json({ error: parsed.error.issues[0]?.message || "Check the event details." });
  return null;
}

eventRoutes.get("/events/recent", async (_req, res) => {
  const events = await db.collection("events")
    .find({ date: { $gt: todayInDhaka() } })
    .sort({ date: 1, createdAt: -1 })
    .limit(6)
    .toArray();
  res.json({ events: events.map(asEvent) });
});

eventRoutes.get("/events", async (_req, res) => {
  const events = await db.collection("events")
    .find({ date: { $gt: todayInDhaka() } })
    .sort({ date: 1, createdAt: -1 })
    .toArray();
  res.json({ events: events.map(asEvent) });
});

eventRoutes.get("/events/:id", async (req, res) => {
  const id = eventId(req.params.id);
  if (!id) return res.status(404).json({ error: "Event not found." });
  const event = await db.collection("events").findOne({ _id: id });
  if (!event) return res.status(404).json({ error: "Event not found." });
  res.json({ event: asEvent(event) });
});

eventRoutes.get("/me/events", requireAuth, async (_req, res) => {
  const events = await db.collection("events")
    .find({ createdById: res.locals.authUser.id })
    .sort({ date: 1 })
    .toArray();
  res.json({ events: events.map(asEvent) });
});

eventRoutes.get("/me/joins", requireAuth, async (_req, res) => {
  const joins = await db.collection("joins").find({ userId: res.locals.authUser.id }).toArray();
  const ids = joins.map((join) => join.eventId);
  const events = ids.length ? await db.collection("events").find({ _id: { $in: ids } }).toArray() : [];
  const eventMap = new Map(events.map((event) => [event._id.toString(), asEvent(event)]));
  const sorted = joins.filter((join) => eventMap.has(join.eventId.toString()))
    .sort((a, b) => eventMap.get(a.eventId.toString()).date.localeCompare(eventMap.get(b.eventId.toString()).date));
  res.json({
    joins: sorted.map((join) => ({ eventId: join.eventId.toString(), userEmail: join.userEmail, userName: join.userName, joinedAt: join.joinedAt })),
    events: sorted.map((join) => eventMap.get(join.eventId.toString())),
  });
});

eventRoutes.post("/events", requireAuth, async (req, res) => {
  const draft = parseInput(req, res);
  if (!draft) return;
  const user = res.locals.authUser;
  const event = { ...draft, createdById: user.id, createdByEmail: user.email, createdAt: new Date().toISOString() };
  const result = await db.collection("events").insertOne(event);
  res.status(201).json({ event: asEvent({ ...event, _id: result.insertedId }) });
});

eventRoutes.patch("/events/:id", requireAuth, async (req, res) => {
  const id = eventId(req.params.id);
  if (!id) return res.status(404).json({ error: "Event not found." });
  const draft = parseInput(req, res);
  if (!draft) return;
  const updated = await db.collection("events").findOneAndUpdate(
    { _id: id, createdById: res.locals.authUser.id },
    { $set: draft },
    { returnDocument: "after" },
  );
  if (!updated) return res.status(404).json({ error: "Event not found or you do not own it." });
  res.json({ event: asEvent(updated) });
});

eventRoutes.delete("/events/:id", requireAuth, async (req, res) => {
  const id = eventId(req.params.id);
  if (!id) return res.status(404).json({ error: "Event not found." });
  const deleted = await db.collection("events").deleteOne({ _id: id, createdById: res.locals.authUser.id });
  if (!deleted.deletedCount) return res.status(404).json({ error: "Event not found or you do not own it." });
  await db.collection("joins").deleteMany({ eventId: id });
  res.json({ deleted: true });
});

eventRoutes.post("/events/:id/join", requireAuth, async (req, res) => {
  const id = eventId(req.params.id);
  if (!id) return res.status(404).json({ error: "Event not found." });
  const event = await db.collection("events").findOne({ _id: id, date: { $gt: todayInDhaka() } });
  if (!event) return res.status(404).json({ error: "Upcoming event not found." });
  const user = res.locals.authUser;
  try {
    await db.collection("joins").insertOne({
      eventId: id,
      eventTitle: event.title,
      eventDate: event.date,
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      joinedAt: new Date().toISOString(),
    });
    res.status(201).json({ joined: true });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: "You have already joined this event." });
    throw error;
  }
});
