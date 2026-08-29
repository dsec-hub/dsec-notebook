import { getDb } from './db';
import { randomUUID } from 'node:crypto';

const DEAKIN_DOMAIN = 'deakin.edu.au';

type Db = ReturnType<typeof getDb>;

function newId(): string {
  return randomUUID();
}

function generateToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 64; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function requireAuth(db: Db, token: string): Record<string, any> {
  const user = db
    .prepare('SELECT id AS _id, email, name, sessionToken, createdAt AS _creationTime FROM users WHERE sessionToken = ?')
    .get(token) as Record<string, any> | undefined;
  if (!user) throw new Error('Not authenticated');
  return user;
}

function mapQuestion(row: Record<string, any>): Record<string, any> {
  return { ...row, solved: !!row.solved };
}

// ---- users ----

function usersRegister(db: Db, args: { email: string; name: string }) {
  const email = args.email.toLowerCase();
  const emailDomain = email.split('@')[1]?.toLowerCase();
  if (emailDomain !== DEAKIN_DOMAIN) {
    throw new Error(`Only @${DEAKIN_DOMAIN} email addresses are allowed`);
  }

  const existing = db
    .prepare('SELECT id AS _id, email, name, sessionToken, createdAt AS _creationTime FROM users WHERE email = ?')
    .get(email) as Record<string, any> | undefined;

  const token = generateToken();

  if (existing) {
    db.prepare('UPDATE users SET sessionToken = ? WHERE id = ?').run(token, existing._id);
    return { userId: existing._id, token, name: existing.name };
  }

  const id = newId();
  db.prepare('INSERT INTO users (id, email, name, sessionToken, createdAt) VALUES (?, ?, ?, ?, ?)').run(
    id,
    email,
    args.name,
    token,
    Date.now()
  );
  return { userId: id, token, name: args.name };
}

function usersGetByToken(db: Db, args: { token: string }) {
  return (
    db
      .prepare('SELECT id AS _id, email, name, sessionToken, createdAt AS _creationTime FROM users WHERE sessionToken = ?')
      .get(args.token) ?? null
  );
}

// ---- topics ----

function topicsGetBySlug(db: Db, args: { slug: string }) {
  return db
    .prepare('SELECT id AS _id, name, slug, description FROM topics WHERE slug = ?')
    .get(args.slug) ?? null;
}

function topicsGetAll(db: Db) {
  return db.prepare('SELECT id AS _id, name, slug, description FROM topics ORDER BY name ASC').all();
}

// ---- units ----

function unitsGetByCode(db: Db, args: { code: string }) {
  return db
    .prepare('SELECT id AS _id, code, name, description FROM units WHERE code = ?')
    .get(args.code.toUpperCase()) ?? null;
}

function unitsGetAll(db: Db) {
  return db.prepare('SELECT id AS _id, code, name, description FROM units ORDER BY code ASC').all();
}

function unitsCreateCustom(db: Db, args: { code: string; name: string }) {
  const code = args.code.toUpperCase();
  const existing = db.prepare('SELECT id AS _id FROM units WHERE code = ?').get(code) as
    | { _id: string }
    | undefined;
  if (existing) return existing._id;

  const id = newId();
  db.prepare('INSERT INTO units (id, code, name) VALUES (?, ?, ?)').run(id, code, args.name);
  return id;
}

// ---- notes ----

const NOTE_COLUMNS =
  'id AS _id, title, content, topicId, unitId, authorId, authorName, createdAt, updatedAt, voteCount, commentCount';

function notesCreate(
  db: Db,
  args: { token: string; title: string; content: string; topicId: string; unitId: string }
) {
  const user = requireAuth(db, args.token);
  const id = newId();
  const now = Date.now();
  db.prepare(
    `INSERT INTO notes (id, title, content, topicId, unitId, authorId, authorName, createdAt, updatedAt, voteCount, commentCount)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)`
  ).run(id, args.title, args.content, args.topicId, args.unitId, user._id, user.name, now, now);
  return id;
}

function notesList(db: Db, args: { topicId?: string; unitId?: string; limit?: number }) {
  const limit = args.limit ?? 50;
  if (args.topicId) {
    return db
      .prepare(`SELECT ${NOTE_COLUMNS} FROM notes WHERE topicId = ? ORDER BY createdAt DESC LIMIT ?`)
      .all(args.topicId, limit);
  }
  if (args.unitId) {
    return db
      .prepare(`SELECT ${NOTE_COLUMNS} FROM notes WHERE unitId = ? ORDER BY createdAt DESC LIMIT ?`)
      .all(args.unitId, limit);
  }
  return db.prepare(`SELECT ${NOTE_COLUMNS} FROM notes ORDER BY createdAt DESC LIMIT ?`).all(limit);
}

function notesSearch(db: Db, args: { query: string; limit?: number }) {
  const all = db
    .prepare(`SELECT ${NOTE_COLUMNS} FROM notes ORDER BY createdAt DESC LIMIT ?`)
    .all(args.limit ?? 200) as Record<string, any>[];
  const q = args.query.toLowerCase();
  return all.filter(
    (n) => String(n.title).toLowerCase().includes(q) || String(n.content).toLowerCase().includes(q)
  );
}

function notesGetById(db: Db, args: { id: string }) {
  return db.prepare(`SELECT ${NOTE_COLUMNS} FROM notes WHERE id = ?`).get(args.id) ?? null;
}

function notesRemove(db: Db, args: { token: string; id: string }) {
  const user = requireAuth(db, args.token);
  const note = db.prepare('SELECT id, authorId FROM notes WHERE id = ?').get(args.id) as
    | { id: string; authorId: string }
    | undefined;
  if (!note || note.authorId !== user._id) throw new Error('Not authorized');
  db.prepare('DELETE FROM notes WHERE id = ?').run(args.id);
}

// ---- questions ----

const QUESTION_COLUMNS =
  'id AS _id, title, content, topicId, unitId, authorId, authorName, createdAt, updatedAt, voteCount, answerCount, solved';

function questionsCreate(
  db: Db,
  args: { token: string; title: string; content: string; topicId: string; unitId: string }
) {
  const user = requireAuth(db, args.token);
  const id = newId();
  const now = Date.now();
  db.prepare(
    `INSERT INTO questions (id, title, content, topicId, unitId, authorId, authorName, createdAt, updatedAt, voteCount, answerCount, solved)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0)`
  ).run(id, args.title, args.content, args.topicId, args.unitId, user._id, user.name, now, now);
  return id;
}

function questionsList(db: Db, args: { topicId?: string; unitId?: string; limit?: number }) {
  const limit = args.limit ?? 50;
  const rows = (
    args.topicId
      ? db.prepare(`SELECT ${QUESTION_COLUMNS} FROM questions WHERE topicId = ? ORDER BY createdAt DESC LIMIT ?`).all(args.topicId, limit)
      : args.unitId
        ? db.prepare(`SELECT ${QUESTION_COLUMNS} FROM questions WHERE unitId = ? ORDER BY createdAt DESC LIMIT ?`).all(args.unitId, limit)
        : db.prepare(`SELECT ${QUESTION_COLUMNS} FROM questions ORDER BY createdAt DESC LIMIT ?`).all(limit)
  ) as Record<string, any>[];
  return rows.map(mapQuestion);
}

function questionsGetById(db: Db, args: { id: string }) {
  const row = db.prepare(`SELECT ${QUESTION_COLUMNS} FROM questions WHERE id = ?`).get(args.id) as
    | Record<string, any>
    | undefined;
  return row ? mapQuestion(row) : null;
}

function questionsMarkSolved(db: Db, args: { token: string; id: string }) {
  const user = requireAuth(db, args.token);
  const question = db.prepare('SELECT id, authorId FROM questions WHERE id = ?').get(args.id) as
    | { id: string; authorId: string }
    | undefined;
  if (!question || question.authorId !== user._id) throw new Error('Not authorized');
  db.prepare('UPDATE questions SET solved = 1 WHERE id = ?').run(args.id);
}

function questionsRemove(db: Db, args: { token: string; id: string }) {
  const user = requireAuth(db, args.token);
  const question = db.prepare('SELECT id, authorId FROM questions WHERE id = ?').get(args.id) as
    | { id: string; authorId: string }
    | undefined;
  if (!question || question.authorId !== user._id) throw new Error('Not authorized');
  db.prepare('DELETE FROM questions WHERE id = ?').run(args.id);
}

// ---- comments ----

const COMMENT_COLUMNS =
  'id AS _id, content, authorId, authorName, parentId, questionId, parentCommentId, createdAt';

function commentsCreateOnNote(
  db: Db,
  args: { token: string; content: string; parentId: string; parentCommentId?: string }
) {
  const user = requireAuth(db, args.token);
  const id = newId();
  db.prepare(
    `INSERT INTO comments (id, content, authorId, authorName, parentId, parentCommentId, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, args.content, user._id, user.name, args.parentId, args.parentCommentId ?? null, Date.now());
  db.prepare('UPDATE notes SET commentCount = commentCount + 1 WHERE id = ?').run(args.parentId);
  return id;
}

function commentsCreateOnQuestion(
  db: Db,
  args: { token: string; content: string; questionId: string; parentCommentId?: string }
) {
  const user = requireAuth(db, args.token);
  const id = newId();
  db.prepare(
    `INSERT INTO comments (id, content, authorId, authorName, questionId, parentCommentId, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, args.content, user._id, user.name, args.questionId, args.parentCommentId ?? null, Date.now());
  db.prepare('UPDATE questions SET answerCount = answerCount + 1 WHERE id = ?').run(args.questionId);
  return id;
}

function commentsListByNote(db: Db, args: { noteId: string }) {
  return db
    .prepare(`SELECT ${COMMENT_COLUMNS} FROM comments WHERE parentId = ? ORDER BY createdAt ASC`)
    .all(args.noteId);
}

function commentsListByQuestion(db: Db, args: { questionId: string }) {
  return db
    .prepare(`SELECT ${COMMENT_COLUMNS} FROM comments WHERE questionId = ? ORDER BY createdAt ASC`)
    .all(args.questionId);
}

function commentsRemove(db: Db, args: { token: string; id: string }) {
  const user = requireAuth(db, args.token);
  const comment = db.prepare('SELECT id, authorId FROM comments WHERE id = ?').get(args.id) as
    | { id: string; authorId: string }
    | undefined;
  if (!comment || comment.authorId !== user._id) throw new Error('Not authorized');
  db.prepare('DELETE FROM comments WHERE id = ?').run(args.id);
}

// ---- votes ----

function votesCast(
  db: Db,
  args: { token: string; targetType: 'note' | 'question'; targetId: string; value: 1 | -1 }
) {
  const user = requireAuth(db, args.token);
  const isNote = args.targetType === 'note';
  const table = isNote ? 'notes' : 'questions';
  const doc = db.prepare(`SELECT id, voteCount FROM ${table} WHERE id = ?`).get(args.targetId) as
    | { id: string; voteCount: number }
    | undefined;
  if (!doc) throw new Error('Not found');

  const existing = db
    .prepare('SELECT id, value FROM votes WHERE userId = ? AND targetType = ? AND targetId = ?')
    .get(user._id, args.targetType, args.targetId) as { id: string; value: number } | undefined;

  let voteCount = doc.voteCount;
  let userVote: number = args.value;

  db.exec('BEGIN');
  try {
    if (existing) {
      if (existing.value === args.value) {
        db.prepare('DELETE FROM votes WHERE id = ?').run(existing.id);
        voteCount -= args.value;
        userVote = 0;
      } else {
        db.prepare('UPDATE votes SET value = ? WHERE id = ?').run(args.value, existing.id);
        voteCount = voteCount - existing.value + args.value;
      }
    } else {
      db.prepare('INSERT INTO votes (id, userId, targetType, targetId, value) VALUES (?, ?, ?, ?, ?)').run(
        newId(),
        user._id,
        args.targetType,
        args.targetId,
        args.value
      );
      voteCount += args.value;
    }

    db.prepare(`UPDATE ${table} SET voteCount = ? WHERE id = ?`).run(voteCount, args.targetId);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
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

  const topic = db.prepare('SELECT id AS _id, name, slug, description FROM topics WHERE id = ?').get(note.topicId);
  const unit = db.prepare('SELECT id AS _id, code, name, description FROM units WHERE id = ?').get(note.unitId);
  const comments = commentsListByNote(db, { noteId: note._id });

  return { ...note, topic, unit, comments };
}

function getQuestionWithDetails(db: Db, args: { id: string }) {
  const question = db.prepare(`SELECT ${QUESTION_COLUMNS} FROM questions WHERE id = ?`).get(args.id) as
    | Record<string, any>
    | undefined;
  if (!question) return null;

  const topic = db.prepare('SELECT id AS _id, name, slug, description FROM topics WHERE id = ?').get(question.topicId);
  const unit = db.prepare('SELECT id AS _id, code, name, description FROM units WHERE id = ?').get(question.unitId);
  const answers = commentsListByQuestion(db, { questionId: question._id });

  return { ...mapQuestion(question), topic, unit, answers };
}

// ---- dispatcher ----

type Handler = (db: Db, args: any) => any;

const handlers: Record<string, Handler> = {
  'users:register': usersRegister,
  'users:getByToken': usersGetByToken,
  'topics:getBySlug': topicsGetBySlug,
  'topics:getAll': topicsGetAll,
  'units:getByCode': unitsGetByCode,
  'units:getAll': unitsGetAll,
  'units:createCustom': unitsCreateCustom,
  'notes:create': notesCreate,
  'notes:list': notesList,
  'notes:search': notesSearch,
  'notes:getById': notesGetById,
  'notes:remove': notesRemove,
  'questions:create': questionsCreate,
  'questions:list': questionsList,
  'questions:getById': questionsGetById,
  'questions:markSolved': questionsMarkSolved,
  'questions:remove': questionsRemove,
  'comments:createOnNote': commentsCreateOnNote,
  'comments:createOnQuestion': commentsCreateOnQuestion,
  'comments:listByNote': commentsListByNote,
  'comments:listByQuestion': commentsListByQuestion,
  'comments:remove': commentsRemove,
  'votes:cast': votesCast,
  'details:getNoteWithDetails': getNoteWithDetails,
  'details:getQuestionWithDetails': getQuestionWithDetails,
};

export function call(fn: string, args: Record<string, any> = {}): any {
  const handler = handlers[fn];
  if (!handler) throw new Error(`Unknown function: ${fn}`);
  return handler(getDb(), args ?? {});
}
