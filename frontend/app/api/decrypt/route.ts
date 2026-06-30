import { NextResponse } from "next/server";
import { runProtocol } from "@/lib/server/run-protocol";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      babyJubSk?: string;
      encryptedBalance?: unknown;
      maxBalance?: string;
    };

    if (!body.babyJubSk || !body.encryptedBalance) {
      return NextResponse.json(
        { error: "Missing babyJubSk or encryptedBalance" },
        { status: 400 },
      );
    }

    const result = await runProtocol<{ balance: string }>("decrypt", {
      babyJubSk: body.babyJubSk,
      encryptedBalance: body.encryptedBalance,
      maxBalance: body.maxBalance,
    });

    return NextResponse.json({ balance: result.balance });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
