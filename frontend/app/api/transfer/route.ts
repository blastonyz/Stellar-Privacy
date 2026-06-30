import { NextResponse } from "next/server";
import { runProtocol } from "@/lib/server/run-protocol";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      from?: string;
      to?: string;
      amount?: string;
      babyJubSk?: string;
      fromBalance?: string;
      toBalance?: string;
    };

    if (!body.from || !body.to || !body.amount || !body.babyJubSk) {
      return NextResponse.json(
        { error: "Missing from, to, amount, or babyJubSk" },
        { status: 400 },
      );
    }

    const result = await runProtocol("transfer", {
      from: body.from,
      to: body.to,
      amount: body.amount,
      babyJubSk: body.babyJubSk,
      fromBalance: body.fromBalance,
      toBalance: body.toBalance,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
