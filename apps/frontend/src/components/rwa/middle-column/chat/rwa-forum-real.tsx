'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowUpRight, Heart, Loader2, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  variant?: 'default' | 'mobile' | 'compact';
  onInitialCommentsLoaded?: () => void;
}

export default function RWAForumReal({
  listingId,
  listingTitle = "King Solomon's Baby",
  // isLive = true,
  variant = 'default',
  onInitialCommentsLoaded,
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
  const hasAnnouncedInitialLoad = useRef(false);

  const isMobileVariant = variant === 'mobile';
  const isCompactVariant = variant === 'compact';

  const usernameColorPalette = [
    '#A7F3D0',
    '#BFDBFE',
    '#FDE68A',
    '#FBCFE8',
    '#C4B5FD',
    '#FCA5A5',
    '#99F6E4',
    '#F9A8D4',
  ];

  const getUsernameColor = (name: string) => {
    if (!name) return '#D0B284';
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % usernameColorPalette.length;
    return usernameColorPalette[index];
  };

  const formatCompactTimestamp = (isoDate: string) => {
    const now = Date.now();
    const created = new Date(isoDate).getTime();
    const diffSeconds = Math.max(1, Math.floor((now - created) / 1000));

    if (diffSeconds < 60) return `${diffSeconds}s`;
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes}m`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d`;
    const diffWeeks = Math.floor(diffDays / 7);
    if (diffWeeks < 4) return `${diffWeeks}w`;
    const diffMonths = Math.floor(diffDays / 30);
    if (diffMonths < 12) return `${diffMonths}mo`;
    const diffYears = Math.floor(diffDays / 365);
    return `${diffYears}y`;
  };

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

  useEffect(() => {
    hasAnnouncedInitialLoad.current = false;
  }, [listingId]);

  useEffect(() => {
    if (fetching) return;
    if (hasAnnouncedInitialLoad.current) return;
    hasAnnouncedInitialLoad.current = true;
    onInitialCommentsLoaded?.();
  }, [fetching, onInitialCommentsLoaded]);

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

  const formatAddress = (address?: string | null) => {
    if (!address) return null;
    return address.length <= 10 ? address : `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getDisplayName = (comment: Comment) => {
    const username = comment.author.username?.trim();
    if (username) {
      return username.toLowerCase().startsWith('0x') && username.length > 7
        ? `${username.slice(0, 7)}…`
        : username;
    }

    return formatAddress(comment.author.walletAddress) || 'Anonymous';
  };

  const renderComment = (comment: Comment, depth = 0, path: number[] = []) => {
    const displayName = getDisplayName(comment);
    if (isMobileVariant) {
      const initial = displayName.charAt(0).toUpperCase() || 'A';

      return (
        <div
          key={comment.id}
          className={`${depth > 0 ? 'ml-8 border-l border-[#151c16]/90 pl-4' : ''}`}
        >
          <div className="py-4 px-2 border-b border-[#202c20]/80 last:border-b-0">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#D0B284] to-[#184D37] flex items-center justify-center text-[#231F20] font-semibold text-xs">
                {initial}
              </div>

              <div className="flex-1 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white">{displayName}</div>
                    <div className="text-xs text-[#9AAE9A]">
                      {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleLike(comment.id, path)}
                    disabled={!isAuthenticated}
                    className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs transition-colors ${
                      comment.isLikedByUser
                        ? 'bg-[#D0B284]/20 text-[#D0B284]'
                        : 'text-[#A7B6A7] hover:text-[#D0B284]'
                    }`}
                  >
                    <Heart size={14} fill={comment.isLikedByUser ? 'currentColor' : 'none'} />
                    {comment.likeCount}
                  </button>
                </div>

                <p className="text-sm leading-relaxed text-[#DCDDCC] whitespace-pre-wrap">
                  {comment.content}
                </p>

                <div className="flex items-center gap-4 text-xs text-[#A7B6A7]">
                  {isAuthenticated && !comment.parentId && (
                    <button
                      type="button"
                      onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                      className="font-medium hover:text-white transition-colors"
                    >
                      Reply
                    </button>
                  )}
                </div>

                {replyingTo === comment.id && (
                  <div className="mt-3 space-y-2">
                    <Textarea
                      placeholder={`Reply to ${displayName}...`}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      className="bg-[#101910] border border-[#2a3b2a] text-white placeholder:text-[#8FA28F] rounded-xl text-sm min-h-[60px]"
                    />
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleSubmitReply(comment.id)}
                        disabled={!replyText.trim() || loading}
                        className="flex-1 bg-[#D0B284] hover:bg-[#D0B284]/90 text-[#231F20] text-xs font-semibold"
                      >
                        {loading ? 'Posting...' : 'Reply'}
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setReplyingTo(null);
                          setReplyText('');
                        }}
                        className="flex-1 text-[#A7B6A7] hover:text-white text-xs"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {comment.replies?.map((reply) =>
            renderComment(reply, depth + 1, [
              ...path,
              comments.findIndex((c) => c.id === comment.id),
            ]),
          )}
        </div>
      );
    }

    if (isCompactVariant) {
      const initial = displayName.charAt(0).toUpperCase() || 'A';
      const usernameColor = getUsernameColor(displayName);
      const timestamp = comment.createdAt ? formatCompactTimestamp(comment.createdAt) : '';

      return (
        <div
          key={comment.id}
          className={`${depth > 0 ? 'ml-3 border-l border-[#1C2B1C]/60 pl-2.5' : ''}`}
        >
          <div className="py-1.5 border-b border-[#141E14]/80 last:border-b-0">
            <div className="flex items-start gap-2">
              <div className="mt-0.5 h-5 w-5 flex-shrink-0 rounded-full bg-[#151D15] text-[10px] font-semibold text-[#D0B284] flex items-center justify-center">
                {initial}
              </div>
              <div className="flex-1 space-y-0.5 min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs leading-snug">
                  <span className="text-[11px] font-semibold" style={{ color: usernameColor }}>
                    {displayName}
                  </span>
                  <span className="flex-1 text-[#E8E6DD] break-words min-w-0">
                    {comment.content ? `: ${comment.content}` : ''}
                  </span>
                </div>
                {timestamp && (
                  <span className="text-[10px] uppercase tracking-wide text-[#5A685A]">
                    {timestamp}
                  </span>
                )}
              </div>
            </div>
          </div>

          {comment.replies?.map((reply) =>
            renderComment(reply, depth + 1, [
              ...path,
              comments.findIndex((c) => c.id === comment.id),
            ]),
          )}
        </div>
      );
    }

    return (
      <div
        key={comment.id}
        className={`${depth > 0 ? 'ml-8 border-l border-[#D0B284]/20 pl-4' : ''}`}
      >
        <div className="bg-[#231F20]/30 border border-[#D0B284]/20 rounded-lg p-4 mb-4">
          {/* Comment Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full border border-[#D0B284]/20 bg-gradient-to-br from-[#D0B284] to-[#184D37] flex items-center justify-center text-[#231F20] font-semibold text-xs">
                {displayName.charAt(0).toUpperCase() || 'A'}
              </div>
              <div>
                <span className="text-[#D0B284] font-semibold text-sm">{displayName}</span>
                <span className="text-[#DCDDCC] text-xs ml-2">
                  {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                </span>
              </div>
            </div>
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
          </div>

          {/* Reply Input */}
          {replyingTo === comment.id && (
            <div className="mt-4 pt-4 border-t border-[#D0B284]/20">
              <Textarea
                placeholder={`Reply to ${displayName}...`}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                className="bg-[#231F20] border-[#D0B284]/20 text-white placeholder:text-[#DCDDCC] mb-2 rounded-lg text-sm md:text-base min-h-[56px]"
                rows={3}
              />
              <div className="flex gap-2">
                <Button
                  onClick={() => handleSubmitReply(comment.id)}
                  disabled={!replyText.trim() || loading}
                  className="bg-[#D0B284] hover:bg-[#D0B284]/90 text-[#231F20] text-xs md:text-sm font-semibold px-4 py-2 min-h-[40px] md:min-h-[44px] touch-manipulation"
                >
                  {loading ? 'Posting...' : 'Reply'}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setReplyingTo(null);
                    setReplyText('');
                  }}
                  className="text-[#DCDDCC] hover:text-white text-xs md:text-sm px-4 py-2 min-h-[40px] md:min-h-[44px] touch-manipulation"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Render Replies */}
        {comment.replies?.map((reply) =>
          renderComment(reply, depth + 1, [
            ...path,
            comments.findIndex((c) => c.id === comment.id),
          ]),
        )}
      </div>
    );
  };

  const renderCommentComposer = (stackedLayout: boolean) => {
    if (isCompactVariant) {
      if (!isAuthenticated) {
        return (
          <div className="text-[11px] text-[#8FA28F] pr-6">
            Please connect your wallet to join the chat.
          </div>
        );
      }

      return (
        <div className="flex items-center gap-2 pr-6">
          <Input
            placeholder={`Share your thoughts about ${listingTitle}...`}
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            disabled={loading || !!rateLimitError}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmitComment();
              }
            }}
            className="h-9 border-[#2a3b2a] bg-[#101910] text-sm text-white placeholder:text-[#8FA28F] focus-visible:text-white"
          />
          <Button
            onClick={handleSubmitComment}
            disabled={!newComment.trim() || loading || !!rateLimitError}
            className="w-8 h-8 rounded-full bg-[#D0B284] hover:bg-[#D0B284]/90 text-[#231F20] p-0"
            aria-label="Post comment"
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ArrowUpRight className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      );
    }

    if (!isAuthenticated) {
      if (stackedLayout) {
        return (
          <div className="rounded-xl border border-dashed border-[#2a3b2a] bg-[#101910] px-4 py-3 text-center text-sm text-[#A7B6A7]">
            Please connect your wallet to join the discussion
          </div>
        );
      }

      return (
        <div className="text-center text-[#DCDDCC] text-sm">
          Please connect your wallet to join the discussion
        </div>
      );
    }

    if (stackedLayout) {
      return (
        <div className="space-y-3">
          <Textarea
            placeholder={`Add a comment about ${listingTitle}...`}
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            disabled={loading || !!rateLimitError}
            className="w-full rounded-2xl border border-[#2a3b2a] bg-[#101910] px-4 py-3 text-sm text-white placeholder:text-[#8FA28F] min-h-[56px]"
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = Math.min(target.scrollHeight, 200) + 'px';
            }}
          />
          <Button
            onClick={handleSubmitComment}
            disabled={!newComment.trim() || loading || !!rateLimitError}
            className="w-full rounded-xl bg-[#D0B284] hover:bg-[#D0B284]/90 text-[#231F20] text-sm font-semibold py-3"
          >
            {loading ? 'Posting...' : 'Post Comment'}
          </Button>
        </div>
      );
    }

    return (
      <div className="flex gap-3 items-end w-full">
        <Textarea
          placeholder={`Share your thoughts about ${listingTitle}...`}
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          disabled={loading || !!rateLimitError}
          className="flex-1 bg-black border-[#D0B284]/20 text-white placeholder:text-[#DCDDCC] resize-none min-h-[72px] max-h-[220px] overflow-y-auto rounded-lg text-sm md:text-base"
          style={{
            height: 'auto',
            minHeight: '72px',
            maxHeight: '220px',
          }}
          onInput={(e) => {
            const target = e.target as HTMLTextAreaElement;
            target.style.height = 'auto';
            target.style.height = Math.min(target.scrollHeight, 220) + 'px';
          }}
        />
        <Button
          onClick={handleSubmitComment}
          disabled={!newComment.trim() || loading || !!rateLimitError}
          className="bg-[#D0B284] hover:bg-[#D0B284]/90 text-[#231F20] font-semibold px-5 py-2 h-auto self-end min-h-[44px] md:min-h-[48px] touch-manipulation"
        >
          {loading ? 'Posting...' : 'Post Comment'}
        </Button>
      </div>
    );
  };

  // Show loading state
  if (fetching && comments.length === 0) {
    if (isMobileVariant) {
      return (
        <div className="bg-black rounded-lg border border-[#D0B284]/20 p-6 text-center text-[#D0B284] text-sm">
          Loading comments...
        </div>
      );
    }

    if (isCompactVariant) {
      return (
        <div className="h-full bg-black flex items-center justify-center text-[#D0B284] text-xs">
          Loading chat...
        </div>
      );
    }

    return (
      <div className="h-full bg-black relative flex flex-col">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-[#D0B284] text-lg">Loading comments...</div>
        </div>
      </div>
    );
  }

  if (isMobileVariant) {
    return (
      <div className="space-y-4 px-2">
        {error && (
          <div className="rounded-md border border-red-500/20 bg-red-900/20 px-3 py-2 text-xs text-red-300">
            {error}
          </div>
        )}
        {rateLimitError && (
          <div className="rounded-md border border-yellow-500/20 bg-yellow-900/20 px-3 py-2 text-xs text-yellow-200">
            {rateLimitError}
            {retryAfter && ` Please wait ${retryAfter} seconds.`}
          </div>
        )}

        {renderCommentComposer(true)}

        <div className="space-y-2">
          {comments.length === 0 ? (
            <div className="text-center text-[#DCDDCC] text-sm py-6">
              No comments yet. Be the first to comment!
            </div>
          ) : (
            comments.map((comment, index) => renderComment(comment, 0, [index]))
          )}
        </div>
      </div>
    );
  }

  if (isCompactVariant) {
    return (
      <div className="flex h-full flex-col bg-[#151c16]/80">
        {(error || rateLimitError) && (
          <div className="px-3 py-2 space-y-1 border-b border-[#2a3b2a]/60">
            {error && <div className="text-[11px] text-red-300">{error}</div>}
            {rateLimitError && (
              <div className="text-[11px] text-yellow-300">
                {rateLimitError}
                {retryAfter && ` Please wait ${retryAfter} seconds.`}
              </div>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5 scrollbar-thin scrollbar-thumb-[#D0B284]/60 scrollbar-track-transparent">
          {comments.length === 0 ? (
            <div className="text-center text-[11px] text-[#8FA28F] py-4">
              No comments yet. Be the first to comment!
            </div>
          ) : (
            comments.map((comment, index) => renderComment(comment, 0, [index]))
          )}
        </div>

        <div className="border-t border-[#2a3b2a]/60 bg-[#0C120C] px-3 py-2">
          {renderCommentComposer(false)}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-black relative flex flex-col">
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
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-[#D0B284] scrollbar-track-black/60 pb-32">
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
      <div className="absolute bottom-0 left-0 right-0 border-t border-[#D0B284]/20 bg-black z-10 p-4">
        {renderCommentComposer(false)}
      </div>
    </div>
  );
}
