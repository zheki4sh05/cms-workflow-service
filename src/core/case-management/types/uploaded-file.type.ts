export interface UploadedFile {
  buffer: Buffer;
  size: number;
  mimetype?: string;
  originalname?: string;
}
