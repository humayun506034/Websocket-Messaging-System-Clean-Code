// import { ConfigService } from '@nestjs/config';
// import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// type UploadResult = {
//   fileUrl: string;
//   filePath: string;
//   fileName: string;
//   originalName: string;
// };

// // ------------------ S3 Client Singleton ------------------
// let s3Client: S3Client | undefined;
// const getS3Client = (configService: ConfigService) => {
//   if (!s3Client) {
//     const endpoint = configService.get<string>('SUPABASE_S3_ENDPOINT');
//     const region = configService.get<string>('SUPABASE_S3_REGION');
//     const accessKeyId = configService.get<string>('SUPABASE_S3_ACCESS_KEY');
//     const secretAccessKey = configService.get<string>('SUPABASE_S3_SECRET_KEY');

//     if (!endpoint || !region || !accessKeyId || !secretAccessKey) {
//       throw new Error('Supabase S3 environment variables missing');
//     }

//     s3Client = new S3Client({
//       endpoint,
//       region,
//       credentials: { accessKeyId, secretAccessKey },
//       forcePathStyle: true,
//     });
//   }
//   return s3Client;
// };

// // ------------------ Upload Helper ------------------
// interface UploadOptions {
//   folder?: string;       // folder path inside bucket
//   returnMetadata?: boolean; // true -> return full metadata, false -> only URL
// }

// /**
//  * Upload file to Supabase S3-compatible storage
//  */
// export const uploadFileToS3 = async (
//   file: Express.Multer.File,
//   configService: ConfigService,
//   options: UploadOptions = {},
// ): Promise<string | UploadResult> => {
//   if (!file?.buffer) throw new Error('File not provided');

//   const folder = options.folder || 'files';
//   const returnMetadata = options.returnMetadata ?? false;

//   const s3 = getS3Client(configService);
//   const safeFileName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '');
//   const filePath = `${folder}/${Date.now()}-${safeFileName}`;

//   const bucket = configService.get<string>('SUPABASE_BUCKET');
//   if (!bucket) throw new Error('Supabase bucket not configured');

//   await s3.send(
//     new PutObjectCommand({
//       Bucket: bucket,
//       Key: filePath,
//       Body: file.buffer,
//       ContentType: file.mimetype || 'application/octet-stream',
//     }),
//   );

//   const endpoint = configService.get<string>('SUPABASE_S3_ENDPOINT')!;
//   const fileUrl = `${endpoint}/${bucket}/${filePath}`;

//   if (returnMetadata) {
//     return {
//       fileUrl,
//       filePath,
//       fileName: safeFileName,
//       originalName: file.originalname,
//     };
//   }

//   return fileUrl;
// };




import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

type UploadResult = {
  fileUrl: string;
  filePath: string;
  fileName: string;
  originalName: string;
};

interface UploadOptions {
  folder?: string;            // folder inside bucket
  returnMetadata?: boolean;    // true → return full metadata, false → only URL
  expiresIn?: number;          // seconds for signed URL (private bucket)
}

/**
 * Upload file to S3-compatible storage (Supabase S3 or AWS S3)
 */
export const uploadFileToS3 = async (
  file: Express.Multer.File,
  configService: ConfigService,
  options: UploadOptions = {},
): Promise<string | UploadResult> => {
  if (!file?.buffer) throw new Error('File not provided');

  const folder = options.folder || 'files';
  const returnMetadata = options.returnMetadata ?? false;
  const expiresIn = options.expiresIn ?? 3600;

  // ------------------ S3 Client ------------------
  const endpoint = configService.get<string>('SUPABASE_S3_ENDPOINT');
  const region = configService.get<string>('SUPABASE_S3_REGION');
  const accessKeyId = configService.get<string>('SUPABASE_S3_ACCESS_KEY');
  const secretAccessKey = configService.get<string>('SUPABASE_S3_SECRET_KEY');
  const bucket = configService.get<string>('SUPABASE_BUCKET');

  if (!endpoint || !region || !accessKeyId || !secretAccessKey || !bucket)
    throw new Error('S3 environment variables missing');

  const s3 = new S3Client({
    endpoint,
    region,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true, // Required for Supabase S3
  });

  // ------------------ Prepare File ------------------
  const safeFileName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '');
  const filePath = `${folder}/${Date.now()}-${safeFileName}`;

  // ------------------ Upload ------------------
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: filePath,
      Body: file.buffer,
      ContentType: file.mimetype || 'application/octet-stream',
    }),
  );

  // ------------------ Generate URL ------------------
  let fileUrl: string;

  // Public bucket → direct URL
  if (configService.get<boolean>('S3_BUCKET_PUBLIC')) {
    fileUrl = `${endpoint}/${bucket}/${filePath}`;
  } else {
    // Private bucket → signed URL
    fileUrl = await getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: bucket, Key: filePath }),
      { expiresIn },
    );
  }

  if (returnMetadata) {
    return {
      fileUrl,
      filePath,
      fileName: safeFileName,
      originalName: file.originalname,
    };
  }

  return fileUrl;
};
