import { config } from "../../config.js";
import { LocalObjectStorageProvider } from "./local-object-storage-provider.js";
import type { ObjectStorageProvider } from "./object-storage-provider.js";
import { S3ObjectStorageProvider } from "./s3-object-storage-provider.js";

export function createObjectStorageProvider(provider=config.OBJECT_STORAGE_PROVIDER):ObjectStorageProvider{
  if(provider==="local")return new LocalObjectStorageProvider(config.LOCAL_OBJECT_STORAGE_PATH);
  if(provider==="s3")return new S3ObjectStorageProvider();
  throw new Error(`Unsupported object storage provider: ${provider satisfies never}`);
}
export const objectStorageProvider=createObjectStorageProvider();
