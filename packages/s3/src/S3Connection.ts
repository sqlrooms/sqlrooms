export type S3Config = {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  bucket: string;
  name?: string; // Optional for saving
  sessionToken?: string; // Optional for temporary credentials
};

// saved S3 connection
export type S3Connection = {
  name: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  bucket: string;
  sessionToken?: string;
  id: string;
  createdAt: string;
  updatedAt: string;
};
