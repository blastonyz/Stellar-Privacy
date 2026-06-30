import { NextResponse } from "next/server";
import { runProtocol } from "@/lib/server/run-protocol";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { address?: string };
    if (!body.address) {
      return NextResponse.json({ error: "Missing address" }, { status: 400 });
    }

    const result = await runProtocol("register", { address: body.address });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
