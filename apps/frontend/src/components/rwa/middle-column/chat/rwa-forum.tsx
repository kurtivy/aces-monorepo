'use client';

import { useState } from 'react';
import { Heart, MessageCircle, Share, MoreHorizontal, ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import Image from 'next/image';

interface Comment {
  id: string;
  author: string;
  avatar: string;
  content: string;
  timestamp: string;
  likes: number;
  replies: Comment[];
  isLiked?: boolean;
  upvotes: number;
  downvotes: number;
  userVote?: 'up' | 'down' | null;
}

const mockComments: Comment[] = [
  {
    id: '1',
    author: 'ArtCollector_NYC',
    avatar: '/placeholder.svg?height=40&width=40&text=AC',
    content:
      "This is absolutely revolutionary. The concept of fractionalizing King Solomon's Baby while maintaining its artistic integrity is genius. I've been collecting for 20 years and this is the future of art ownership.",
    timestamp: '2 hours ago',
    likes: 24,
    upvotes: 47,
    downvotes: 3,
    userVote: 'up',
    replies: [
      {
        id: '1-1',
        author: 'CryptoArtist',
        avatar: '/placeholder.svg?height=40&width=40&text=CA',
        content:
          'Completely agree! The blockchain verification adds a layer of authenticity that traditional art markets lack. Plus the accessibility factor is huge.',
        timestamp: '1 hour ago',
        likes: 12,
        upvotes: 23,
        downvotes: 1,
        replies: [],
      },
      {
        id: '1-2',
        author: 'SkepticalInvestor',
        avatar: '/placeholder.svg?height=40&width=40&text=SI',
        content:
          "I'm still not convinced about the long-term value retention. What happens to the physical piece during the 'division' process?",
        timestamp: '45 minutes ago',
        likes: 8,
        upvotes: 15,
        downvotes: 7,
        replies: [
          {
            id: '1-2-1',
            author: 'ArtCollector_NYC',
            avatar: '/placeholder.svg?height=40&width=40&text=AC',
            content:
              'Great question! The physical division is done by master craftsmen using precision tools. Each fragment maintains the DNA of the original while becoming a unique piece itself.',
            timestamp: '30 minutes ago',
            likes: 18,
            upvotes: 31,
            downvotes: 2,
            replies: [],
          },
        ],
      },
    ],
  },
  {
    id: '2',
    author: 'ModernArtEnthusiast',
    avatar: '/placeholder.svg?height=40&width=40&text=MA',
    content:
      "The symbolism here is incredible. King Solomon's wisdom in dividing to preserve rather than destroy... it's like the artist predicted the blockchain era. The pink Porsche aesthetic adds this beautiful contrast between classical wisdom and modern luxury.",
    timestamp: '3 hours ago',
    likes: 31,
    upvotes: 62,
    downvotes: 5,
    replies: [
      {
        id: '2-1',
        author: 'PhilosophyMajor',
        avatar: '/placeholder.svg?height=40&width=40&text=PM',
        content:
          "Exactly! It's a perfect metaphor for how ownership can be shared without diminishing value. The biblical reference adds layers of meaning that will appreciate over time.",
        timestamp: '2 hours ago',
        likes: 19,
        upvotes: 38,
        downvotes: 2,
        replies: [],
      },
    ],
  },
  {
    id: '3',
    author: 'TokenTrader_Pro',
    avatar: '/placeholder.svg?height=40&width=40&text=TT',
    content:
      "Current price action looks bullish. Volume is up 340% in the last 24h and we're seeing strong support at $45k. The tokenomics are solid with the bonding curve mechanism. DYOR but I'm bullish long-term. 🚀",
    timestamp: '4 hours ago',
    likes: 15,
    upvotes: 28,
    downvotes: 12,
    replies: [
      {
        id: '3-1',
        author: 'RiskManager',
        avatar: '/placeholder.svg?height=40&width=40&text=RM',
        content:
          'Be careful with the hype. Art markets are notoriously volatile and this is still experimental. Only invest what you can afford to lose.',
        timestamp: '3 hours ago',
        likes: 22,
        upvotes: 41,
        downvotes: 8,
        replies: [],
      },
    ],
  },
  {
    id: '4',
    author: 'GalleryOwner_LA',
    avatar: '/placeholder.svg?height=40&width=40&text=GO',
    content:
      "I've had the privilege of seeing this piece in person before the tokenization. The craftsmanship is extraordinary - every detail tells a story. The way light plays across the surface... photos don't do it justice. This is museum-quality work.",
    timestamp: '5 hours ago',
    likes: 28,
    upvotes: 53,
    downvotes: 1,
    replies: [
      {
        id: '4-1',
        author: 'ArtStudent_2024',
        avatar: '/placeholder.svg?height=40&width=40&text=AS',
        content:
          "So jealous! What was the most striking aspect in person? I'm studying contemporary sculpture and this piece is fascinating from a technical perspective.",
        timestamp: '4 hours ago',
        likes: 7,
        upvotes: 14,
        downvotes: 0,
        replies: [
          {
            id: '4-1-1',
            author: 'GalleryOwner_LA',
            avatar: '/placeholder.svg?height=40&width=40&text=GO',
            content:
              "The texture work is incredible. You can see the artist's hand in every curve. The pink finish has this depth that changes as you move around it - almost alive. It's why I believe in this tokenization model.",
            timestamp: '3 hours ago',
            likes: 12,
            upvotes: 24,
            downvotes: 0,
            replies: [],
          },
        ],
      },
    ],
  },
  {
    id: '5',
    author: 'BlockchainMaxi',
    avatar: '/placeholder.svg?height=40&width=40&text=BM',
    content:
      'This is what DeFi was meant for - democratizing access to high-value assets. No more gatekeeping by traditional auction houses. Power to the people! 💪',
    timestamp: '6 hours ago',
    likes: 19,
    upvotes: 35,
    downvotes: 18,
    replies: [
      {
        id: '5-1',
        author: 'TraditionalCollector',
        avatar: '/placeholder.svg?height=40&width=40&text=TC',
        content:
          "I appreciate the innovation, but there's something to be said for the traditional art world's curation and expertise. Not everything needs to be tokenized.",
        timestamp: '5 hours ago',
        likes: 11,
        upvotes: 22,
        downvotes: 15,
        replies: [],
      },
    ],
  },
];

export default function RWAForum() {
  const [comments, setComments] = useState<Comment[]>(mockComments);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  const handleLike = (commentId: string, path: number[] = []) => {
    setComments((prevComments) => {
      const newComments = [...prevComments];
      let current: Comment[] = newComments;

      // Navigate to the correct comment using the path
      for (let i = 0; i < path.length; i++) {
        current = current[path[i]].replies;
      }

      const commentIndex = current.findIndex((c) => c.id === commentId);
      if (commentIndex !== -1) {
        current[commentIndex] = {
          ...current[commentIndex],
          likes: current[commentIndex].isLiked
            ? current[commentIndex].likes - 1
            : current[commentIndex].likes + 1,
          isLiked: !current[commentIndex].isLiked,
        };
      }

      return newComments;
    });
  };

  const handleVote = (commentId: string, voteType: 'up' | 'down', path: number[] = []) => {
    setComments((prevComments) => {
      const newComments = [...prevComments];
      let current: Comment[] = newComments;

      for (let i = 0; i < path.length; i++) {
        current = current[path[i]].replies;
      }

      const commentIndex = current.findIndex((c) => c.id === commentId);
      if (commentIndex !== -1) {
        const comment = current[commentIndex];
        let newUpvotes = comment.upvotes;
        let newDownvotes = comment.downvotes;
        let newUserVote = comment.userVote;

        // Handle vote logic
        if (comment.userVote === voteType) {
          // Remove vote
          if (voteType === 'up') newUpvotes--;
          else newDownvotes--;
          newUserVote = null;
        } else {
          // Add new vote, remove old if exists
          if (comment.userVote === 'up') newUpvotes--;
          if (comment.userVote === 'down') newDownvotes--;

          if (voteType === 'up') newUpvotes++;
          else newDownvotes++;
          newUserVote = voteType;
        }

        current[commentIndex] = {
          ...comment,
          upvotes: newUpvotes,
          downvotes: newDownvotes,
          userVote: newUserVote,
        };
      }

      return newComments;
    });
  };

  const handleSubmitComment = () => {
    if (!newComment.trim()) return;

    const comment: Comment = {
      id: Date.now().toString(),
      author: 'You',
      avatar: '/placeholder.svg?height=40&width=40&text=Y',
      content: newComment,
      timestamp: 'Just now',
      likes: 0,
      upvotes: 1,
      downvotes: 0,
      userVote: 'up',
      replies: [],
    };

    setComments([comment, ...comments]);
    setNewComment('');
  };

  const handleSubmitReply = (parentId: string) => {
    if (!replyText.trim()) return;

    const reply: Comment = {
      id: `${parentId}-${Date.now()}`,
      author: 'You',
      avatar: '/placeholder.svg?height=40&width=40&text=Y',
      content: replyText,
      timestamp: 'Just now',
      likes: 0,
      upvotes: 1,
      downvotes: 0,
      userVote: 'up',
      replies: [],
    };

    setComments((prevComments) => {
      const newComments = [...prevComments];
      const addReplyToComment = (comments: Comment[]): Comment[] => {
        return comments.map((comment) => {
          if (comment.id === parentId) {
            return {
              ...comment,
              replies: [...comment.replies, reply],
            };
          }
          return {
            ...comment,
            replies: addReplyToComment(comment.replies),
          };
        });
      };
      return addReplyToComment(newComments);
    });

    setReplyText('');
    setReplyingTo(null);
  };

  const renderComment = (comment: Comment, depth = 0, path: number[] = []) => (
    <div
      key={comment.id}
      className={`${depth > 0 ? 'ml-8 border-l border-[#D0B284]/20 pl-4' : ''}`}
    >
      <div className="bg-[#231F20]/60 border border-[#D0B284]/20 rounded-lg p-4 mb-4">
        {/* Comment Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <Image
              src={comment.avatar || '/placeholder.svg'}
              alt={comment.author}
              className="w-8 h-8 rounded-full border border-[#D0B284]/20"
              width={32}
              height={32}
            />
            <div>
              <span className="text-[#D0B284] font-semibold text-sm">{comment.author}</span>
              <span className="text-[#DCDDCC] text-xs ml-2">{comment.timestamp}</span>
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
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleVote(comment.id, 'up', path)}
              className={`p-1 h-auto ${comment.userVote === 'up' ? 'text-[#184D37]' : 'text-[#DCDDCC] hover:text-[#184D37]'}`}
            >
              <ArrowUp size={16} />
            </Button>
            <span className="text-xs text-[#DCDDCC] min-w-[20px] text-center">
              {comment.upvotes - comment.downvotes}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleVote(comment.id, 'down', path)}
              className={`p-1 h-auto ${comment.userVote === 'down' ? 'text-red-400' : 'text-[#DCDDCC] hover:text-red-400'}`}
            >
              <ArrowDown size={16} />
            </Button>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleLike(comment.id, path)}
            className={`flex items-center gap-1 text-xs ${comment.isLiked ? 'text-red-400' : 'text-[#DCDDCC] hover:text-red-400'}`}
          >
            <Heart size={14} fill={comment.isLiked ? 'currentColor' : 'none'} />
            {comment.likes}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
            className="flex items-center gap-1 text-xs text-[#DCDDCC] hover:text-[#D0B284]"
          >
            <MessageCircle size={14} />
            Reply
          </Button>

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
              placeholder={`Reply to ${comment.author}...`}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              className="bg-[#231F20] border-[#D0B284]/20 text-white placeholder:text-[#DCDDCC] mb-2"
              rows={3}
            />
            <div className="flex gap-2">
              <Button
                onClick={() => handleSubmitReply(comment.id)}
                disabled={!replyText.trim()}
                className="bg-[#D0B284] hover:bg-[#D0B284]/90 text-[#231F20] text-xs"
              >
                Reply
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
      {comment.replies.map((reply, index) =>
        renderComment(reply, depth + 1, [...path, comments.findIndex((c) => c.id === comment.id)]),
      )}
    </div>
  );

  return (
    <div className="h-[calc(100vh-300px)] flex flex-col bg-black rounded-lg">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-[#D0B284]/20">
        <h3 className="text-white text-lg font-semibold">
          Discussion ({comments.length} comments)
        </h3>
      </div>

      {/* Comments Feed - Scrollable with constrained height */}
      <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-[#D0B284] scrollbar-track-[#231F20] min-h-0">
        <div className="space-y-4">
          {comments.map((comment, index) => renderComment(comment, 0, [index]))}
        </div>
      </div>

      {/* New Comment Section - Always visible at bottom, flush to container bottom */}
      <div className="flex-shrink-0 border-t border-[#D0B284]/20 p-4 bg-[#231F20] rounded-b-lg">
        <div className="flex gap-3 items-end">
          <Textarea
            placeholder="Share your thoughts about King Solomon's Baby..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            className="flex-1 bg-black border-[#D0B284]/20 text-white placeholder:text-[#DCDDCC] resize-none"
            rows={3}
          />
          <Button
            onClick={handleSubmitComment}
            disabled={!newComment.trim()}
            className="bg-[#D0B284] hover:bg-[#D0B284]/90 text-[#231F20] font-semibold px-6 py-2 h-auto"
          >
            Post Comment
          </Button>
        </div>
      </div>
    </div>
  );
}
