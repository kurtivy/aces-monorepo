import { CreateSubmissionRequest } from '@aces/utils';

export class SubmissionsApi {
  static async getUploadUrl(fileType: string): Promise<{
    url: string;
    fileName: string;
    publicUrl: string;
  }> {
    const response = await fetch('/submissions/get-upload-url', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fileType }),
    });

    if (!response.ok) {
      throw new Error('Failed to get upload URL');
    }

    const result = await response.json();
    return result.data;
  }

  static async uploadImage(file: File): Promise<string> {
    // Use direct upload through backend to bypass CORS
    const formData = new FormData();
    formData.append('file', file);

    const uploadResponse = await fetch('/submissions/upload-image', {
      method: 'POST',
      body: formData,
    });

    if (!uploadResponse.ok) {
      const errorData = await uploadResponse.json();
      throw new Error(errorData.error || 'Failed to upload image');
    }

    const result = await uploadResponse.json();
    return result.data.publicUrl;
  }

  static async createTestSubmission(data: CreateSubmissionRequest) {
    const response = await fetch('/submissions/test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    return response.json();
  }
}
