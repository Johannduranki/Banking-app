import type { ObjectStorageProvider,PutObjectRequest } from "./object-storage-provider.js";

/** Production placeholder. Add the approved S3-compatible SDK and credentials before selecting this provider. */
export class S3ObjectStorageProvider implements ObjectStorageProvider{
  readonly name="s3";
  private unavailable():never{throw Object.assign(new Error("S3 object storage is not configured"),{status:503});}
  async putObject(_request:PutObjectRequest){return this.unavailable();}
  async getObject(_key:string){return this.unavailable();}
  async deleteObject(_key:string){return this.unavailable();}
}
