import {config} from './vault-config.js';
let activeKey=null,revision=0;
const urls=new Map();
const bytes=value=>Uint8Array.from(atob(value),c=>c.charCodeAt(0));
async function fetchBytes(file){
 const response=await fetch(new URL(file,import.meta.url));
 if(!response.ok)throw new Error('The file could not load. Please check your connection and try again.');
 return new Uint8Array(await response.arrayBuffer());
}
async function decrypt(data,key,file){return crypto.subtle.decrypt({name:'AES-GCM',iv:data.slice(0,12),additionalData:new TextEncoder().encode(file)},key,data.slice(12));}
export async function unlock(password){
 if(!globalThis.crypto?.subtle)throw new Error('Please open this page in a current browser over HTTPS.');
 const epoch=revision;
 const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveKey']);
 const key=await crypto.subtle.deriveKey({name:'PBKDF2',salt:bytes(config.salt),iterations:config.iterations,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['decrypt']);
 const data=await fetchBytes(config.gate);
 let text;
 try{text=new TextDecoder().decode(await decrypt(data,key,config.gate));}catch{throw new Error('Please check the password and try again.');}
 if(text!=='Aesthetic Design course access v1')throw new Error('Please check the password and try again.');
 if(epoch!==revision)throw new Error('Access was locked. Please unlock again.');
 activeKey=key;
}
export async function assetURL(id){
 if(!activeKey)throw new Error('Enter the course password to continue.');
 if(urls.has(id))return urls.get(id);
 const item=config.assets[id];if(!item)throw new Error('This file is unavailable.');
 const epoch=revision,key=activeKey;
 const raw=await decrypt(await fetchBytes(item.file),key,item.file);
 if(epoch!==revision||!activeKey)throw new Error('Access was locked. Please unlock again.');
 if(urls.has(id))return urls.get(id);
 const url=URL.createObjectURL(new Blob([raw],{type:item.mime}));urls.set(id,url);return url;
}
export function filename(id){return config.assets[id]?.filename||id;}
export function clearAccess(){revision++;activeKey=null;for(const url of urls.values())URL.revokeObjectURL(url);urls.clear();}
