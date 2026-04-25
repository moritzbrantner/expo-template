import { randomUUID } from 'node:crypto';

import { hasPermission, requirePermission } from '../authz';
import { getPaginationCursor, json, noContent, paginate, parseBody, sendError } from '../http';
import { readSessionToken, resolveSession } from '../session';
import {
  appendNotification,
  canViewPost,
  findUserByUsername,
  isUserAccessible,
  toComment,
  toPost,
  toSessionUser,
} from '../store';
import type { ReactionType } from '../../../shared/social';
import type { RouteHandlerContext } from './types';

const PAGE_SIZE = 10;

function sortByNewest<T extends { createdAt: string }>(items: T[]) {
  return [...items].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

function isValidReactionType(value: string): value is ReactionType {
  return value === 'like' || value === 'celebrate' || value === 'support';
}

export async function handleContentRoutes(context: RouteHandlerContext): Promise<boolean> {
  const { corsOrigin, request, requestId, requestUrl, response, store } = context;
  const viewer = await resolveSession(store, readSessionToken(request));
  const viewerSession = viewer ? toSessionUser(viewer) : null;

  if (request.method === 'GET' && requestUrl.pathname === '/feed/home') {
    if (!requirePermission(response, { corsOrigin, permission: 'profile.read', requestId, user: viewerSession })) {
      return true;
    }

    const cursor = getPaginationCursor(requestUrl);
    const document = await store.read();
    const followees = new Set(
      document.follows
        .filter((follow) => follow.followerId === viewer!.id)
        .map((follow) => follow.followeeId),
    );
    followees.add(viewer!.id);

    const page = paginate(
      sortByNewest(
        document.posts
          .filter((post) => followees.has(post.authorId))
          .filter((post) => canViewPost(document, post, viewer!.id, { hideMuted: true }))
          .map((post) => toPost(document, post, viewerSession))
          .filter((post): post is NonNullable<typeof post> => Boolean(post)),
      ),
      cursor,
      PAGE_SIZE,
    );

    json(response, 200, { posts: page.items, nextCursor: page.nextCursor }, corsOrigin);
    return true;
  }

  if (request.method === 'GET' && requestUrl.pathname === '/feed/discover') {
    const cursor = getPaginationCursor(requestUrl);
    const document = await store.read();
    const page = paginate(
      sortByNewest(
        document.posts
          .filter((post) => canViewPost(document, post, viewer?.id ?? null, { hideMuted: true }))
          .map((post) => toPost(document, post, viewerSession))
          .filter((post): post is NonNullable<typeof post> => Boolean(post)),
      ),
      cursor,
      PAGE_SIZE,
    );

    json(response, 200, { posts: page.items, nextCursor: page.nextCursor }, corsOrigin);
    return true;
  }

  if (request.method === 'GET' && requestUrl.pathname.startsWith('/profiles/')) {
    const segments = requestUrl.pathname.split('/').filter(Boolean);

    if (segments.length === 3 && segments[2] === 'posts') {
      const cursor = getPaginationCursor(requestUrl);
      const document = await store.read();
      const user = findUserByUsername(document, segments[1] ?? '');

      if (!user || !isUserAccessible(document, user, viewer?.id ?? null, { allowUndiscoverable: true })) {
        sendError(response, {
          code: 'PROFILE_NOT_FOUND',
          corsOrigin,
          message: 'Profile not found.',
          requestId,
          statusCode: 404,
        });
        return true;
      }

      const page = paginate(
        sortByNewest(
          document.posts
            .filter((post) => post.authorId === user.id)
            .filter((post) => canViewPost(document, post, viewer?.id ?? null))
            .map((post) => toPost(document, post, viewerSession))
            .filter((post): post is NonNullable<typeof post> => Boolean(post)),
        ),
        cursor,
        PAGE_SIZE,
      );

      json(response, 200, { posts: page.items, nextCursor: page.nextCursor }, corsOrigin);
      return true;
    }
  }

  if (request.method === 'POST' && requestUrl.pathname === '/posts') {
    if (!requirePermission(response, { corsOrigin, permission: 'post.create:self', requestId, user: viewerSession })) {
      return true;
    }

    const body = await parseBody(request);
    const content = String(body.body ?? '').trim();

    if (!content || content.length > 2800) {
      sendError(response, {
        code: 'INVALID_POST_BODY',
        corsOrigin,
        message: 'Post body must be between 1 and 2800 characters.',
        requestId,
        statusCode: 400,
      });
      return true;
    }

    const post = await store.mutate((document) => {
      const now = new Date().toISOString();
      const nextPost = {
        id: randomUUID(),
        authorId: viewer!.id,
        body: content,
        status: 'active' as const,
        createdAt: now,
        updatedAt: now,
      };

      document.posts.push(nextPost);
      return nextPost;
    });

    const document = await store.read();
    json(response, 201, { post: toPost(document, post, viewerSession) }, corsOrigin);
    return true;
  }

  if (request.method === 'GET' && requestUrl.pathname.startsWith('/posts/')) {
    const segments = requestUrl.pathname.split('/').filter(Boolean);

    if (segments.length === 2) {
      const document = await store.read();
      const post = document.posts.find((entry) => entry.id === segments[1]);

      if (!post) {
        sendError(response, {
          code: 'POST_NOT_FOUND',
          corsOrigin,
          message: 'Post not found.',
          requestId,
          statusCode: 404,
        });
        return true;
      }

      const canModerate = hasPermission(viewerSession, 'content.moderate:any');
      const isOwner = viewer?.id === post.authorId;

      if (!canViewPost(document, post, viewer?.id ?? null) && !canModerate && !isOwner) {
        sendError(response, {
          code: 'POST_NOT_FOUND',
          corsOrigin,
          message: 'Post not found.',
          requestId,
          statusCode: 404,
        });
        return true;
      }

      json(response, 200, {
        post: toPost(document, post, viewerSession),
        comments: sortByNewest(
          document.comments
            .filter((comment) => comment.postId === post.id && comment.status === 'active')
            .map((comment) => toComment(document, comment, viewerSession))
            .filter((comment): comment is NonNullable<typeof comment> => Boolean(comment)),
        ),
      }, corsOrigin);
      return true;
    }
  }

  if (request.method === 'PATCH' && requestUrl.pathname.startsWith('/posts/')) {
    if (!requirePermission(response, { corsOrigin, permission: 'post.edit:self', requestId, user: viewerSession })) {
      return true;
    }

    const segments = requestUrl.pathname.split('/').filter(Boolean);

    if (segments.length === 2) {
      const body = await parseBody(request);
      const content = String(body.body ?? '').trim();

      if (!content || content.length > 2800) {
        sendError(response, {
          code: 'INVALID_POST_BODY',
          corsOrigin,
          message: 'Post body must be between 1 and 2800 characters.',
          requestId,
          statusCode: 400,
        });
        return true;
      }

      const result = await store.mutate((document) => {
        const post = document.posts.find((entry) => entry.id === segments[1]);

        if (!post) {
          return { missing: true as const };
        }

        if (post.authorId !== viewer!.id) {
          return { forbidden: true as const };
        }

        post.body = content;
        post.updatedAt = new Date().toISOString();

        return { post };
      });

      if ('missing' in result) {
        sendError(response, {
          code: 'POST_NOT_FOUND',
          corsOrigin,
          message: 'Post not found.',
          requestId,
          statusCode: 404,
        });
        return true;
      }

      if ('forbidden' in result) {
        sendError(response, {
          code: 'FORBIDDEN',
          corsOrigin,
          message: 'You can only edit your own posts.',
          requestId,
          statusCode: 403,
        });
        return true;
      }

      const document = await store.read();
      json(response, 200, { post: toPost(document, result.post, viewerSession) }, corsOrigin);
      return true;
    }
  }

  if (request.method === 'DELETE' && requestUrl.pathname.startsWith('/posts/')) {
    if (!requirePermission(response, { corsOrigin, permission: 'post.delete:self', requestId, user: viewerSession })) {
      return true;
    }

    const segments = requestUrl.pathname.split('/').filter(Boolean);

    if (segments.length === 2) {
      const result = await store.mutate((document) => {
        const post = document.posts.find((entry) => entry.id === segments[1]);

        if (!post) {
          return { missing: true as const };
        }

        const canModerate = hasPermission(viewerSession, 'content.moderate:any');

        if (post.authorId !== viewer!.id && !canModerate) {
          return { forbidden: true as const };
        }

        post.status = 'removed';
        post.updatedAt = new Date().toISOString();
        return { ok: true as const };
      });

      if ('missing' in result) {
        sendError(response, {
          code: 'POST_NOT_FOUND',
          corsOrigin,
          message: 'Post not found.',
          requestId,
          statusCode: 404,
        });
        return true;
      }

      if ('forbidden' in result) {
        sendError(response, {
          code: 'FORBIDDEN',
          corsOrigin,
          message: 'You can only delete your own posts.',
          requestId,
          statusCode: 403,
        });
        return true;
      }

      noContent(response, corsOrigin);
      return true;
    }
  }

  if (request.method === 'POST' && requestUrl.pathname.endsWith('/comments')) {
    if (!requirePermission(response, { corsOrigin, permission: 'comment.create:self', requestId, user: viewerSession })) {
      return true;
    }

    const segments = requestUrl.pathname.split('/').filter(Boolean);

    if (segments.length === 3 && segments[0] === 'posts' && segments[2] === 'comments') {
      const body = await parseBody(request);
      const content = String(body.body ?? '').trim();
      const parentCommentId =
        body.parentCommentId === null || body.parentCommentId === undefined
          ? null
          : String(body.parentCommentId);

      if (!content || content.length > 1200) {
        sendError(response, {
          code: 'INVALID_COMMENT_BODY',
          corsOrigin,
          message: 'Comment body must be between 1 and 1200 characters.',
          requestId,
          statusCode: 400,
        });
        return true;
      }

      const result = await store.mutate((document) => {
        const post = document.posts.find((entry) => entry.id === segments[1]);

        if (!post || !canViewPost(document, post, viewer!.id)) {
          return { missing: true as const };
        }

        if (parentCommentId) {
          const parent = document.comments.find((entry) => entry.id === parentCommentId && entry.postId === post.id);

          if (!parent) {
            return { invalidParent: true as const };
          }
        }

        const now = new Date().toISOString();
        const comment = {
          id: randomUUID(),
          postId: post.id,
          authorId: viewer!.id,
          parentCommentId,
          body: content,
          status: 'active' as const,
          createdAt: now,
          updatedAt: now,
        };

        document.comments.push(comment);
        if (post.authorId !== viewer!.id) {
          appendNotification(document, {
            actorUserId: viewer!.id,
            commentId: comment.id,
            postId: post.id,
            type: parentCommentId ? 'reply' : 'comment',
            userId: post.authorId,
          });
        }

        if (parentCommentId) {
          const parent = document.comments.find((entry) => entry.id === parentCommentId)!;

          if (parent.authorId !== viewer!.id && parent.authorId !== post.authorId) {
            appendNotification(document, {
              actorUserId: viewer!.id,
              commentId: comment.id,
              postId: post.id,
              type: 'reply',
              userId: parent.authorId,
            });
          }
        }

        return { comment };
      });

      if ('missing' in result) {
        sendError(response, {
          code: 'POST_NOT_FOUND',
          corsOrigin,
          message: 'Post not found.',
          requestId,
          statusCode: 404,
        });
        return true;
      }

      if ('invalidParent' in result) {
        sendError(response, {
          code: 'INVALID_PARENT_COMMENT',
          corsOrigin,
          message: 'The parent comment does not exist on this post.',
          requestId,
          statusCode: 400,
        });
        return true;
      }

      const document = await store.read();
      json(response, 201, { comment: toComment(document, result.comment, viewerSession) }, corsOrigin);
      return true;
    }
  }

  if (request.method === 'DELETE' && requestUrl.pathname.startsWith('/comments/')) {
    if (!requirePermission(response, { corsOrigin, permission: 'comment.delete:self', requestId, user: viewerSession })) {
      return true;
    }

    const commentId = requestUrl.pathname.split('/').filter(Boolean)[1];
    const result = await store.mutate((document) => {
      const comment = document.comments.find((entry) => entry.id === commentId);

      if (!comment) {
        return { missing: true as const };
      }

      const canModerate = hasPermission(viewerSession, 'content.moderate:any');

      if (comment.authorId !== viewer!.id && !canModerate) {
        return { forbidden: true as const };
      }

      comment.status = 'removed';
      comment.updatedAt = new Date().toISOString();
      return { ok: true as const };
    });

    if ('missing' in result) {
      sendError(response, {
        code: 'COMMENT_NOT_FOUND',
        corsOrigin,
        message: 'Comment not found.',
        requestId,
        statusCode: 404,
      });
      return true;
    }

    if ('forbidden' in result) {
      sendError(response, {
        code: 'FORBIDDEN',
        corsOrigin,
        message: 'You can only delete your own comments.',
        requestId,
        statusCode: 403,
      });
      return true;
    }

    noContent(response, corsOrigin);
    return true;
  }

  if (request.method === 'POST' && requestUrl.pathname.endsWith('/reactions')) {
    if (!requirePermission(response, { corsOrigin, permission: 'reaction.create:self', requestId, user: viewerSession })) {
      return true;
    }

    const segments = requestUrl.pathname.split('/').filter(Boolean);

    if (segments.length === 3 && segments[0] === 'posts' && segments[2] === 'reactions') {
      const body = await parseBody(request);
      const type = String(body.type ?? '').trim();

      if (!isValidReactionType(type)) {
        sendError(response, {
          code: 'INVALID_REACTION_TYPE',
          corsOrigin,
          message: 'A valid reaction type is required.',
          requestId,
          statusCode: 400,
        });
        return true;
      }

      const result = await store.mutate((document) => {
        const post = document.posts.find((entry) => entry.id === segments[1]);

        if (!post || !canViewPost(document, post, viewer!.id)) {
          return { missing: true as const };
        }

        const reactionType = type as ReactionType;
        const existing = document.reactions.find(
          (reaction) => reaction.postId === post.id && reaction.userId === viewer!.id,
        );

        if (existing) {
          existing.type = reactionType;
        } else {
          document.reactions.push({
            id: randomUUID(),
            postId: post.id,
            userId: viewer!.id,
            type: reactionType,
            createdAt: new Date().toISOString(),
          });
        }

        if (post.authorId !== viewer!.id) {
          appendNotification(document, {
            actorUserId: viewer!.id,
            postId: post.id,
            type: 'reaction',
            userId: post.authorId,
          });
        }

        return { post };
      });

      if ('missing' in result) {
        sendError(response, {
          code: 'POST_NOT_FOUND',
          corsOrigin,
          message: 'Post not found.',
          requestId,
          statusCode: 404,
        });
        return true;
      }

      const document = await store.read();
      json(response, 200, { post: toPost(document, result.post, viewerSession) }, corsOrigin);
      return true;
    }
  }

  if (request.method === 'DELETE' && requestUrl.pathname.includes('/reactions/')) {
    if (!requirePermission(response, { corsOrigin, permission: 'reaction.delete:self', requestId, user: viewerSession })) {
      return true;
    }

    const segments = requestUrl.pathname.split('/').filter(Boolean);

    if (segments.length === 4 && segments[0] === 'posts' && segments[2] === 'reactions') {
      const reactionType = String(segments[3] ?? '');

      await store.mutate((document) => {
        document.reactions = document.reactions.filter(
          (reaction) =>
            !(
              reaction.postId === segments[1] &&
              reaction.userId === viewer!.id &&
              reaction.type === reactionType
            ),
        );
      });

      noContent(response, corsOrigin);
      return true;
    }
  }

  return false;
}
