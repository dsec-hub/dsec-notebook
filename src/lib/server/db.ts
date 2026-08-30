import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";

const DB_PATH = resolve(process.env.DATABASE_PATH ?? "data/dsec.db");

let db: DatabaseSync | null = null;

function createSchema(database: DatabaseSync) {
	database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      sessionToken TEXT,
      createdAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS topics (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS units (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      topicId TEXT NOT NULL,
      unitId TEXT NOT NULL,
      authorId TEXT NOT NULL,
      authorName TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      voteCount INTEGER NOT NULL DEFAULT 0,
      commentCount INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS questions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      topicId TEXT NOT NULL,
      unitId TEXT NOT NULL,
      authorId TEXT NOT NULL,
      authorName TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      voteCount INTEGER NOT NULL DEFAULT 0,
      answerCount INTEGER NOT NULL DEFAULT 0,
      solved INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      authorId TEXT NOT NULL,
      authorName TEXT NOT NULL,
      parentId TEXT,
      questionId TEXT,
      parentCommentId TEXT,
      createdAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS votes (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      targetType TEXT NOT NULL,
      targetId TEXT NOT NULL,
      value INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_notes_topic ON notes(topicId);
    CREATE INDEX IF NOT EXISTS idx_notes_unit ON notes(unitId);
    CREATE INDEX IF NOT EXISTS idx_notes_created ON notes(createdAt);
    CREATE INDEX IF NOT EXISTS idx_questions_topic ON questions(topicId);
    CREATE INDEX IF NOT EXISTS idx_questions_unit ON questions(unitId);
    CREATE INDEX IF NOT EXISTS idx_questions_created ON questions(createdAt);
    CREATE INDEX IF NOT EXISTS idx_comments_note ON comments(parentId);
    CREATE INDEX IF NOT EXISTS idx_comments_question ON comments(questionId);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_votes_user_target ON votes(userId, targetType, targetId);
  `);
}

const SEED_TOPICS = [
	{
		name: "Algorithms",
		slug: "algorithms",
		description: "Algorithm design, analysis, and common patterns",
	},
	{
		name: "Data Structures",
		slug: "data-structures",
		description: "Arrays, linked lists, trees, graphs, and more",
	},
	{
		name: "Networking",
		slug: "networking",
		description: "Computer networks, protocols, and architectures",
	},
	{
		name: "Cybersecurity",
		slug: "cybersecurity",
		description: "Security principles, threats, and defenses",
	},
	{
		name: "Databases",
		slug: "databases",
		description: "Relational and NoSQL databases, SQL, and design",
	},
	{
		name: "Web Development",
		slug: "web-development",
		description: "HTML, CSS, JavaScript, and frameworks",
	},
	{
		name: "Operating Systems",
		slug: "operating-systems",
		description: "OS concepts, processes, memory, and file systems",
	},
	{
		name: "Software Engineering",
		slug: "software-engineering",
		description: "Design patterns, testing, and methodologies",
	},
	{
		name: "Programming Languages",
		slug: "programming-languages",
		description: "Language concepts, paradigms, and syntax",
	},
	{
		name: "Mathematics",
		slug: "mathematics",
		description: "Discrete math, linear algebra, statistics for CS",
	},
	{
		name: "Machine Learning",
		slug: "machine-learning",
		description: "ML concepts, models, and techniques",
	},
	{
		name: "Cloud Computing",
		slug: "cloud-computing",
		description: "Cloud platforms, services, and architecture",
	},
	{
		name: "Mobile Development",
		slug: "mobile-development",
		description: "iOS, Android, and cross-platform development",
	},
	{ name: "DevOps", slug: "devops", description: "CI/CD, containers, and infrastructure" },
	{
		name: "Computer Architecture",
		slug: "computer-architecture",
		description: "CPU, memory, and hardware design",
	},
];

const SEED_UNITS = [
	{ code: "SIT102", name: "Introduction to Programming" },
	{ code: "SIT111", name: "Computer Systems" },
	{ code: "SIT192", name: "Discrete Mathematics" },
	{ code: "SIT202", name: "Computer Networks and Communication" },
	{ code: "SIT210", name: "Embedded Systems Development" },
	{ code: "SIT221", name: "Data Structures and Algorithms" },
	{ code: "SIT232", name: "Object-Oriented Development" },
	{ code: "SIT281", name: "Cryptography" },
	{ code: "SIT282", name: "Computer Forensics" },
	{ code: "SIT283", name: "Ethical Hacking" },
	{ code: "SIT284", name: "Cyber Security Management" },
	{ code: "SIT313", name: "Full Stack Web Development" },
	{ code: "SIT315", name: "Programming Paradigms" },
	{ code: "SIT323", name: "Cloud Native Application Development" },
	{ code: "SIT331", name: "IT Security" },
	{ code: "SIT374", name: "Team Project (A) - Project Management" },
	{ code: "SIT378", name: "Team Project (B) - Execution" },
	{ code: "SIT379", name: "Ethical Hacking" },
	{ code: "SIT384", name: "Cyber Security Analytics" },
	{ code: "SIT393", name: "Computing Internship" },
	{ code: "MIS771", name: "Business Intelligence and Data Warehousing" },
	{ code: "MIS772", name: "Predictive Analytics" },
	{ code: "MIS782", name: "Information Security Governance" },
	{ code: "MIS784", name: "Cyber Security Management and Practices" },
	{ code: "MIS785", name: "IT Strategy and Governance" },
	{ code: "MIS798", name: "Business Process Management" },
];

function seed(database: DatabaseSync) {
	const existing = database.prepare("SELECT COUNT(*) AS c FROM topics").get() as { c: number };
	if (existing.c > 0) return;

	const insertTopic = database.prepare(
		"INSERT INTO topics (id, name, slug, description) VALUES (?, ?, ?, ?)",
	);
	const insertUnit = database.prepare("INSERT INTO units (id, code, name) VALUES (?, ?, ?)");

	database.exec("BEGIN");
	try {
		for (const topic of SEED_TOPICS) {
			insertTopic.run(randomUUID(), topic.name, topic.slug, topic.description ?? null);
		}
		for (const unit of SEED_UNITS) {
			insertUnit.run(randomUUID(), unit.code, unit.name);
		}
		database.exec("COMMIT");
	} catch (err) {
		database.exec("ROLLBACK");
		throw err;
	}
}

export function getDb(): DatabaseSync {
	if (!db) {
		mkdirSync(dirname(DB_PATH), { recursive: true });
		db = new DatabaseSync(DB_PATH);
		createSchema(db);
		seed(db);
	}
	return db;
}
