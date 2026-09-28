import { redirect } from "next/navigation";
import { LayoutDashboard, Inbox, Building2, Users, BookOpen, Coins, Star } from "lucide-react";
import { getAdmin } from "@/lib/auth";
import { LogoutButton } from "@/components/logout-button";
import { Brand } from "@/components/brand";
import { ActiveNavLink } from "@/components/active-nav-link";
export const dynamic="force-dynamic";
export const metadata={title:"MaqamStay Admin",robots:{index:false,follow:false}};
const nav=[{href:"/admin",label:"Dashboard",icon:LayoutDashboard},{href:"/admin/requests",label:"Requests",icon:Inbox},{href:"/admin/suppliers",label:"Suppliers",icon:Building2},{href:"/admin/customers",label:"Customers",icon:Users},{href:"/admin/bookings",label:"Bookings",icon:BookOpen},{href:"/admin/reviews",label:"Reviews",icon:Star},{href:"/admin/commissions",label:"Commissions",icon:Coins}];
export default async function AdminLayout({children}:{children:React.ReactNode}){
  const admin=await getAdmin();
  if(!admin)redirect("/admin/login");
  return <div className="ms-admin-shell"><header className="ms-admin-header"><div className="container ms-admin-header-row"><Brand compact/><span className="ms-admin-workspace-label">OPERATIONS WORKSPACE</span><nav className="ms-admin-nav" aria-label="Admin navigation">{nav.map(item=><ActiveNavLink href={item.href} exact={item.href==="/admin"} key={item.href}><item.icon size={15}/>{item.label}</ActiveNavLink>)}</nav><div className="ms-admin-account"><span>{admin.name}</span><LogoutButton/></div></div></header><nav className="ms-admin-mobile-nav" aria-label="Admin navigation">{nav.map(item=><ActiveNavLink href={item.href} exact={item.href==="/admin"} key={item.href}>{item.label}</ActiveNavLink>)}</nav><div className="admin-main">{children}</div></div>;
}
