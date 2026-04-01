import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    message: "API route loaded successfully",
    timestamp: new Date().toISOString(),
    items: [
      { id: 1, name: "Alpha" },
      { id: 2, name: "Bravo" },
      { id: 3, name: "Charlie" },
    ],
  });
}
