import { getDb } from "./db";
import {
	createHash,
	randomBytes,
	randomInt,
	randomUUID,
	scryptSync,
	timingSafeEqual,
} from "node:crypto";
import { sendPasswordResetCode, sendVerificationCode } from "./email";

const DEAKIN_DOMAIN = "deakin.edu.au";
const CODE_TTL_MS = 10 * 60 * 1000;
const REQUEST_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

type Db = ReturnType<typeof getDb>;

function newId(): string {
	return randomUUID();
}

function generateToken(): string {
	const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	let result = "";
	for (let i = 0; i < 64; i++) {
		result += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return result;
}

function generateCode(): string {
	return String(randomInt(0, 1000000)).padStart(6, "0");
}

function hashCode(code: string): string {
	return createHash("sha256").update(code).digest("hex");
}

function hashPassword(password: string): string {
	const salt = randomBytes(16).toString("hex");
	const hash = scryptSync(password, salt, 64).toString("hex");
	return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
	const [salt, hash] = stored.split(":");
	if (!salt || !hash) return false;
	const candidate = scryptSync(password, salt, 64);
	const expected = Buffer.from(hash, "hex");
	if (candidate.length !== expected.length) return false;
	return timingSafeEqual(candidate, expected);
}

function validatePassword(password: string): string {
	if (!password || password.length < 8) {
		throw new Error("Password must be at least 8 characters");
	}
	return password;
}

function normalizeEmail(email: string): string {
	const normalized = email.trim().toLowerCase();
	const emailDomain = normalized.split("@")[1]?.toLowerCase();
	if (emailDomain !== DEAKIN_DOMAIN) {
		throw new Error(`Only @${DEAKIN_DOMAIN} email addresses are allowed`);
	}
	return normalized;
}

function requireAuth(db: Db, token: string): Record<string, any> {
	const user = db
		.prepare(
			"SELECT id AS _id, email, name, sessionToken, createdAt AS _creationTime FROM users WHERE sessionToken = ?",
		)
		.get(token) as Record<string, any> | undefined;
	if (!user) throw new Error("Not authenticated");
	return user;
}

function mapQuestion(row: Record<string, any>): Record<string, any> {
	return { ...row, solved: !!row.solved };
}

// ---- users ----

function issueSession(db: Db, user: { _id: string; name: string }) {
	const token = generateToken();
	db.prepare("UPDATE users SET sessionToken = ? WHERE id = ?").run(token, user._id);
	return { userId: user._id, token, name: user.name };
}

async function sendCode(db: Db, email: string, name: string, kind: "verification" | "reset") {
	const existing = db
		.prepare("SELECT email, createdAt FROM email_verifications WHERE email = ?")
		.get(email) as { email: string; createdAt: number } | undefined;

	if (existing && Date.now() - existing.createdAt < REQUEST_COOLDOWN_MS) {
		throw new Error("A code was just sent. Please wait a minute before trying again.");
	}

	const code = generateCode();
	const codeHash = hashCode(code);
	const now = Date.now();
	const expiresAt = now + CODE_TTL_MS;

	if (existing) {
		db.prepare(
			"UPDATE email_verifications SET name = ?, codeHash = ?, expiresAt = ?, attempts = 0, createdAt = ? WHERE email = ?",
		).run(name, codeHash, expiresAt, now, email);
	} else {
		db.prepare(
			"INSERT INTO email_verifications (email, name, codeHash, expiresAt, attempts, createdAt) VALUES (?, ?, ?, ?, 0, ?)",
		).run(email, name, codeHash, expiresAt, now);
	}

	try {
		if (kind === "reset") {
			await sendPasswordResetCode(email, code);
		} else {
			await sendVerificationCode(email, code);
		}
	} catch (err) {
		db.prepare("DELETE FROM email_verifications WHERE email = ?").run(email);
		throw err;
	}
	return { ok: true };
}

function verifyAndConsumeCode(db: Db, email: string, code: string): { name: string } {
	const pending = db
		.prepare(
			"SELECT name, codeHash, expiresAt, attempts FROM email_verifications WHERE email = ?",
		)
		.get(email) as
		| { name: string; codeHash: string; expiresAt: number; attempts: number }
		| undefined;

	if (!pending) throw new Error("No verification code requested for this email");
	if (Date.now() > pending.expiresAt) throw new Error("Verification code has expired");
	if (pending.attempts >= MAX_ATTEMPTS) throw new Error("Too many attempts. Request a new code.");

	if (hashCode(code) !== pending.codeHash) {
		db.prepare("UPDATE email_verifications SET attempts = attempts + 1 WHERE email = ?").run(
			email,
		);
		throw new Error("Invalid verification code");
	}

	db.prepare("DELETE FROM email_verifications WHERE email = ?").run(email);
	return { name: pending.name };
}

async function authRequestCode(db: Db, args: { email: string; name: string }) {
	const email = normalizeEmail(args.email);
	if (!args.name || !args.name.trim()) {
		throw new Error("Name is required");
	}
	return await sendCode(db, email, args.name.trim(), "verification");
}

function authSignup(db: Db, args: { email: string; code: string; password: string }) {
	const email = normalizeEmail(args.email);
	const password = validatePassword(args.password);
	const pending = verifyAndConsumeCode(db, email, args.code);

	const existing = db.prepare("SELECT id AS _id FROM users WHERE email = ?").get(email) as
		| { _id: string }
		| undefined;
	if (existing) throw new Error("An account already exists for this email. Sign in instead.");

	const id = newId();
	db.prepare(
		"INSERT INTO users (id, email, name, passwordHash, createdAt) VALUES (?, ?, ?, ?, ?)",
	).run(id, email, pending.name, hashPassword(password), Date.now());

	return issueSession(db, { _id: id, name: pending.name });
}

function authSignin(db: Db, args: { email: string; password: string }) {
	const email = normalizeEmail(args.email);
	const user = db
		.prepare("SELECT id AS _id, name, passwordHash FROM users WHERE email = ?")
		.get(email) as { _id: string; name: string; passwordHash: string | null } | undefined;

	if (!user || !user.passwordHash) throw new Error("No account found for this email");
	if (!verifyPassword(args.password, user.passwordHash)) throw new Error("Incorrect password");

	return issueSession(db, { _id: user._id, name: user.name });
}

async function authForgotPassword(db: Db, args: { email: string }) {
	const email = normalizeEmail(args.email);
	const user = db.prepare("SELECT id AS _id, name FROM users WHERE email = ?").get(email) as
		| { _id: string; name: string }
		| undefined;
	if (!user) throw new Error("No account found for this email");
	return await sendCode(db, email, user.name, "reset");
}

function authResetPassword(db: Db, args: { email: string; code: string; password: string }) {
	const email = normalizeEmail(args.email);
	const password = validatePassword(args.password);
	verifyAndConsumeCode(db, email, args.code);

	const user = db.prepare("SELECT id AS _id, name FROM users WHERE email = ?").get(email) as
		| { _id: string; name: string }
		| undefined;
	if (!user) throw new Error("No account found for this email");

	db.prepare("UPDATE users SET passwordHash = ? WHERE id = ?").run(
		hashPassword(password),
		user._id,
	);
	return issueSession(db, { _id: user._id, name: user.name });
}

function usersGetByToken(db: Db, args: { token: string }) {
	return (
		db
			.prepare(
				"SELECT id AS _id, email, name, sessionToken, createdAt AS _creationTime FROM users WHERE sessionToken = ?",
			)
			.get(args.token) ?? null
	);
}

// ---- topics ----

function topicsGetBySlug(db: Db, args: { slug: string }) {
	return (
		db
			.prepare("SELECT id AS _id, name, slug, description FROM topics WHERE slug = ?")
			.get(args.slug) ?? null
	);
}

function topicsGetAll(db: Db) {
	return db
		.prepare("SELECT id AS _id, name, slug, description FROM topics ORDER BY name ASC")
		.all();
}

// ---- units ----

function unitsGetByCode(db: Db, args: { code: string }) {
	return (
		db
			.prepare("SELECT id AS _id, code, name, description FROM units WHERE code = ?")
			.get(args.code.toUpperCase()) ?? null
	);
}

function unitsGetAll(db: Db) {
	return db
		.prepare("SELECT id AS _id, code, name, description FROM units ORDER BY code ASC")
		.all();
}

function unitsCreateCustom(db: Db, args: { code: string; name: string }) {
	const code = args.code.toUpperCase();
	const existing = db.prepare("SELECT id AS _id FROM units WHERE code = ?").get(code) as
		| { _id: string }
		| undefined;
	if (existing) return existing._id;

	const id = newId();
	db.prepare("INSERT INTO units (id, code, name) VALUES (?, ?, ?)").run(id, code, args.name);
	return id;
}

// ---- notes ----

const NOTE_COLUMNS =
	"id AS _id, title, content, topicId, unitId, authorId, authorName, createdAt, updatedAt, voteCount, commentCount";

function notesCreate(
	db: Db,
	args: { token: string; title: string; content: string; topicId: string; unitId: string },
) {
	const user = requireAuth(db, args.token);
	const id = newId();
	const now = Date.now();
	db.prepare(
		`INSERT INTO notes (id, title, content, topicId, unitId, authorId, authorName, createdAt, updatedAt, voteCount, commentCount)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)`,
	).run(id, args.title, args.content, args.topicId, args.unitId, user._id, user.name, now, now);
	return id;
}

function notesList(db: Db, args: { topicId?: string; unitId?: string; limit?: number }) {
	const limit = args.limit ?? 50;
	if (args.topicId) {
		return db
			.prepare(
				`SELECT ${NOTE_COLUMNS} FROM notes WHERE topicId = ? ORDER BY createdAt DESC LIMIT ?`,
			)
			.all(args.topicId, limit);
	}
	if (args.unitId) {
		return db
			.prepare(
				`SELECT ${NOTE_COLUMNS} FROM notes WHERE unitId = ? ORDER BY createdAt DESC LIMIT ?`,
			)
			.all(args.unitId, limit);
	}
	return db
		.prepare(`SELECT ${NOTE_COLUMNS} FROM notes ORDER BY createdAt DESC LIMIT ?`)
		.all(limit);
}

function notesSearch(db: Db, args: { query: string; limit?: number }) {
	const all = db
		.prepare(`SELECT ${NOTE_COLUMNS} FROM notes ORDER BY createdAt DESC LIMIT ?`)
		.all(args.limit ?? 200) as Record<string, any>[];
	const q = args.query.toLowerCase();
	return all.filter(
		(n) =>
			String(n.title).toLowerCase().includes(q) ||
			String(n.content).toLowerCase().includes(q),
	);
}

function notesGetById(db: Db, args: { id: string }) {
	return db.prepare(`SELECT ${NOTE_COLUMNS} FROM notes WHERE id = ?`).get(args.id) ?? null;
}

function notesRemove(db: Db, args: { token: string; id: string }) {
	const user = requireAuth(db, args.token);
	const note = db.prepare("SELECT id, authorId FROM notes WHERE id = ?").get(args.id) as
		| { id: string; authorId: string }
		| undefined;
	if (!note || note.authorId !== user._id) throw new Error("Not authorized");
	db.prepare("DELETE FROM notes WHERE id = ?").run(args.id);
}

// ---- questions ----

const QUESTION_COLUMNS =
	"id AS _id, title, content, topicId, unitId, authorId, authorName, createdAt, updatedAt, voteCount, answerCount, solved";

function questionsCreate(
	db: Db,
	args: { token: string; title: string; content: string; topicId: string; unitId: string },
) {
	const user = requireAuth(db, args.token);
	const id = newId();
	const now = Date.now();
	db.prepare(
		`INSERT INTO questions (id, title, content, topicId, unitId, authorId, authorName, createdAt, updatedAt, voteCount, answerCount, solved)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0)`,
	).run(id, args.title, args.content, args.topicId, args.unitId, user._id, user.name, now, now);
	return id;
}

function questionsList(db: Db, args: { topicId?: string; unitId?: string; limit?: number }) {
	const limit = args.limit ?? 50;
	const rows = (
		args.topicId
			? db
					.prepare(
						`SELECT ${QUESTION_COLUMNS} FROM questions WHERE topicId = ? ORDER BY createdAt DESC LIMIT ?`,
					)
					.all(args.topicId, limit)
			: args.unitId
				? db
						.prepare(
							`SELECT ${QUESTION_COLUMNS} FROM questions WHERE unitId = ? ORDER BY createdAt DESC LIMIT ?`,
						)
						.all(args.unitId, limit)
				: db
						.prepare(
							`SELECT ${QUESTION_COLUMNS} FROM questions ORDER BY createdAt DESC LIMIT ?`,
						)
						.all(limit)
	) as Record<string, any>[];
	return rows.map(mapQuestion);
}

function questionsGetById(db: Db, args: { id: string }) {
	const row = db
		.prepare(`SELECT ${QUESTION_COLUMNS} FROM questions WHERE id = ?`)
		.get(args.id) as Record<string, any> | undefined;
	return row ? mapQuestion(row) : null;
}

function questionsMarkSolved(db: Db, args: { token: string; id: string }) {
	const user = requireAuth(db, args.token);
	const question = db.prepare("SELECT id, authorId FROM questions WHERE id = ?").get(args.id) as
		| { id: string; authorId: string }
		| undefined;
	if (!question || question.authorId !== user._id) throw new Error("Not authorized");
	db.prepare("UPDATE questions SET solved = 1 WHERE id = ?").run(args.id);
}

function questionsRemove(db: Db, args: { token: string; id: string }) {
	const user = requireAuth(db, args.token);
	const question = db.prepare("SELECT id, authorId FROM questions WHERE id = ?").get(args.id) as
		| { id: string; authorId: string }
		| undefined;
	if (!question || question.authorId !== user._id) throw new Error("Not authorized");
	db.prepare("DELETE FROM questions WHERE id = ?").run(args.id);
}

// ---- comments ----

const COMMENT_COLUMNS =
	"id AS _id, content, authorId, authorName, parentId, questionId, parentCommentId, createdAt";

function commentsCreateOnNote(
	db: Db,
	args: { token: string; content: string; parentId: string; parentCommentId?: string },
) {
	const user = requireAuth(db, args.token);
	const id = newId();
	db.prepare(
		`INSERT INTO comments (id, content, authorId, authorName, parentId, parentCommentId, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
	).run(
		id,
		args.content,
		user._id,
		user.name,
		args.parentId,
		args.parentCommentId ?? null,
		Date.now(),
	);
	db.prepare("UPDATE notes SET commentCount = commentCount + 1 WHERE id = ?").run(args.parentId);
	return id;
}

function commentsCreateOnQuestion(
	db: Db,
	args: { token: string; content: string; questionId: string; parentCommentId?: string },
) {
	const user = requireAuth(db, args.token);
	const id = newId();
	db.prepare(
		`INSERT INTO comments (id, content, authorId, authorName, questionId, parentCommentId, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
	).run(
		id,
		args.content,
		user._id,
		user.name,
		args.questionId,
		args.parentCommentId ?? null,
		Date.now(),
	);
	db.prepare("UPDATE questions SET answerCount = answerCount + 1 WHERE id = ?").run(
		args.questionId,
	);
	return id;
}

function commentsListByNote(db: Db, args: { noteId: string }) {
	return db
		.prepare(
			`SELECT ${COMMENT_COLUMNS} FROM comments WHERE parentId = ? ORDER BY createdAt ASC`,
		)
		.all(args.noteId);
}

function commentsListByQuestion(db: Db, args: { questionId: string }) {
	return db
		.prepare(
			`SELECT ${COMMENT_COLUMNS} FROM comments WHERE questionId = ? ORDER BY createdAt ASC`,
		)
		.all(args.questionId);
}

function commentsRemove(db: Db, args: { token: string; id: string }) {
	const user = requireAuth(db, args.token);
	const comment = db.prepare("SELECT id, authorId FROM comments WHERE id = ?").get(args.id) as
		| { id: string; authorId: string }
		| undefined;
	if (!comment || comment.authorId !== user._id) throw new Error("Not authorized");
	db.prepare("DELETE FROM comments WHERE id = ?").run(args.id);
}

// ---- votes ----

function votesCast(
	db: Db,
	args: { token: string; targetType: "note" | "question"; targetId: string; value: 1 | -1 },
) {
	const user = requireAuth(db, args.token);
	const isNote = args.targetType === "note";
	const table = isNote ? "notes" : "questions";
	const doc = db.prepare(`SELECT id, voteCount FROM ${table} WHERE id = ?`).get(args.targetId) as
		| { id: string; voteCount: number }
		| undefined;
	if (!doc) throw new Error("Not found");

	const existing = db
		.prepare("SELECT id, value FROM votes WHERE userId = ? AND targetType = ? AND targetId = ?")
		.get(user._id, args.targetType, args.targetId) as { id: string; value: number } | undefined;

	let voteCount = doc.voteCount;
	let userVote: number = args.value;

	db.exec("BEGIN");
	try {
		if (existing) {
			if (existing.value === args.value) {
				db.prepare("DELETE FROM votes WHERE id = ?").run(existing.id);
				voteCount -= args.value;
				userVote = 0;
			} else {
				db.prepare("UPDATE votes SET value = ? WHERE id = ?").run(args.value, existing.id);
				voteCount = voteCount - existing.value + args.value;
			}
		} else {
			db.prepare(
				"INSERT INTO votes (id, userId, targetType, targetId, value) VALUES (?, ?, ?, ?, ?)",
			).run(newId(), user._id, args.targetType, args.targetId, args.value);
			voteCount += args.value;
		}

		db.prepare(`UPDATE ${table} SET voteCount = ? WHERE id = ?`).run(voteCount, args.targetId);
		db.exec("COMMIT");
	} catch (err) {
		db.exec("ROLLBACK");
		throw err;
	}

	return { voteCount, userVote };
}

// ---- details ----

function getNoteWithDetails(db: Db, args: { id: string }) {
	const note = db.prepare(`SELECT ${NOTE_COLUMNS} FROM notes WHERE id = ?`).get(args.id) as
		| Record<string, any>
		| undefined;
	if (!note) return null;

	const topic = db
		.prepare("SELECT id AS _id, name, slug, description FROM topics WHERE id = ?")
		.get(note.topicId);
	const unit = db
		.prepare("SELECT id AS _id, code, name, description FROM units WHERE id = ?")
		.get(note.unitId);
	const comments = commentsListByNote(db, { noteId: note._id });

	return { ...note, topic, unit, comments };
}

function getQuestionWithDetails(db: Db, args: { id: string }) {
	const question = db
		.prepare(`SELECT ${QUESTION_COLUMNS} FROM questions WHERE id = ?`)
		.get(args.id) as Record<string, any> | undefined;
	if (!question) return null;

	const topic = db
		.prepare("SELECT id AS _id, name, slug, description FROM topics WHERE id = ?")
		.get(question.topicId);
	const unit = db
		.prepare("SELECT id AS _id, code, name, description FROM units WHERE id = ?")
		.get(question.unitId);
	const answers = commentsListByQuestion(db, { questionId: question._id });

	return { ...mapQuestion(question), topic, unit, answers };
}

// ---- dispatcher ----

type Handler = (db: Db, args: any) => any;

const handlers: Record<string, Handler> = {
	"auth:requestCode": authRequestCode,
	"auth:signup": authSignup,
	"auth:signin": authSignin,
	"auth:forgotPassword": authForgotPassword,
	"auth:resetPassword": authResetPassword,
	"users:getByToken": usersGetByToken,
	"topics:getBySlug": topicsGetBySlug,
	"topics:getAll": topicsGetAll,
	"units:getByCode": unitsGetByCode,
	"units:getAll": unitsGetAll,
	"units:createCustom": unitsCreateCustom,
	"notes:create": notesCreate,
	"notes:list": notesList,
	"notes:search": notesSearch,
	"notes:getById": notesGetById,
	"notes:remove": notesRemove,
	"questions:create": questionsCreate,
	"questions:list": questionsList,
	"questions:getById": questionsGetById,
	"questions:markSolved": questionsMarkSolved,
	"questions:remove": questionsRemove,
	"comments:createOnNote": commentsCreateOnNote,
	"comments:createOnQuestion": commentsCreateOnQuestion,
	"comments:listByNote": commentsListByNote,
	"comments:listByQuestion": commentsListByQuestion,
	"comments:remove": commentsRemove,
	"votes:cast": votesCast,
	"details:getNoteWithDetails": getNoteWithDetails,
	"details:getQuestionWithDetails": getQuestionWithDetails,
};

export async function call(fn: string, args: Record<string, any> = {}): Promise<any> {
	const handler = handlers[fn];
	if (!handler) throw new Error(`Unknown function: ${fn}`);
	return await handler(getDb(), args ?? {});
}
