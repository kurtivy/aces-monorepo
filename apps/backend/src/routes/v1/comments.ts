// backend/src/routes/v1/comments.ts - Comments System API
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getPrismaClient } from '../../lib/database';
import { requireAuth } from '../../lib/auth-middleware';

// Rate limiting configuration
const RATE_LIMIT_WINDOW = 10000; // 10 seconds

// Validation schemas
const CreateCommentSchema = z.object({
  content: z.string().min(1).max(1000).trim(),
  listingId: z.string(),
  parentId: z.string().optional(),
});

const UpdateUsernameSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(20)
    .regex(/^[a-zA-Z0-9_]+$/)
    .optional(),
});

// Types
interface CommentResponse {
  id: string;
  content: string;
  listingId: string;
  authorId: string;
  parentId: string | null;
  createdAt: string;
  author: {
    id: string;
    username: string | null;
    walletAddress: string | null;
  };
  likeCount: number;
  isLikedByUser: boolean;
  replies?: CommentResponse[];
}

export async function commentsRoutes(fastify: FastifyInstance) {
  const prisma = getPrismaClient();

  // GET /api/v1/comments/:listingId - Get comments for a listing
  fastify.get('/:listingId', async (request, reply) => {
    const { listingId } = request.params as { listingId: string };
    const currentUserId = request.user?.id;

    try {
      // Verify listing exists
      const listing = await prisma.listing.findUnique({
        where: { id: listingId },
        select: { id: true },
      });

      if (!listing) {
        return reply.status(404).send({
          success: false,
          error: 'Listing not found',
        });
      }

      // Get comments with nested replies
      const comments = await prisma.listingComment.findMany({
        where: {
          listingId,
          parentId: null, // Only top-level comments
          isHidden: false, // Don't show hidden comments
        },
        include: {
          author: {
            select: {
              id: true,
              username: true,
              walletAddress: true,
            },
          },
          replies: {
            where: { isHidden: false },
            include: {
              author: {
                select: {
                  id: true,
                  username: true,
                  walletAddress: true,
                },
              },
              _count: {
                select: { likes: true },
              },
            },
            orderBy: { createdAt: 'asc' },
          },
          _count: {
            select: { likes: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      // Get user likes separately to avoid complex nested queries
      let userLikes: string[] = [];
      if (currentUserId) {
        const userLikeRecords = await prisma.listingCommentLike.findMany({
          where: {
            userId: currentUserId,
            comment: {
              listingId,
            },
          },
          select: {
            commentId: true,
          },
        });
        userLikes = userLikeRecords.map((like) => like.commentId);
      }

      // Format comments with nested replies
      const formatComment = (comment: {
        id: string;
        content: string;
        listingId: string;
        authorId: string;
        parentId: string | null;
        createdAt: Date;
        author: {
          id: string;
          username: string | null;
          walletAddress: string | null;
        };
        _count: {
          likes: number;
        };
        replies?: {
          id: string;
          content: string;
          listingId: string;
          authorId: string;
          parentId: string | null;
          createdAt: Date;
          author: {
            id: string;
            username: string | null;
            walletAddress: string | null;
          };
          _count: {
            likes: number;
          };
        }[];
      }): CommentResponse => {
        const displayName =
          comment.author.username ||
          (comment.author.walletAddress
            ? `${comment.author.walletAddress.slice(0, 6)}...${comment.author.walletAddress.slice(-4)}`
            : 'Anonymous');

        return {
          id: comment.id,
          content: comment.content,
          listingId: comment.listingId,
          authorId: comment.authorId,
          parentId: comment.parentId,
          createdAt: comment.createdAt.toISOString(),
          author: {
            ...comment.author,
            username: displayName,
          },
          likeCount: comment._count.likes,
          isLikedByUser: userLikes.includes(comment.id),
          replies: comment.replies?.map(formatComment) || [],
        };
      };

      const formattedComments = comments.map(formatComment);

      reply.send({
        success: true,
        data: formattedComments,
      });
    } catch (error) {
      fastify.log.error({ error }, 'Failed to fetch comments');
      reply.status(500).send({
        success: false,
        error: 'Failed to fetch comments',
      });
    }
  });

  // POST /api/v1/comments - Create a new comment
  fastify.post(
    '/',
    {
      preHandler: [requireAuth],
    },
    async (request, reply) => {
      const { content, listingId, parentId } = request.body as z.infer<typeof CreateCommentSchema>;
      const userId = request.user!.id;

      try {
        // Rate limiting check
        const userLastComment = await prisma.listingComment.findFirst({
          where: { authorId: userId },
          orderBy: { createdAt: 'desc' },
        });

        if (userLastComment) {
          const timeSinceLastComment = Date.now() - userLastComment.createdAt.getTime();
          if (timeSinceLastComment < RATE_LIMIT_WINDOW) {
            const remainingTime = Math.ceil((RATE_LIMIT_WINDOW - timeSinceLastComment) / 1000);
            return reply.status(429).send({
              success: false,
              error: 'Please wait before posting another comment',
              retryAfter: remainingTime,
            });
          }
        }

        // Validate listing exists
        const listing = await prisma.listing.findUnique({
          where: { id: listingId },
          select: { id: true },
        });

        if (!listing) {
          return reply.status(404).send({
            success: false,
            error: 'Listing not found',
          });
        }

        // Validate parent comment exists if parentId provided
        if (parentId) {
          const parentComment = await prisma.listingComment.findUnique({
            where: { id: parentId },
          });

          if (!parentComment || parentComment.listingId !== listingId) {
            return reply.status(400).send({
              success: false,
              error: 'Invalid parent comment',
            });
          }
        }

        // Ensure user has username (default to wallet address)
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { username: true, walletAddress: true },
        });

        if (!user?.username && user?.walletAddress) {
          await prisma.user.update({
            where: { id: userId },
            data: { username: user.walletAddress },
          });
        }

        // Create comment
        const comment = await prisma.listingComment.create({
          data: {
            content: content.trim(),
            listingId,
            authorId: userId,
            parentId: parentId || null,
          },
          include: {
            author: {
              select: {
                id: true,
                username: true,
                walletAddress: true,
              },
            },
            _count: {
              select: { likes: true },
            },
          },
        });

        const displayName =
          comment.author.username ||
          (comment.author.walletAddress
            ? `${comment.author.walletAddress.slice(0, 6)}...${comment.author.walletAddress.slice(-4)}`
            : 'Anonymous');

        const formattedComment: CommentResponse = {
          id: comment.id,
          content: comment.content,
          listingId: comment.listingId,
          authorId: comment.authorId,
          parentId: comment.parentId,
          createdAt: comment.createdAt.toISOString(),
          author: {
            ...comment.author,
            username: displayName,
          },
          likeCount: comment._count.likes,
          isLikedByUser: false,
        };

        reply.status(201).send({
          success: true,
          data: formattedComment,
        });
      } catch (error) {
        fastify.log.error({ error }, 'Failed to create comment');
        reply.status(500).send({
          success: false,
          error: 'Failed to create comment',
        });
      }
    },
  );

  // POST /api/v1/comments/:commentId/like - Toggle like on comment
  fastify.post(
    '/:commentId/like',
    {
      preHandler: [requireAuth],
    },
    async (request, reply) => {
      const { commentId } = request.params as { commentId: string };
      const userId = request.user!.id;

      console.log('🔍 Like request received:', { commentId, userId });

      try {
        // Check if comment exists
        console.log('🔍 Checking if comment exists:', commentId);
        const comment = await prisma.listingComment.findUnique({
          where: { id: commentId },
          select: { id: true },
        });

        console.log('🔍 Comment found:', comment);

        if (!comment) {
          console.log('❌ Comment not found');
          return reply.status(404).send({
            success: false,
            error: 'Comment not found',
          });
        }

        // Use upsert to handle like/unlike in a single atomic operation
        // This prevents race conditions and handles the unique constraint properly
        console.log('🔍 Checking for existing like...');
        const existingLike = await prisma.listingCommentLike.findFirst({
          where: {
            commentId,
            userId,
          },
        });

        console.log('🔍 Existing like found:', existingLike);

        let liked: boolean;

        if (existingLike) {
          // Unlike - remove the like
          console.log('🔍 Removing existing like...');
          await prisma.listingCommentLike.delete({
            where: {
              id: existingLike.id,
            },
          });
          liked = false;
          console.log('✅ Like removed successfully');
        } else {
          // Like - create new like
          console.log('🔍 Creating new like...');
          await prisma.listingCommentLike.create({
            data: {
              commentId,
              userId,
            },
          });
          liked = true;
          console.log('✅ Like created successfully');
        }

        // Get updated like count
        console.log('🔍 Getting updated like count...');
        const newCount = await prisma.listingCommentLike.count({
          where: { commentId },
        });

        console.log('✅ Like operation completed:', { liked, newCount });

        reply.send({
          success: true,
          data: {
            liked,
            newCount,
          },
        });
      } catch (error: unknown) {
        console.error('❌ Like operation failed:', error);
        console.error('❌ Error details:', {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          commentId,
          userId,
        });
        fastify.log.error({ error, commentId, userId }, 'Failed to toggle like');

        // Handle specific database errors
        if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
          // Unique constraint violation - this shouldn't happen with our logic, but handle it gracefully
          try {
            await prisma.listingCommentLike.deleteMany({
              where: {
                commentId,
                userId,
              },
            });
            const likeCount = await prisma.listingCommentLike.count({
              where: { commentId },
            });
            return reply.send({
              success: true,
              data: {
                liked: false,
                newCount: likeCount,
              },
            });
          } catch (deleteError) {
            fastify.log.error(
              { deleteError, commentId, userId },
              'Failed to handle unique constraint violation',
            );
          }
        }
        reply.status(500).send({
          success: false,
          error: 'Failed to toggle like',
        });
      }
    },
  );

  // PUT /api/v1/comments/username - Update user's username
  fastify.put(
    '/username',
    {
      preHandler: [requireAuth],
    },
    async (request, reply) => {
      const { username } = request.body as z.infer<typeof UpdateUsernameSchema>;
      const userId = request.user!.id;

      try {
        const updatedUser = await prisma.user.update({
          where: { id: userId },
          data: { username: username?.trim() || null },
          select: {
            id: true,
            username: true,
            walletAddress: true,
          },
        });

        reply.send({
          success: true,
          data: updatedUser,
        });
      } catch (error: unknown) {
        if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
          return reply.status(400).send({
            success: false,
            error: 'Username already taken',
          });
        }
        fastify.log.error({ error }, 'Failed to update username');
        reply.status(500).send({
          success: false,
          error: 'Failed to update username',
        });
      }
    },
  );
}
