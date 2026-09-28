import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { adminWriteGuard, failure } from "@/lib/http";
import { supplierSchema } from "@/lib/validation";
export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}){const guard=await adminWriteGuard();if(guard)return guard;try{const {id}=await params;const data=supplierSchema.partial().parse(await req.json());const supplier=await db.supplier.update({where:{id},data});return NextResponse.json({id:supplier.id});}catch(error){return failure(error)}}
