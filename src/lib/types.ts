export type Id<T extends string> = string & { __table: T };

export type Doc<T extends string> = {
	_id: Id<T>;
	_creationTime: number;
};

export type UserDoc = Doc<"users"> & {
	email: string;
	name: string;
	avatarUrl?: string;
	sessionToken?: string;
	role: "user" | "admin";
};

export type TopicDoc = Doc<"topics"> & {
	name: string;
	slug: string;
	description?: string;
};

export type UnitDoc = Doc<"units"> & {
	code: string;
	code2?: string;
	name: string;
	description?: string;
};

export type NoteDoc = Doc<"notes"> & {
	title: string;
	content: string;
	topicId: Id<"topics">;
	unitId: Id<"units">;
	authorId: Id<"users">;
	authorName: string;
	createdAt: number;
	updatedAt: number;
	voteCount: number;
	commentCount: number;
	unit?: UnitDoc;
};

export type QuestionDoc = Doc<"questions"> & {
	title: string;
	content: string;
	topicId: Id<"topics">;
	unitId: Id<"units">;
	authorId: Id<"users">;
	authorName: string;
	createdAt: number;
	updatedAt: number;
	voteCount: number;
	answerCount: number;
	solved: boolean;
	unit?: UnitDoc;
};

export type SearchResult = (NoteDoc & { type: "note" }) | (QuestionDoc & { type: "question" });

export type CommentDoc = Doc<"comments"> & {
	content: string;
	authorId: Id<"users">;
	authorName: string;
	avatarUrl?: string;
	parentId?: Id<"notes">;
	questionId?: Id<"questions">;
	parentCommentId?: Id<"comments">;
	createdAt: number;
	updatedAt?: number;
};
