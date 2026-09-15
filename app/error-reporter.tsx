"use client";
import {useEffect} from "react";
export default function ErrorReporter(){
 useEffect(()=>{
  let count=0;
  const report=(message:string)=>{if(count++>=5)return;fetch("/api/errors",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({message:message.slice(0,500),page:location.pathname,device:navigator.userAgent,severity:"medium"}),keepalive:true}).catch(()=>{})};
  const error=(event:ErrorEvent)=>report(event.message||"Client runtime error");
  const rejection=(event:PromiseRejectionEvent)=>report(event.reason instanceof Error?event.reason.message:"Unhandled promise rejection");
  window.addEventListener("error",error);window.addEventListener("unhandledrejection",rejection);
  return()=>{window.removeEventListener("error",error);window.removeEventListener("unhandledrejection",rejection)};
 },[]);
 return null;
}
