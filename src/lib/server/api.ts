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
			"SELECT id AS _id, email, name, avatarUrl, sessionToken, role, createdAt AS _creationTime FROM users WHERE sessionToken = ?",
		)
		.get(token) as Record<string, any> | undefined;
	if (!user) throw new Error("Not authenticated");
	return user;
}

function requireAdmin(db: Db, token: string): Record<string, any> {
	const user = requireAuth(db, token);
	if (user.role !== "admin") throw new Error("Not authorized");
	return user;
}

function mapQuestion(row: Record<string, any>): Record<string, any> {
	return { ...row, solved: !!row.solved };
}

function unitRecordMatchesQuery(unit: Record<string, any> | null | undefined, q: string) {
	if (!unit) return false;
	return (
		String(unit.code).toLowerCase().includes(q) ||
		String(unit.code2 ?? "")
			.toLowerCase()
			.includes(q) ||
		String(unit.name).toLowerCase().includes(q) ||
		String(unit.description ?? "")
			.toLowerCase()
			.includes(q)
	);
}

function addUnits(db: Db, rows: Record<string, any>[]): Record<string, any>[] {
	const units = new Map<string, Record<string, any>>();
	const getUnit = db.prepare(
		"SELECT id AS _id, code, code2, name, description FROM units WHERE id = ?",
	);

	return rows.map((row) => {
		if (!units.has(row.unitId)) {
			const unit = getUnit.get(row.unitId) as Record<string, any> | undefined;
			if (unit) units.set(row.unitId, unit);
		}
		return { ...row, unit: units.get(row.unitId) ?? null };
	});
}

// ---- users ----

function issueSession(db: Db, user: { _id: string; name: string; role?: string }) {
	const token = generateToken();
	db.prepare("UPDATE users SET sessionToken = ? WHERE id = ?").run(token, user._id);
	return { userId: user._id, token, name: user.name, role: user.role ?? "user" };
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
		"INSERT INTO users (id, email, name, passwordHash, role, createdAt) VALUES (?, ?, ?, ?, 'user', ?)",
	).run(id, email, pending.name, hashPassword(password), Date.now());

	return issueSession(db, { _id: id, name: pending.name, role: "user" });
}

function authSignin(db: Db, args: { email: string; password: string }) {
	const email = normalizeEmail(args.email);
	const user = db
		.prepare("SELECT id AS _id, name, role, passwordHash FROM users WHERE email = ?")
		.get(email) as
		| { _id: string; name: string; role: string; passwordHash: string | null }
		| undefined;

	if (!user) throw new Error("No account found for this email");
	if (!user.passwordHash) {
		throw new Error("This account has no password set. Use Forgot password to create one.");
	}
	if (!verifyPassword(args.password, user.passwordHash)) throw new Error("Incorrect password");

	return issueSession(db, { _id: user._id, name: user.name, role: user.role });
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

	const user = db
		.prepare("SELECT id AS _id, name, role FROM users WHERE email = ?")
		.get(email) as { _id: string; name: string; role: string } | undefined;
	if (!user) throw new Error("No account found for this email");

	db.prepare("UPDATE users SET passwordHash = ? WHERE id = ?").run(
		hashPassword(password),
		user._id,
	);
	return issueSession(db, { _id: user._id, name: user.name, role: user.role });
}

function usersGetByToken(db: Db, args: { token: string }) {
	return (
		db
			.prepare(
				"SELECT id AS _id, email, name, avatarUrl, sessionToken, role, createdAt AS _creationTime FROM users WHERE sessionToken = ?",
			)
			.get(args.token) ?? null
	);
}

function usersUpdateProfile(
	db: Db,
	args: { token: string; name: string; avatarUrl?: string | null },
) {
	const user = requireAuth(db, args.token);
	const name = (args.name ?? "").trim();
	if (name.length < 2 || name.length > 50) {
		throw new Error("Display name must be between 2 and 50 characters");
	}

	const avatarUrl = args.avatarUrl?.trim() || null;
	if (avatarUrl && !/^\/uploads\/[a-zA-Z0-9-]+\.(png|jpe?g|gif|webp)$/.test(avatarUrl)) {
		throw new Error("Invalid profile picture");
	}

	db.exec("BEGIN");
	try {
		db.prepare("UPDATE users SET name = ?, avatarUrl = ? WHERE id = ?").run(
			name,
			avatarUrl,
			user._id,
		);
		db.prepare("UPDATE notes SET authorName = ? WHERE authorId = ?").run(name, user._id);
		db.prepare("UPDATE questions SET authorName = ? WHERE authorId = ?").run(name, user._id);
		db.prepare("UPDATE comments SET authorName = ? WHERE authorId = ?").run(name, user._id);
		db.exec("COMMIT");
	} catch (err) {
		db.exec("ROLLBACK");
		throw err;
	}

	return usersGetByToken(db, { token: args.token });
}

function usersChangePassword(
	db: Db,
	args: { token: string; currentPassword: string; newPassword: string },
) {
	const user = requireAuth(db, args.token);
	const credentials = db.prepare("SELECT passwordHash FROM users WHERE id = ?").get(user._id) as
		| { passwordHash: string | null }
		| undefined;
	if (
		!credentials?.passwordHash ||
		!verifyPassword(args.currentPassword ?? "", credentials.passwordHash)
	) {
		throw new Error("Current password is incorrect");
	}

	const newPassword = validatePassword(args.newPassword);
	if (verifyPassword(newPassword, credentials.passwordHash)) {
		throw new Error("New password must be different from your current password");
	}
	db.prepare("UPDATE users SET passwordHash = ? WHERE id = ?").run(
		hashPassword(newPassword),
		user._id,
	);
	return { ok: true };
}

function usersGetPublicProfile(db: Db, args: { id: string }) {
	const profile = db
		.prepare(
			`SELECT
        u.id AS _id,
        u.name,
        u.avatarUrl,
        u.createdAt AS _creationTime,
        (SELECT COUNT(*) FROM notes n WHERE n.authorId = u.id) AS noteCount,
        (SELECT COUNT(*) FROM questions q WHERE q.authorId = u.id) AS questionCount,
        (SELECT COUNT(*) FROM comments c WHERE c.authorId = u.id) AS commentCount
      FROM users u
      WHERE u.id = ?`,
		)
		.get(args.id) as Record<string, any> | undefined;
	if (!profile) return null;

	const posts = db
		.prepare(
			`SELECT id AS _id, 'note' AS type, title, createdAt, voteCount
       FROM notes WHERE authorId = ?
       UNION ALL
       SELECT id AS _id, 'question' AS type, title, createdAt, voteCount
       FROM questions WHERE authorId = ?
       ORDER BY createdAt DESC
       LIMIT 50`,
		)
		.all(args.id, args.id);
	const comments = db
		.prepare(
			`SELECT
        c.id AS _id,
        c.content,
        c.createdAt,
        CASE WHEN c.parentId IS NOT NULL THEN 'note' ELSE 'question' END AS targetType,
        COALESCE(c.parentId, c.questionId) AS targetId,
        COALESCE(n.title, q.title) AS targetTitle
      FROM comments c
      LEFT JOIN notes n ON n.id = c.parentId
      LEFT JOIN questions q ON q.id = c.questionId
      WHERE c.authorId = ?
      ORDER BY c.createdAt DESC
      LIMIT 50`,
		)
		.all(args.id);

	return {
		...profile,
		totalContributions: profile.noteCount + profile.questionCount + profile.commentCount,
		posts,
		comments,
	};
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
	const code = args.code.toUpperCase();
	return (
		db
			.prepare(
				"SELECT id AS _id, code, code2, name, description FROM units WHERE code = ? OR code2 = ?",
			)
			.get(code, code) ?? null
	);
}

function unitsGetAll(db: Db) {
	return db
		.prepare("SELECT id AS _id, code, code2, name, description FROM units ORDER BY code ASC")
		.all();
}

function unitsCreateCustom(db: Db, args: { code: string; name: string }) {
	const code = args.code.toUpperCase();
	const existing = db
		.prepare("SELECT id AS _id FROM units WHERE code = ? OR code2 = ?")
		.get(code, code) as { _id: string } | undefined;
	if (existing) return existing._id;

	const id = newId();
	db.prepare("INSERT INTO units (id, code, name) VALUES (?, ?, ?)").run(id, code, args.name);
	return id;
}

// ---- pinned units ----

const MAX_PINNED_UNITS = 10;

function getPinnedUnitIds(db: Db, userId: string): string[] {
	return (
		db
			.prepare("SELECT unitId FROM pinned_units WHERE userId = ? ORDER BY createdAt ASC")
			.all(userId) as { unitId: string }[]
	).map((row) => row.unitId);
}

function unitsGetPinned(db: Db, args: { token: string }) {
	const user = requireAuth(db, args.token);
	return getPinnedUnitIds(db, user._id);
}

function unitsPin(db: Db, args: { token: string; unitId: string }) {
	const user = requireAuth(db, args.token);
	const unit = db.prepare("SELECT id AS _id FROM units WHERE id = ?").get(args.unitId);
	if (!unit) throw new Error("Unit not found");

	const existing = db
		.prepare("SELECT 1 AS found FROM pinned_units WHERE userId = ? AND unitId = ?")
		.get(user._id, args.unitId);
	if (!existing) {
		const count = db
			.prepare("SELECT COUNT(*) AS c FROM pinned_units WHERE userId = ?")
			.get(user._id) as { c: number };
		if (count.c >= MAX_PINNED_UNITS) {
			throw new Error(`You can pin up to ${MAX_PINNED_UNITS} units`);
		}
		db.prepare("INSERT INTO pinned_units (userId, unitId, createdAt) VALUES (?, ?, ?)").run(
			user._id,
			args.unitId,
			Date.now(),
		);
	}
	return getPinnedUnitIds(db, user._id);
}

function unitsUnpin(db: Db, args: { token: string; unitId: string }) {
	const user = requireAuth(db, args.token);
	db.prepare("DELETE FROM pinned_units WHERE userId = ? AND unitId = ?").run(
		user._id,
		args.unitId,
	);
	return getPinnedUnitIds(db, user._id);
}

// ---- notes ----

const NOTE_COLUMNS =
	"id AS _id, title, content, topicId, unitId, authorId, authorName, createdAt, updatedAt, voteCount, commentCount";

function notesCreate(
	db: Db,
	args: { token: string; title: string; content: string; topicId?: string; unitId?: string },
) {
	const user = requireAuth(db, args.token);
	const topicId = args.topicId?.trim() ?? "";
	const unitId = args.unitId?.trim() ?? "";
	if (!topicId && !unitId) throw new Error("Select a topic or a unit");
	const id = newId();
	const now = Date.now();
	db.exec("BEGIN");
	try {
		db.prepare(
			`INSERT INTO notes (id, title, content, topicId, unitId, authorId, authorName, createdAt, updatedAt, voteCount, commentCount)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0)`,
		).run(id, args.title, args.content, topicId, unitId, user._id, user.name, now, now);
		db.prepare(
			"INSERT INTO votes (id, userId, targetType, targetId, value) VALUES (?, ?, 'note', ?, 1)",
		).run(newId(), user._id, id);
		db.exec("COMMIT");
	} catch (err) {
		db.exec("ROLLBACK");
		throw err;
	}
	return id;
}

function notesList(db: Db, args: { topicId?: string; unitId?: string; limit?: number }) {
	const limit = args.limit ?? 50;
	if (args.topicId) {
		return addUnits(
			db,
			db
				.prepare(
					`SELECT ${NOTE_COLUMNS} FROM notes WHERE topicId = ? ORDER BY createdAt DESC LIMIT ?`,
				)
				.all(args.topicId, limit) as Record<string, any>[],
		);
	}
	if (args.unitId) {
		return addUnits(
			db,
			db
				.prepare(
					`SELECT ${NOTE_COLUMNS} FROM notes WHERE unitId = ? ORDER BY createdAt DESC LIMIT ?`,
				)
				.all(args.unitId, limit) as Record<string, any>[],
		);
	}
	return addUnits(
		db,
		db
			.prepare(`SELECT ${NOTE_COLUMNS} FROM notes ORDER BY createdAt DESC LIMIT ?`)
			.all(limit) as Record<string, any>[],
	);
}

function notesSearch(db: Db, args: { query: string; limit?: number }) {
	const all = db
		.prepare(`SELECT ${NOTE_COLUMNS} FROM notes ORDER BY createdAt DESC LIMIT ?`)
		.all(args.limit ?? 200) as Record<string, any>[];
	const q = args.query.toLowerCase();
	return addUnits(db, all).filter(
		(n) =>
			String(n.title).toLowerCase().includes(q) ||
			String(n.content).toLowerCase().includes(q) ||
			unitRecordMatchesQuery(n.unit, q),
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

function notesUpdate(db: Db, args: { token: string; id: string; title: string; content: string }) {
	const user = requireAuth(db, args.token);
	const note = db.prepare("SELECT id, authorId FROM notes WHERE id = ?").get(args.id) as
		| { id: string; authorId: string }
		| undefined;
	if (!note || note.authorId !== user._id) throw new Error("Not authorized");

	const title = (args.title ?? "").trim();
	const content = (args.content ?? "").trim();
	if (!title || !content) throw new Error("Title and content are required");

	const updatedAt = Date.now();
	db.prepare("UPDATE notes SET title = ?, content = ?, updatedAt = ? WHERE id = ?").run(
		title,
		content,
		updatedAt,
		args.id,
	);
	return { updatedAt };
}

// ---- questions ----

const QUESTION_COLUMNS =
	"id AS _id, title, content, topicId, unitId, authorId, authorName, createdAt, updatedAt, voteCount, answerCount, solved";

function questionsCreate(
	db: Db,
	args: { token: string; title: string; content: string; topicId?: string; unitId?: string },
) {
	const user = requireAuth(db, args.token);
	const topicId = args.topicId?.trim() ?? "";
	const unitId = args.unitId?.trim() ?? "";
	if (!topicId && !unitId) throw new Error("Select a topic or a unit");
	const id = newId();
	const now = Date.now();
	db.exec("BEGIN");
	try {
		db.prepare(
			`INSERT INTO questions (id, title, content, topicId, unitId, authorId, authorName, createdAt, updatedAt, voteCount, answerCount, solved)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, 0)`,
		).run(id, args.title, args.content, topicId, unitId, user._id, user.name, now, now);
		db.prepare(
			"INSERT INTO votes (id, userId, targetType, targetId, value) VALUES (?, ?, 'question', ?, 1)",
		).run(newId(), user._id, id);
		db.exec("COMMIT");
	} catch (err) {
		db.exec("ROLLBACK");
		throw err;
	}
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
	return addUnits(db, rows.map(mapQuestion));
}

function questionsGetById(db: Db, args: { id: string }) {
	const row = db
		.prepare(`SELECT ${QUESTION_COLUMNS} FROM questions WHERE id = ?`)
		.get(args.id) as Record<string, any> | undefined;
	return row ? mapQuestion(row) : null;
}

function questionsSearch(db: Db, args: { query: string; limit?: number }) {
	const all = db
		.prepare(`SELECT ${QUESTION_COLUMNS} FROM questions ORDER BY createdAt DESC LIMIT ?`)
		.all(args.limit ?? 200) as Record<string, any>[];
	const q = args.query.toLowerCase();
	return addUnits(db, all.map(mapQuestion)).filter(
		(qr) =>
			String(qr.title).toLowerCase().includes(q) ||
			String(qr.content).toLowerCase().includes(q) ||
			unitRecordMatchesQuery(qr.unit, q),
	);
}

function unitsSearch(db: Db, args: { query: string; limit?: number }) {
	const q = args.query.toLowerCase();
	const all = unitsGetAll(db) as Record<string, any>[];
	return all.filter((unit) => unitRecordMatchesQuery(unit, q)).slice(0, args.limit ?? 200);
}

function searchAll(db: Db, args: { query: string; limit?: number }) {
	const limit = args.limit ?? 200;
	const units = unitsSearch(db, { query: args.query, limit }) as Record<string, any>[];
	const notes = notesSearch(db, { query: args.query, limit }) as Record<string, any>[];
	const questions = questionsSearch(db, { query: args.query, limit }) as Record<string, any>[];
	const posts: Record<string, any>[] = [
		...notes.map((n) => ({ ...n, type: "note" })),
		...questions.map((q) => ({ ...q, type: "question" })),
	];
	posts.sort((a, b) => b.createdAt - a.createdAt);
	return [...units.map((unit) => ({ ...unit, type: "unit" })), ...posts];
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

function questionsUpdate(
	db: Db,
	args: { token: string; id: string; title: string; content: string },
) {
	const user = requireAuth(db, args.token);
	const question = db.prepare("SELECT id, authorId FROM questions WHERE id = ?").get(args.id) as
		| { id: string; authorId: string }
		| undefined;
	if (!question || question.authorId !== user._id) throw new Error("Not authorized");

	const title = (args.title ?? "").trim();
	const content = (args.content ?? "").trim();
	if (!title || !content) throw new Error("Title and content are required");

	const updatedAt = Date.now();
	db.prepare("UPDATE questions SET title = ?, content = ?, updatedAt = ? WHERE id = ?").run(
		title,
		content,
		updatedAt,
		args.id,
	);
	return { updatedAt };
}

// ---- comments ----

const COMMENT_COLUMNS =
	"c.id AS _id, c.content, c.authorId, COALESCE(u.name, c.authorName) AS authorName, u.avatarUrl, c.parentId, c.questionId, c.parentCommentId, c.createdAt, c.updatedAt";

function commentsCreateOnNote(
	db: Db,
	args: { token: string; content: string; parentId: string; parentCommentId?: string },
) {
	const user = requireAuth(db, args.token);
	const id = newId();
	const now = Date.now();
	db.prepare(
		`INSERT INTO comments (id, content, authorId, authorName, parentId, parentCommentId, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
	).run(
		id,
		args.content,
		user._id,
		user.name,
		args.parentId,
		args.parentCommentId ?? null,
		now,
		now,
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
	const now = Date.now();
	db.prepare(
		`INSERT INTO comments (id, content, authorId, authorName, questionId, parentCommentId, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
	).run(
		id,
		args.content,
		user._id,
		user.name,
		args.questionId,
		args.parentCommentId ?? null,
		now,
		now,
	);
	db.prepare("UPDATE questions SET answerCount = answerCount + 1 WHERE id = ?").run(
		args.questionId,
	);
	return id;
}

function commentsListByNote(db: Db, args: { noteId: string }) {
	return db
		.prepare(
			`SELECT ${COMMENT_COLUMNS} FROM comments c LEFT JOIN users u ON u.id = c.authorId WHERE c.parentId = ? ORDER BY c.createdAt ASC`,
		)
		.all(args.noteId);
}

function commentsListByQuestion(db: Db, args: { questionId: string }) {
	return db
		.prepare(
			`SELECT ${COMMENT_COLUMNS} FROM comments c LEFT JOIN users u ON u.id = c.authorId WHERE c.questionId = ? ORDER BY c.createdAt ASC`,
		)
		.all(args.questionId);
}

function commentsRemove(db: Db, args: { token: string; id: string }) {
	const user = requireAuth(db, args.token);
	const comment = db.prepare("SELECT id, authorId FROM comments WHERE id = ?").get(args.id) as
		| { id: string; authorId: string }
		| undefined;
	if (!comment || comment.authorId !== user._id) throw new Error("Not authorized");

	const ids = [args.id];
	const stack = [args.id];
	while (stack.length > 0) {
		const current = stack.pop()!;
		const children = db
			.prepare("SELECT id FROM comments WHERE parentCommentId = ?")
			.all(current) as { id: string }[];
		for (const child of children) {
			ids.push(child.id);
			stack.push(child.id);
		}
	}

	db.exec("BEGIN");
	try {
		for (const id of ids) {
			db.prepare("DELETE FROM comments WHERE id = ?").run(id);
		}
		db.exec("COMMIT");
	} catch (err) {
		db.exec("ROLLBACK");
		throw err;
	}
}

function commentsUpdate(db: Db, args: { token: string; id: string; content: string }) {
	const user = requireAuth(db, args.token);
	const comment = db.prepare("SELECT id, authorId FROM comments WHERE id = ?").get(args.id) as
		| { id: string; authorId: string }
		| undefined;
	if (!comment || comment.authorId !== user._id) throw new Error("Not authorized");

	const content = (args.content ?? "").trim();
	if (!content) throw new Error("Comment cannot be empty");

	const updatedAt = Date.now();
	db.prepare("UPDATE comments SET content = ?, updatedAt = ? WHERE id = ?").run(
		content,
		updatedAt,
		args.id,
	);
	return { updatedAt };
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

function votesGetMyVote(
	db: Db,
	args: { token: string; targetType: "note" | "question"; targetId: string },
) {
	const user = requireAuth(db, args.token);
	const row = db
		.prepare("SELECT value FROM votes WHERE userId = ? AND targetType = ? AND targetId = ?")
		.get(user._id, args.targetType, args.targetId) as { value: number } | undefined;
	return row?.value ?? 0;
}

// ---- details ----

const MAX_POST_TITLES = 50;

function postsGetTitles(db: Db, args: { ids?: string[] }) {
	const ids = [
		...new Set(
			(Array.isArray(args.ids) ? args.ids : [])
				.filter((id): id is string => typeof id === "string")
				.map((id) => id.trim())
				.filter(Boolean),
		),
	].slice(0, MAX_POST_TITLES);

	if (ids.length === 0) return {};

	const placeholders = ids.map(() => "?").join(",");
	const titles: Record<string, string> = {};

	for (const row of db
		.prepare(`SELECT id, title FROM notes WHERE id IN (${placeholders})`)
		.all(...ids) as { id: string; title: string }[]) {
		titles[row.id] = row.title;
	}

	for (const row of db
		.prepare(`SELECT id, title FROM questions WHERE id IN (${placeholders})`)
		.all(...ids) as { id: string; title: string }[]) {
		if (titles[row.id] === undefined) titles[row.id] = row.title;
	}

	return titles;
}

function getNoteWithDetails(db: Db, args: { id: string }) {
	const note = db.prepare(`SELECT ${NOTE_COLUMNS} FROM notes WHERE id = ?`).get(args.id) as
		| Record<string, any>
		| undefined;
	if (!note) return null;

	const topic = db
		.prepare("SELECT id AS _id, name, slug, description FROM topics WHERE id = ?")
		.get(note.topicId);
	const unit = db
		.prepare("SELECT id AS _id, code, code2, name, description FROM units WHERE id = ?")
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
		.prepare("SELECT id AS _id, code, code2, name, description FROM units WHERE id = ?")
		.get(question.unitId);
	const answers = commentsListByQuestion(db, { questionId: question._id });

	return { ...mapQuestion(question), topic, unit, answers };
}

// ---- admin ----

function adminGetState(db: Db, args: { token?: string }) {
	const admin = db.prepare("SELECT id AS _id FROM users WHERE role = 'admin' LIMIT 1").get();
	let currentUser: Record<string, any> | null = null;
	let isAdmin = false;

	if (args.token) {
		const user = db
			.prepare(
				"SELECT id AS _id, email, name, avatarUrl, sessionToken, role, createdAt AS _creationTime FROM users WHERE sessionToken = ?",
			)
			.get(args.token) as Record<string, any> | undefined;
		if (user) {
			currentUser = user;
			isAdmin = user.role === "admin";
		}
	}

	return { hasAdmin: !!admin, currentUser, isAdmin };
}

function ensureNoAdmin(db: Db) {
	const admin = db.prepare("SELECT id AS _id FROM users WHERE role = 'admin' LIMIT 1").get();
	if (admin) throw new Error("An admin already exists");
}

async function adminRequestCode(db: Db, args: { email: string; name?: string }) {
	ensureNoAdmin(db);
	const email = normalizeEmail(args.email);
	const existing = db.prepare("SELECT name FROM users WHERE email = ?").get(email) as
		| { name: string }
		| undefined;
	const name = (existing?.name ?? args.name ?? "").trim();
	if (!name) throw new Error("Name is required");
	return await sendCode(db, email, name, "verification");
}

function adminCompleteSetup(db: Db, args: { email: string; code: string }) {
	ensureNoAdmin(db);
	const email = normalizeEmail(args.email);
	const pending = verifyAndConsumeCode(db, email, args.code);

	const existing = db.prepare("SELECT id AS _id, name FROM users WHERE email = ?").get(email) as
		| { _id: string; name: string }
		| undefined;

	if (existing) {
		db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(existing._id);
		return issueSession(db, { _id: existing._id, name: existing.name, role: "admin" });
	}

	const id = newId();
	db.prepare(
		"INSERT INTO users (id, email, name, role, createdAt) VALUES (?, ?, ?, 'admin', ?)",
	).run(id, email, pending.name, Date.now());
	return issueSession(db, { _id: id, name: pending.name, role: "admin" });
}

function adminUnitsSave(
	db: Db,
	args: {
		token: string;
		id?: string;
		code: string;
		code2?: string;
		name: string;
		description?: string;
	},
) {
	requireAdmin(db, args.token);
	const code = (args.code ?? "").trim().toUpperCase();
	const name = (args.name ?? "").trim();
	if (!code || !name) throw new Error("Code and name are required");

	const code2 = (args.code2 ?? "").trim().toUpperCase() || null;
	if (code2 && code2 === code)
		throw new Error("The second code must differ from the primary code");

	const duplicate = db
		.prepare("SELECT id AS _id FROM units WHERE (code = ? OR code2 = ?) AND id != ?")
		.get(code, code, args.id ?? "") as { _id: string } | undefined;
	if (duplicate) throw new Error("A unit with this code already exists");

	if (code2) {
		const duplicate2 = db
			.prepare("SELECT id AS _id FROM units WHERE (code = ? OR code2 = ?) AND id != ?")
			.get(code2, code2, args.id ?? "") as { _id: string } | undefined;
		if (duplicate2) throw new Error("A unit with this second code already exists");
	}

	const description = args.description?.trim() || null;
	if (args.id) {
		const existing = db.prepare("SELECT id AS _id FROM units WHERE id = ?").get(args.id);
		if (!existing) throw new Error("Unit not found");
		db.prepare(
			"UPDATE units SET code = ?, code2 = ?, name = ?, description = ? WHERE id = ?",
		).run(code, code2, name, description, args.id);
		return args.id;
	}

	const id = newId();
	db.prepare("INSERT INTO units (id, code, code2, name, description) VALUES (?, ?, ?, ?, ?)").run(
		id,
		code,
		code2,
		name,
		description,
	);
	return id;
}

function adminUnitsDelete(db: Db, args: { token: string; id: string }) {
	requireAdmin(db, args.token);
	const refs = db
		.prepare(
			"SELECT (SELECT COUNT(*) FROM notes WHERE unitId = ?) + (SELECT COUNT(*) FROM questions WHERE unitId = ?) AS c",
		)
		.get(args.id, args.id) as { c: number };
	if (refs.c > 0) throw new Error("Cannot delete a unit that has notes or questions");
	db.prepare("DELETE FROM units WHERE id = ?").run(args.id);
}

function adminUsersList(db: Db, args: { token: string }) {
	requireAdmin(db, args.token);
	return db
		.prepare(
			`SELECT
        u.id AS _id,
        u.email,
        u.name,
        u.role,
        u.createdAt AS _creationTime,
        (SELECT COUNT(*) FROM notes n WHERE n.authorId = u.id) AS noteCount,
        (SELECT COUNT(*) FROM questions q WHERE q.authorId = u.id) AS questionCount
      FROM users u
      ORDER BY u.createdAt ASC`,
		)
		.all();
}

function adminUsersUpdate(
	db: Db,
	args: { token: string; id: string; email: string; name: string; role: string },
) {
	requireAdmin(db, args.token);
	const user = db.prepare("SELECT id AS _id, role FROM users WHERE id = ?").get(args.id) as
		| { _id: string; role: string }
		| undefined;
	if (!user) throw new Error("User not found");

	const email = normalizeEmail(args.email);
	const name = (args.name ?? "").trim();
	if (!name) throw new Error("Name is required");

	const duplicate = db
		.prepare("SELECT id AS _id FROM users WHERE email = ? AND id != ?")
		.get(email, args.id) as { _id: string } | undefined;
	if (duplicate) throw new Error("Email is already in use");

	const role = args.role === "admin" ? "admin" : "user";
	if (user.role === "admin" && role !== "admin") {
		const adminCount = db
			.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'admin'")
			.get() as { c: number };
		if (adminCount.c <= 1) throw new Error("Cannot demote the last admin");
	}

	db.prepare("UPDATE users SET email = ?, name = ?, role = ? WHERE id = ?").run(
		email,
		name,
		role,
		args.id,
	);
}

function adminUsersDelete(db: Db, args: { token: string; id: string }) {
	const admin = requireAdmin(db, args.token);
	const user = db
		.prepare("SELECT id AS _id, role, email FROM users WHERE id = ?")
		.get(args.id) as { _id: string; role: string; email: string } | undefined;
	if (!user) throw new Error("User not found");

	if (user._id === admin._id) throw new Error("You cannot delete your own account");
	if (user.role === "admin") {
		const adminCount = db
			.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'admin'")
			.get() as { c: number };
		if (adminCount.c <= 1) throw new Error("Cannot delete the last admin");
	}

	const noteIds = (
		db.prepare("SELECT id FROM notes WHERE authorId = ?").all(args.id) as { id: string }[]
	).map((r) => r.id);
	const questionIds = (
		db.prepare("SELECT id FROM questions WHERE authorId = ?").all(args.id) as {
			id: string;
		}[]
	).map((r) => r.id);

	db.exec("BEGIN");
	try {
		db.prepare("DELETE FROM votes WHERE userId = ?").run(args.id);
		db.prepare("DELETE FROM pinned_units WHERE userId = ?").run(args.id);
		for (const id of noteIds) {
			db.prepare("DELETE FROM votes WHERE targetType = 'note' AND targetId = ?").run(id);
			db.prepare("DELETE FROM comments WHERE parentId = ?").run(id);
		}
		for (const id of questionIds) {
			db.prepare("DELETE FROM votes WHERE targetType = 'question' AND targetId = ?").run(id);
			db.prepare("DELETE FROM comments WHERE questionId = ?").run(id);
		}
		db.prepare("DELETE FROM comments WHERE authorId = ?").run(args.id);
		db.prepare("DELETE FROM notes WHERE authorId = ?").run(args.id);
		db.prepare("DELETE FROM questions WHERE authorId = ?").run(args.id);
		db.prepare("DELETE FROM email_verifications WHERE email = ?").run(user.email);
		db.prepare("DELETE FROM users WHERE id = ?").run(args.id);
		db.exec("COMMIT");
	} catch (err) {
		db.exec("ROLLBACK");
		throw err;
	}
}

function adminNotesList(db: Db, args: { token: string }) {
	requireAdmin(db, args.token);
	return db
		.prepare(
			`SELECT
        n.id AS _id,
        n.title,
        n.content,
        n.topicId,
        n.unitId,
        n.authorId,
        n.authorName,
        n.createdAt,
        n.updatedAt,
        n.voteCount,
        n.commentCount,
        u.code AS unitCode,
        u.code2 AS unitCode2
      FROM notes n
      LEFT JOIN units u ON u.id = n.unitId
      ORDER BY n.createdAt DESC`,
		)
		.all();
}

function adminNotesUpdate(
	db: Db,
	args: { token: string; id: string; title: string; content: string },
) {
	requireAdmin(db, args.token);
	const title = (args.title ?? "").trim();
	const content = (args.content ?? "").trim();
	if (!title || !content) throw new Error("Title and content are required");
	db.prepare("UPDATE notes SET title = ?, content = ?, updatedAt = ? WHERE id = ?").run(
		title,
		content,
		Date.now(),
		args.id,
	);
}

function adminNotesDelete(db: Db, args: { token: string; id: string }) {
	requireAdmin(db, args.token);
	db.prepare("DELETE FROM comments WHERE parentId = ?").run(args.id);
	db.prepare("DELETE FROM votes WHERE targetType = 'note' AND targetId = ?").run(args.id);
	db.prepare("DELETE FROM notes WHERE id = ?").run(args.id);
}

function startOfUtcWeek(ts: number): number {
	const date = new Date(ts);
	const day = date.getUTCDay();
	const diffToMonday = (day + 6) % 7;
	date.setUTCHours(0, 0, 0, 0);
	date.setUTCDate(date.getUTCDate() - diffToMonday);
	return date.getTime();
}

function adminStats(db: Db, args: { token: string; weeks?: number }) {
	requireAdmin(db, args.token);
	const weekCount = Math.max(1, Math.min(52, args.weeks ?? 8));
	const weekMs = 7 * 24 * 60 * 60 * 1000;
	const now = Date.now();
	const currentWeekStart = startOfUtcWeek(now);
	const firstWeekStart = currentWeekStart - (weekCount - 1) * weekMs;

	const notes = db
		.prepare("SELECT createdAt FROM notes WHERE createdAt >= ?")
		.all(firstWeekStart) as { createdAt: number }[];
	const questions = db
		.prepare("SELECT createdAt FROM questions WHERE createdAt >= ?")
		.all(firstWeekStart) as { createdAt: number }[];

	const buckets = new Map<number, { notes: number; questions: number }>();
	for (let i = 0; i < weekCount; i++) {
		buckets.set(firstWeekStart + i * weekMs, { notes: 0, questions: 0 });
	}

	for (const row of notes) {
		const start = startOfUtcWeek(row.createdAt);
		const bucket = buckets.get(start);
		if (bucket) bucket.notes++;
	}
	for (const row of questions) {
		const start = startOfUtcWeek(row.createdAt);
		const bucket = buckets.get(start);
		if (bucket) bucket.questions++;
	}

	const weeks = [...buckets.entries()]
		.sort((a, b) => a[0] - b[0])
		.map(([weekStart, counts]) => ({ weekStart, ...counts }));

	const totals = {
		notes: (db.prepare("SELECT COUNT(*) AS c FROM notes").get() as { c: number }).c,
		questions: (db.prepare("SELECT COUNT(*) AS c FROM questions").get() as { c: number }).c,
		users: (db.prepare("SELECT COUNT(*) AS c FROM users").get() as { c: number }).c,
		units: (db.prepare("SELECT COUNT(*) AS c FROM units").get() as { c: number }).c,
	};

	return { weeks, totals };
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
	"users:updateProfile": usersUpdateProfile,
	"users:changePassword": usersChangePassword,
	"users:getPublicProfile": usersGetPublicProfile,
	"topics:getBySlug": topicsGetBySlug,
	"topics:getAll": topicsGetAll,
	"units:getByCode": unitsGetByCode,
	"units:getAll": unitsGetAll,
	"units:search": unitsSearch,
	"units:createCustom": unitsCreateCustom,
	"units:getPinned": unitsGetPinned,
	"units:pin": unitsPin,
	"units:unpin": unitsUnpin,
	"notes:create": notesCreate,
	"notes:list": notesList,
	"notes:search": notesSearch,
	"search:all": searchAll,
	"notes:getById": notesGetById,
	"notes:remove": notesRemove,
	"notes:update": notesUpdate,
	"questions:create": questionsCreate,
	"questions:list": questionsList,
	"questions:search": questionsSearch,
	"questions:getById": questionsGetById,
	"questions:markSolved": questionsMarkSolved,
	"questions:remove": questionsRemove,
	"questions:update": questionsUpdate,
	"comments:createOnNote": commentsCreateOnNote,
	"comments:createOnQuestion": commentsCreateOnQuestion,
	"comments:listByNote": commentsListByNote,
	"comments:listByQuestion": commentsListByQuestion,
	"comments:remove": commentsRemove,
	"comments:update": commentsUpdate,
	"votes:cast": votesCast,
	"votes:getMyVote": votesGetMyVote,
	"posts:getTitles": postsGetTitles,
	"details:getNoteWithDetails": getNoteWithDetails,
	"details:getQuestionWithDetails": getQuestionWithDetails,
	"admin:getState": adminGetState,
	"admin:requestCode": adminRequestCode,
	"admin:completeSetup": adminCompleteSetup,
	"admin:unitsSave": adminUnitsSave,
	"admin:unitsDelete": adminUnitsDelete,
	"admin:usersList": adminUsersList,
	"admin:usersUpdate": adminUsersUpdate,
	"admin:usersDelete": adminUsersDelete,
	"admin:notesList": adminNotesList,
	"admin:notesUpdate": adminNotesUpdate,
	"admin:notesDelete": adminNotesDelete,
	"admin:stats": adminStats,
};

export async function call(fn: string, args: Record<string, any> = {}): Promise<any> {
	const handler = handlers[fn];
	if (!handler) throw new Error(`Unknown function: ${fn}`);
	return await handler(getDb(), args ?? {});
}

export function getUserByToken(token: string): Record<string, any> | null {
	if (!token) return null;
	return usersGetByToken(getDb(), { token });
}
