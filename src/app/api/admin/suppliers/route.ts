import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { adminWriteGuard, failure } from "@/lib/http";
import { supplierSchema } from "@/lib/validation";
export async function POST(req:Request){const guard=await adminWriteGuard();if(guard)return guard;try{const data=supplierSchema.parse(await req.json());const supplier=await db.supplier.create({data:{...data,email:data.email||null}});return NextResponse.json({id:supplier.id},{status:201});}catch(error){return failure(error)}}
