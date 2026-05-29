import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  date,
  doublePrecision,
  jsonb,
  vector,
} from "drizzle-orm/pg-core";

// ─── Program data (normalised from the flat CSV export) ───

export const schools = pgTable("schools", {
  id: text("id").primaryKey(), // SCHOOL_ACCOUNT_ID
  name: text("name").notNull(),
  state: text("state"),
  region: text("region"),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  icseaPercentile: integer("icsea_percentile"),
  enrolments: integer("enrolments"),
});

export const agreements = pgTable("agreements", {
  id: text("id").primaryKey(), // SCHOOL_AGREEMENT_OPPORTUNITY_ID
  schoolId: text("school_id").references(() => schools.id),
  name: text("name"),
  stage: text("stage"),
  closeDate: date("close_date"),
  amountCents: integer("amount_cents"), // "$15,000" -> 1500000
});

export const workshops = pgTable("workshops", {
  id: text("id").primaryKey(), // WORKSHOP_SF_ID
  code: text("code"),
  topic: text("topic"), // HEALTH | SELF | SKILLS | PURPOSE | TRIBE
  region: text("region"),
  location: text("location"),
  date: date("date"),
  startTime: text("start_time"),
  endTime: text("end_time"),
  schoolId: text("school_id").references(() => schools.id),
  leadFacilitator: text("lead_facilitator"),
  facilitatorsList: text("facilitators_list"),
  mentorsList: text("mentors_list"),
  numberOfStudents: integer("number_of_students"),
  facilitatorRating: integer("facilitator_rating"), // 1-5
  wasCompromised: boolean("was_compromised"),
  ifCompromised: text("if_compromised"),
  didDeviate: boolean("did_deviate"),
  ifDeviated: text("if_deviated"),
  workshopGems: text("workshop_gems"),
  anythingElse: text("anything_else"),
});

export const submissions = pgTable("submissions", {
  id: text("id").primaryKey(), // SUBMISSION_ID
  workshopId: text("workshop_id").references(() => workshops.id),
  yearLevel: integer("year_level"),
  atsi: boolean("atsi"), // ATSI_IDENTIFICATION YES/NO
  gender: text("gender"),
  submittedOn: timestamp("submitted_on", { withTimezone: true }),
});

export const answers = pgTable("answers", {
  id: text("id").primaryKey(), // `${SUBMISSION_ID}_${QUESTION_ID}` (deterministic, re-seedable)
  submissionId: text("submission_id")
    .references(() => submissions.id)
    .notNull(),
  questionId: text("question_id").notNull(),
  questionText: text("question_text"),
  answerText: text("answer_text"),
  answerValue: integer("answer_value"), // 1-5 Likert; null for open-ended
  heartwarming: boolean("heartwarming"),
  // Pre-computed at ingest — OPEN-ENDED answers only:
  sentiment: text("sentiment"), // positive | neutral | negative
  themes: text("themes").array(),
  embedding: vector("embedding", { dimensions: 1536 }),
});

// ─── App data ───

export const chats = pgTable("chats", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const messages = pgTable("messages", {
  id: text("id").primaryKey(),
  chatId: text("chat_id")
    .references(() => chats.id, { onDelete: "cascade" })
    .notNull(),
  role: text("role").notNull(), // user | assistant
  parts: jsonb("parts").notNull(), // AI SDK UIMessage parts (text, tool results, etc.)
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const dashboards = pgTable("dashboards", {
  id: text("id").primaryKey(), // dsh_...
  chatId: text("chat_id").references(() => chats.id, { onDelete: "cascade" }),
  spec: jsonb("spec").notNull(), // compact, referenceable spec (labeled datapoints + per-widget query)
  dataRef: jsonb("data_ref"), // full underlying rows cached server-side
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const reports = pgTable("reports", {
  id: text("id").primaryKey(),
  audience: text("audience").notNull(), // funder | school | board
  spec: jsonb("spec").notNull(), // narrative sections + chosen charts
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
