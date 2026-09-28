import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getAdmin } from "@/lib/auth";
import { adminWriteGuard, failure } from "@/lib/http";
export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){const guard=await adminWriteGuard();if(guard)return guard;const admin=(await getAdmin())!;try{const {id}=await params;const {body}=z.object({body:z.string().trim().min(1).max(2000)}).parse(await req.json());if(!await db.accommodationRequest.findUnique({where:{id},select:{id:true}}))return NextResponse.json({error:"Request not found"},{status:404});const note=await db.adminNote.create({data:{requestId:id,authorId:admin.id,body}});return NextResponse.json({id:note.id},{status:201});}catch(error){return failure(error)}}
