"use client";

import { useMemo, useState } from "react";
import "./social.css";
import { MentionComposer } from "./MentionComposer";
import { ReactionPicker } from "./ReactionPicker";
import type { MentionSuggestion, ReactionKind, SocialComment } from "./types";

type CommentThreadProps = {
  comments: SocialComment[];
  suggestions: MentionSuggestion[];
  onReact?: (commentId: string, reaction: ReactionKind) => void;
  onReply?: (parentCommentId: string | null, body: string) => Promise<void> | void;
};

function sortComments(comments: SocialComment[], sort: string) {
  const copy = [...comments];
  if (sort === "liked") {
    return copy.sort((a, b) => (b.reactions?.reduce((sum, item) => sum + item.count, 0) || 0) - (a.reactions?.reduce((sum, item) => sum + item.count, 0) || 0));
  }
  if (sort === "relevant") {
    return copy.sort((a, b) => (b.replies?.length || 0) - (a.replies?.length || 0));
  }
  return copy.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function CommentNode({
  comment,
  depth,
  suggestions,
  onReact,
  onReply,
}: {
  comment: SocialComment;
  depth: number;
  suggestions: MentionSuggestion[];
  onReact?: (commentId: string, reaction: ReactionKind) => void;
  onReply?: (parentCommentId: string | null, body: string) => Promise<void> | void;
}) {
  const [replying, setReplying] = useState(false);

  return (
    <div className={`socialCommentNode ${depth > 0 ? "socialCommentReply" : ""}`}>
      <span className="socialCommentRail" aria-hidden="true" />
      <div className="socialAvatar">{comment.authorName.slice(0, 1).toUpperCase()}</div>
      <div className={`socialCommentBody ${comment.mentionedMe ? "socialMentioned" : ""}`}>
        <div className="socialCommentBubble">
          <div className="socialCommentMeta">
            <strong>{comment.authorName}</strong>
            <span>{comment.authorRole}</span>
            <time>{new Date(comment.createdAt).toLocaleString()}</time>
          </div>
          <p>{comment.body}</p>
        </div>
        <div className="socialInlineActions">
          <ReactionPicker targetId={comment.id} summary={comment.reactions} onReact={(_, reaction) => onReact?.(comment.id, reaction)} />
          <button type="button" onClick={() => setReplying((value) => !value)}>
            Reply
          </button>
          <button type="button">Edit</button>
          <button type="button">Delete</button>
        </div>
        {replying ? (
          <MentionComposer
            suggestions={suggestions}
            submitLabel="Reply"
            placeholder={`Reply to ${comment.authorName}`}
            onSubmit={async ({ body }) => {
              await onReply?.(comment.id, body);
              setReplying(false);
            }}
          />
        ) : null}
        {comment.replies?.map((reply) => (
          <CommentNode
            key={reply.id}
            comment={reply}
            depth={depth + 1}
            suggestions={suggestions}
            onReact={onReact}
            onReply={onReply}
          />
        ))}
      </div>
    </div>
  );
}

export function CommentThread({ comments, suggestions, onReact, onReply }: CommentThreadProps) {
  const [sort, setSort] = useState("relevant");
  const visibleComments = useMemo(() => sortComments(comments, sort), [comments, sort]);

  return (
    <section className="socialCommentThread">
      <header className="socialThreadHeader">
        <strong>Comments</strong>
        <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort comments">
          <option value="relevant">Most relevant</option>
          <option value="newest">Newest</option>
          <option value="liked">Most liked</option>
        </select>
      </header>
      <MentionComposer suggestions={suggestions} submitLabel="Comment" placeholder="Write a comment..." onSubmit={({ body }) => onReply?.(null, body)} />
      <div className="socialCommentList">
        {visibleComments.map((comment) => (
          <CommentNode
            key={comment.id}
            comment={comment}
            depth={0}
            suggestions={suggestions}
            onReact={onReact}
            onReply={onReply}
          />
        ))}
      </div>
    </section>
  );
}
