import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import Dashboard from "@/components/Dashboard";
export default async function Painel() { const session = await getSession(); if (!session) redirect("/"); return <Dashboard session={session} />; }
