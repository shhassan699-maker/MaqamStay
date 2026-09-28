import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, validOrigin } from "@/lib/auth";
import { rateLimited } from "@/lib/rate-limit";
const schema=z.object({email:z.email(),password:z.string().min(1)});
export async function POST(req:Request){if(!await validOrigin())return NextResponse.json({error:"Invalid origin"},{status:403});if(await rateLimited("login",10,15))return NextResponse.json({error:"Too many attempts. Try again later."},{status:429});const parsed=schema.safeParse(await req.json().catch(()=>null));if(!parsed.success)return NextResponse.json({error:"Invalid credentials"},{status:401});const admin=await db.adminUser.findUnique({where:{email:parsed.data.email.toLowerCase()}});if(!admin||!admin.active||!await bcrypt.compare(parsed.data.password,admin.passwordHash))return NextResponse.json({error:"Invalid credentials"},{status:401});await createSession(admin.id);return NextResponse.json({ok:true});}
