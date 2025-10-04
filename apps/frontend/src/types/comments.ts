// types/comments.ts
export interface Comment {
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
  replies?: Comment[];
}

export interface CreateCommentData {
  content: string;
  listingId: string;
  parentId?: string;
}

export interface CommentResponse {
  success: boolean;
  data: Comment | Comment[];
  error?: string;
}

export interface LikeResponse {
  success: boolean;
  data: {
    liked: boolean;
    newCount: number;
  };
  error?: string;
}
