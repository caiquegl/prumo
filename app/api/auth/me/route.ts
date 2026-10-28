import { NextResponse } from "next/server";
import { adminPasswordConfigured, isAdminRequest } from "@/lib/admin/auth";

export async function GET() {
  const ok = await isAdminRequest();
  return NextResponse.json({
    ok,
    configured: adminPasswordConfigured(),
  });
}
