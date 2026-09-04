export interface PutObjectRequest{key:string;body:Buffer;contentType:string;metadata?:Record<string,string>;}
export interface StoredObject{provider:string;key:string;size:number;checksumSha256:string;}
export interface RetrievedObject{body:Buffer;contentType:string;metadata:Record<string,string>;}

export interface ObjectStorageProvider{
  readonly name:string;
  putObject(request:PutObjectRequest):Promise<StoredObject>;
  getObject(key:string):Promise<RetrievedObject|null>;
  deleteObject(key:string):Promise<void>;
}
