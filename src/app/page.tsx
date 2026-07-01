import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import Login from "@/components/Login";
export default async function Home() { if (await getSession()) redirect("/painel"); return <Login />; }
