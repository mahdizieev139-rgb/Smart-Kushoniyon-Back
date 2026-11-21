/**
 * Product image service.
 *
 * Images are uploaded through the storage abstraction (local disk or S3). We
 * store the public URL + the storage key in the database. The storage key lets
 * us delete the real file later.
 *
 * Ownership: only members of the product's shop (or admins) may add/remove
 * images. We re-check this here, in the service, for every operation.
 */
import { prisma } from '../../config/database';
import { storage } from '../../config/storage';
import { ApiError } from '../../utils/api-error';
import { shopMemberService } from '../shop-members/shop-member.service';

interface UploadedFile {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
}

async function assertProductAccess(productId: string, actor: { id: string; role: string }) {
  const product = await prisma.product.findFirst({
    where: { id: productId, deletedAt: null },
    select: { id: true, shopId: true },
  });
  if (!product) throw ApiError.notFound('Product');
  // role is a UserRole at runtime; cast is safe because it comes from req.user.
  await shopMemberService.assertShopAccess(actor.id, actor.role as never, product.shopId);
  return product;
}

async function list(productId: string) {
  return prisma.productImage.findMany({
    where: { productId },
    orderBy: { sortOrder: 'asc' },
  });
}

async function upload(
  productId: string,
  files: UploadedFile[],
  actor: { id: string; role: string },
) {
  if (!files || files.length === 0) throw ApiError.badRequest('No image files provided');

  await assertProductAccess(productId, actor);

  // Current max sortOrder so new images append to the end.
  const last = await prisma.productImage.findFirst({
    where: { productId },
    orderBy: { sortOrder: 'desc' },
    select: { sortOrder: true },
  });
  let nextOrder = (last?.sortOrder ?? -1) + 1;

  const created = [];
  for (const file of files) {
    const { storageKey, imageUrl } = await storage.upload({
      buffer: file.buffer,
      mimeType: file.mimetype,
      originalName: file.originalname,
      folder: 'products',
    });

    const image = await prisma.productImage.create({
      data: { productId, imageUrl, storageKey, sortOrder: nextOrder },
    });
    created.push(image);
    nextOrder += 1;
  }

  return created;
}

async function remove(productId: string, imageId: string, actor: { id: string; role: string }) {
  await assertProductAccess(productId, actor);

  const image = await prisma.productImage.findFirst({ where: { id: imageId, productId } });
  if (!image) throw ApiError.notFound('Image');

  // Delete the DB row first, then best-effort delete the stored file.
  await prisma.productImage.delete({ where: { id: image.id } });
  await storage.delete(image.storageKey);
}

export const productImageService = { list, upload, remove };
