import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
const db=new PrismaClient();
async function main(){const email=process.env.ADMIN_EMAIL?.trim().toLowerCase(),password=process.env.ADMIN_PASSWORD,name=process.env.ADMIN_NAME?.trim()||"MaqamStay Admin";if(!email||!password||password.length<14)throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD (at least 14 characters) in your environment.");const passwordHash=await bcrypt.hash(password,12);await db.adminUser.upsert({where:{email},create:{email,name,passwordHash},update:{name,passwordHash,active:true}});console.log(`Admin account ready: ${email}`)}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>db.$disconnect());
