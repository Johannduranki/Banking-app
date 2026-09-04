import { createHash } from "node:crypto";
import { mkdir,readFile,rm,writeFile } from "node:fs/promises";
import path from "node:path";
import type { ObjectStorageProvider,PutObjectRequest,RetrievedObject,StoredObject } from "./object-storage-provider.js";

type ObjectMetadata={contentType:string;metadata:Record<string,string>};

export class LocalObjectStorageProvider implements ObjectStorageProvider{
  readonly name="local";
  constructor(private readonly rootPath:string){}
  private resolve(key:string,suffix=""){
    const normalized=key.replaceAll("\\","/").replace(/^\/+/,"");
    if(!normalized||normalized.split("/").some(part=>part===".."||part==="."))throw new Error("Invalid object key");
    const root=path.resolve(this.rootPath),target=path.resolve(root,`${normalized}${suffix}`);
    if(!target.startsWith(`${root}${path.sep}`))throw new Error("Invalid object key");
    return target;
  }
  async putObject(request:PutObjectRequest):Promise<StoredObject>{
    const objectPath=this.resolve(request.key),metadataPath=this.resolve(request.key,".metadata.json");
    await mkdir(path.dirname(objectPath),{recursive:true});
    await writeFile(objectPath,request.body,{flag:"wx"});
    await writeFile(metadataPath,JSON.stringify({contentType:request.contentType,metadata:request.metadata||{}} satisfies ObjectMetadata),{flag:"wx"});
    return{provider:this.name,key:request.key,size:request.body.length,checksumSha256:createHash("sha256").update(request.body).digest("hex")};
  }
  async getObject(key:string):Promise<RetrievedObject|null>{
    try{const[body,metadata]=await Promise.all([readFile(this.resolve(key)),readFile(this.resolve(key,".metadata.json"),"utf8")]);const parsed=JSON.parse(metadata) as ObjectMetadata;return{body,contentType:parsed.contentType,metadata:parsed.metadata};}catch(error:any){if(error?.code==="ENOENT")return null;throw error;}
  }
  async deleteObject(key:string){await Promise.all([rm(this.resolve(key),{force:true}),rm(this.resolve(key,".metadata.json"),{force:true})]);}
}
