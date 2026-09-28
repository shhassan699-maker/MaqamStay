import { redirect } from "next/navigation";
import { getAdmin } from "@/lib/auth";
import { AdminLogin } from "@/components/admin-login";
export const metadata={title:"Admin sign in | MaqamStay",robots:{index:false,follow:false}};
export const dynamic="force-dynamic";
export default async function Login(){if(await getAdmin())redirect("/admin");return <AdminLogin/>}
