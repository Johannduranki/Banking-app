const API_ORIGIN = process.env.NEXT_PUBLIC_API_ORIGIN || "http://localhost:3001";

export async function api<T>(path:string, options:RequestInit={}):Promise<T>{
  const method=(options.method||"GET").toUpperCase(),mutation=!['GET','HEAD','OPTIONS'].includes(method);
  const request=()=>fetch(`${API_ORIGIN}${path}`,{
    ...options,
    credentials:"include",
    headers:{"Content-Type":"application/json",...(mutation?{"X-CSRF-Protection":"1"}:{}),...(options.headers||{})},
  });
  let response=await request();
  if(response.status===401&&!path.startsWith("/api/auth/")){
    const refreshed=await fetch(`${API_ORIGIN}/api/auth/refresh`,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json","X-CSRF-Protection":"1"}});
    if(refreshed.ok)response=await request();
  }
  if(response.status===204)return undefined as T;
  const body=await response.json().catch(()=>({message:"The banking service returned an invalid response."}));
  if(!response.ok)throw new Error(body.message||"The banking service could not complete the request.");
  return body as T;
}

export { API_ORIGIN };
