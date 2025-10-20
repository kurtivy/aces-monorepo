import type { FastifyInstance } from 'fastify';
import { ProductStorageService } from '../../lib/product-storage-utils';
import { randomUUID } from 'crypto';

export default async function productImagesRoutes(fastify: FastifyInstance) {
  // Upload product image endpoint
  fastify.post(
    '/upload',
    {
      preHandler: fastify.authenticate,
      schema: {
        consumes: ['multipart/form-data'],
        description: 'Upload a product image',
        tags: ['Product Images'],
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              imageUrl: { type: 'string' },
              fileName: { type: 'string' },
            },
          },
          400: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              error: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        // Check if file was uploaded
        const data = await request.file();

        if (!data) {
          return reply.status(400).send({
            success: false,
            error: 'No file uploaded',
          });
        }

        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (!allowedTypes.includes(data.mimetype)) {
          return reply.status(400).send({
            success: false,
            error: 'Invalid file type. Only JPEG, PNG, and WebP images are allowed.',
          });
        }

        // Check file size (2MB limit)
        const MAX_SIZE = 2 * 1024 * 1024; // 2MB
        const buffer = await data.toBuffer();

        if (buffer.length > MAX_SIZE) {
          return reply.status(400).send({
            success: false,
            error: 'File size exceeds 2MB limit.',
          });
        }

        // Generate unique filename
        const fileExtension = data.mimetype.split('/')[1];
        const fileName = `${randomUUID()}.${fileExtension}`;

        // Upload to Google Cloud Storage
        const bucket = ProductStorageService.getProductBucket();
        const file = bucket.file(fileName);

        await file.save(buffer, {
          metadata: {
            contentType: data.mimetype,
          },
        });

        // Generate public URL (bucket has uniform bucket-level access enabled)
        const imageUrl = ProductStorageService.getProductUrl(fileName);

        return reply.send({
          success: true,
          imageUrl,
          fileName,
        });
      } catch (error) {
        console.error('Error uploading product image:', error);
        return reply.status(500).send({
          success: false,
          error: 'Failed to upload image',
        });
      }
    },
  );

  // Delete product image endpoint
  fastify.delete(
    '/:fileName',
    {
      preHandler: fastify.authenticate,
      schema: {
        description: 'Delete a product image',
        tags: ['Product Images'],
        params: {
          type: 'object',
          properties: {
            fileName: { type: 'string' },
          },
          required: ['fileName'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
            },
          },
          400: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              error: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { fileName } = request.params as { fileName: string };

        // Delete from Google Cloud Storage
        const bucket = ProductStorageService.getProductBucket();
        const file = bucket.file(fileName);

        const [exists] = await file.exists();
        if (!exists) {
          return reply.status(404).send({
            success: false,
            error: 'File not found',
          });
        }

        await file.delete();

        return reply.send({
          success: true,
          message: 'Image deleted successfully',
        });
      } catch (error) {
        console.error('Error deleting product image:', error);
        return reply.status(500).send({
          success: false,
          error: 'Failed to delete image',
        });
      }
    },
  );
}
