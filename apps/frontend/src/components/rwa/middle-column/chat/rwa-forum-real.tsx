'use client';

import { useState, useEffect, useCallback } from 'react';
import { Heart, MessageCircle, Share, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
// import Image from 'next/image';
import { Comment } from '@/types/comments';
import { CommentsApi } from '@/lib/api/comments';
import { useAuth } from '@/lib/auth/auth-context';
import { formatDistanceToNow } from 'date-fns';

interface RWAForumProps {
  listingId?: string;
  listingTitle?: string;
  isLive?: boolean;
}

export default function RWAForumReal({
  listingId,
  listingTitle = "King Solomon's Baby",
  // isLive = true,
}: RWAForumProps) {
  const { isAuthenticated, getAccessToken } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rateLimitError, setRateLimitError] = useState<string | null>(null);
  const [retryAfter, setRetryAfter] = useState<number | null>(null);

  // Fetch comments from API
  const fetchComments = useCallback(async () => {
    if (!listingId) return;

    try {
      setFetching(true);
      setError(null);
      const token = await getAccessToken();
      const fetchedComments = await CommentsApi.getComments(listingId, token || undefined);
      setComments(fetchedComments);
    } catch (err) {
      console.error('Failed to fetch comments:', err);
      setError('Failed to load comments');
    } finally {
      setFetching(false);
    }
  }, [listingId, getAccessToken]);

  // Polling for new comments every 30 seconds
  useEffect(() => {
    if (!listingId) return;

    // Initial fetch
    fetchComments();

    // Set up polling
    const interval = setInterval(fetchComments, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [listingId, fetchComments]);

  // Rate limiting countdown
  useEffect(() => {
    if (retryAfter && retryAfter > 0) {
      const timer = setTimeout(() => {
        setRetryAfter(retryAfter - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (retryAfter === 0) {
      setRateLimitError(null);
      setRetryAfter(null);
    }
  }, [retryAfter]);

  const handleLike = async (commentId: string, path: number[] = []) => {
    if (!isAuthenticated) return;

    try {
      const token = await getAccessToken();
      const result = await CommentsApi.toggleLike(commentId, token || undefined);
      if (result) {
        // Update the comment in the state
        setComments((prevComments) => {
          const newComments = [...prevComments];
          let current: Comment[] = newComments;

          // Navigate to the correct comment using the path
          for (let i = 0; i < path.length; i++) {
            current = current[path[i]].replies || [];
          }

          const commentIndex = current.findIndex((c) => c.id === commentId);
          if (commentIndex !== -1) {
            current[commentIndex] = {
              ...current[commentIndex],
              likeCount: result.newCount,
              isLikedByUser: result.liked,
            };
          }

          return newComments;
        });
      }
    } catch (error) {
      console.error('Failed to toggle like:', error);
    }
  };

  const handleSubmitComment = async () => {
    if (!newComment.trim() || !isAuthenticated || !listingId || loading) return;

    setLoading(true);
    setRateLimitError(null);

    try {
      const token = await getAccessToken();
      const comment = await CommentsApi.createComment(
        {
          content: newComment.trim(),
          listingId,
        },
        token || undefined,
      );

      if (comment) {
        setComments((prev) => [comment, ...prev]);
        setNewComment('');
      }
    } catch (error: any) {
      console.error('Failed to create comment:', error);

      // Handle rate limiting
      if (error.message.includes('Please wait')) {
        const match = error.message.match(/(\d+)/);
        const seconds = match ? parseInt(match[1]) : 10;
        setRateLimitError(error.message);
        setRetryAfter(seconds);
      } else {
        setError(error.message || 'Failed to create comment');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitReply = async (parentId: string) => {
    if (!replyText.trim() || !isAuthenticated || !listingId || loading) return;

    setLoading(true);
    setRateLimitError(null);

    try {
      const token = await getAccessToken();
      const reply = await CommentsApi.createComment(
        {
          content: replyText.trim(),
          listingId,
          parentId,
        },
        token || undefined,
      );

      if (reply) {
        // Add reply to the parent comment
        setComments((prevComments) => {
          const newComments = [...prevComments];
          const addReplyToComment = (comments: Comment[]): Comment[] => {
            return comments.map((comment) => {
              if (comment.id === parentId) {
                return {
                  ...comment,
                  replies: [...(comment.replies || []), reply],
                };
              }
              return {
                ...comment,
                replies: addReplyToComment(comment.replies || []),
              };
            });
          };
          return addReplyToComment(newComments);
        });

        setReplyText('');
        setReplyingTo(null);
      }
    } catch (error: any) {
      console.error('Failed to create reply:', error);

      // Handle rate limiting
      if (error.message.includes('Please wait')) {
        const match = error.message.match(/(\d+)/);
        const seconds = match ? parseInt(match[1]) : 10;
        setRateLimitError(error.message);
        setRetryAfter(seconds);
      } else {
        setError(error.message || 'Failed to create reply');
      }
    } finally {
      setLoading(false);
    }
  };

  const renderComment = (comment: Comment, depth = 0, path: number[] = []) => (
    <div
      key={comment.id}
      className={`${depth > 0 ? 'ml-8 border-l border-[#D0B284]/20 pl-4' : ''}`}
    >
      <div className="bg-[#231F20]/30 border border-[#D0B284]/20 rounded-lg p-4 mb-4">
        {/* Comment Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full border border-[#D0B284]/20 bg-gradient-to-br from-[#D0B284] to-[#184D37] flex items-center justify-center text-[#231F20] font-semibold text-xs">
              {comment.author.username?.charAt(0).toUpperCase() || 'A'}
            </div>
            <div>
              <span className="text-[#D0B284] font-semibold text-sm">
                {comment.author.username}
              </span>
              <span className="text-[#DCDDCC] text-xs ml-2">
                {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
              </span>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="text-[#DCDDCC] hover:text-[#D0B284]">
            <MoreHorizontal size={16} />
          </Button>
        </div>

        {/* Comment Content */}
        <p className="text-white text-sm leading-relaxed mb-4">{comment.content}</p>

        {/* Comment Actions */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleLike(comment.id, path)}
            disabled={!isAuthenticated}
            className={`flex items-center gap-1 text-xs ${
              comment.isLikedByUser ? 'text-red-400' : 'text-[#DCDDCC] hover:text-red-400'
            }`}
          >
            <Heart size={14} fill={comment.isLikedByUser ? 'currentColor' : 'none'} />
            {comment.likeCount}
          </Button>

          {isAuthenticated && !comment.parentId && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
              className="flex items-center gap-1 text-xs text-[#DCDDCC] hover:text-[#D0B284]"
            >
              <MessageCircle size={14} />
              Reply
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            className="flex items-center gap-1 text-xs text-[#DCDDCC] hover:text-[#D0B284]"
          >
            <Share size={14} />
            Share
          </Button>
        </div>

        {/* Reply Input */}
        {replyingTo === comment.id && (
          <div className="mt-4 pt-4 border-t border-[#D0B284]/20">
            <Textarea
              placeholder={`Reply to ${comment.author.username}...`}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              className="bg-[#231F20] border-[#D0B284]/20 text-white placeholder:text-[#DCDDCC] mb-2"
              rows={3}
            />
            <div className="flex gap-2">
              <Button
                onClick={() => handleSubmitReply(comment.id)}
                disabled={!replyText.trim() || loading}
                className="bg-[#D0B284] hover:bg-[#D0B284]/90 text-[#231F20] text-xs"
              >
                {loading ? 'Posting...' : 'Reply'}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setReplyingTo(null);
                  setReplyText('');
                }}
                className="text-[#DCDDCC] hover:text-white text-xs"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Render Replies */}
      {comment.replies?.map((reply) =>
        renderComment(reply, depth + 1, [...path, comments.findIndex((c) => c.id === comment.id)]),
      )}
    </div>
  );

  // Show loading state
  if (fetching && comments.length === 0) {
    return (
      <div className="h-full bg-[#151c16] relative flex flex-col">
        <div className="px-4 py-3 border-b border-[#D0B284]/20 flex-shrink-0">
          <h3 className="text-white text-lg font-semibold font-spray-letters">Discussion</h3>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-[#D0B284] text-lg">Loading comments...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-[#151c16] relative flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#D0B284]/20 flex-shrink-0">
        <h3 className="text-[#D0B284] text-lg font-semibold font-spray-letters">
          Discussion ({comments.length} comments)
        </h3>
      </div>

      {/* Error Messages */}
      {error && (
        <div className="px-4 py-2 bg-red-900/20 border-b border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}
      {rateLimitError && (
        <div className="px-4 py-2 bg-yellow-900/20 border-b border-yellow-500/20 text-yellow-400 text-sm">
          {rateLimitError}
          {retryAfter && ` Please wait ${retryAfter} seconds.`}
        </div>
      )}

      {/* Comments Feed - Scrollable with bottom padding for comment input section */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-[#D0B284] scrollbar-track-[#151c16]/60 pb-32">
        <div className="px-4 py-4 space-y-4">
          {comments.length === 0 ? (
            <div className="text-center py-8 text-[#DCDDCC]">
              No comments yet. Be the first to comment!
            </div>
          ) : (
            comments.map((comment, index) => renderComment(comment, 0, [index]))
          )}
        </div>
      </div>

      {/* New Comment Section - Positioned at bottom of this container */}
      {isAuthenticated && (
        <div className="absolute bottom-0 left-0 right-0 border-t border-[#D0B284]/20 bg-[#151c16] z-10 p-4">
          <div className="flex gap-3 items-end w-full">
            <Textarea
              placeholder={`Share your thoughts about ${listingTitle}...`}
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              disabled={loading || !!rateLimitError}
              className="flex-1 bg-[#151c16] border-[#D0B284]/20 text-white placeholder:text-[#DCDDCC] resize-none min-h-[60px] max-h-[200px] overflow-y-auto"
              style={{
                height: 'auto',
                minHeight: '60px',
                maxHeight: '200px',
              }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = Math.min(target.scrollHeight, 200) + 'px';
              }}
            />
            <Button
              onClick={handleSubmitComment}
              disabled={!newComment.trim() || loading || !!rateLimitError}
              className="bg-[#D0B284] hover:bg-[#D0B284]/90 text-[#231F20] font-semibold px-6 py-2 h-auto self-end"
            >
              {loading ? 'Posting...' : 'Post Comment'}
            </Button>
          </div>
        </div>
      )}

      {/* Not authenticated message */}
      {!isAuthenticated && (
        <div className="absolute bottom-0 left-0 right-0 border-t border-[#D0B284]/20 bg-[#151c16] z-10 p-4">
          <div className="text-center text-[#DCDDCC] text-sm">
            Please connect your wallet to join the discussion
          </div>
        </div>
      )}
    </div>
  );
}
