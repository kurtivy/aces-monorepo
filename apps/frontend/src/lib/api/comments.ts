// lib/api/comments.ts
import { Comment, CreateCommentData, CommentResponse, LikeResponse } from '@/types/comments';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

export class CommentsApi {
  private static async getAuthHeaders(token?: string): Promise<HeadersInit> {
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    };
  }

  static async getComments(listingId: string, authToken?: string): Promise<Comment[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/comments/${listingId}`, {
        method: 'GET',
        headers: await this.getAuthHeaders(authToken),
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch comments: ${response.statusText}`);
      }

      const result: CommentResponse = await response.json();
      return result.success ? (Array.isArray(result.data) ? result.data : [result.data]) : [];
    } catch (error) {
      console.error('Failed to fetch comments:', error);
      return [];
    }
  }

  static async createComment(
    commentData: CreateCommentData,
    authToken?: string,
  ): Promise<Comment | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/comments`, {
        method: 'POST',
        headers: await this.getAuthHeaders(authToken),
        credentials: 'include',
        body: JSON.stringify(commentData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to create comment: ${response.statusText}`);
      }

      const result: CommentResponse = await response.json();
      return result.success ? (result.data as Comment) : null;
    } catch (error) {
      console.error('Failed to create comment:', error);
      throw error;
    }
  }

  static async toggleLike(
    commentId: string,
    authToken?: string,
  ): Promise<{ liked: boolean; newCount: number } | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/comments/${commentId}/like`, {
        method: 'POST',
        headers: await this.getAuthHeaders(authToken),
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to toggle like: ${response.statusText}`);
      }

      const result: LikeResponse = await response.json();
      return result.success ? result.data : null;
    } catch (error) {
      console.error('Failed to toggle like:', error);
      throw error;
    }
  }

  static async updateUsername(
    username: string,
    authToken?: string,
  ): Promise<{ username: string | null; walletAddress: string | null } | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/comments/username`, {
        method: 'PUT',
        headers: await this.getAuthHeaders(authToken),
        credentials: 'include',
        body: JSON.stringify({ username }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to update username: ${response.statusText}`);
      }

      const result = await response.json();
      return result.success ? result.data : null;
    } catch (error) {
      console.error('Failed to update username:', error);
      throw error;
    }
  }
}
