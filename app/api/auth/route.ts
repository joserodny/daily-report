import { NextRequest, NextResponse } from "next/server";
import { deleteGoogleAccount, readGoogleAccount, requireSession, sessionCookie } from "../../lib/mail";

export async function GET(request: NextRequest) {
  const owner = requireSession(request);
  if (owner instanceof Response) return Response.json({ email: null, name: null });
  try {
    const account = await readGoogleAccount(owner);
    return Response.json({ email: account?.email ?? null, name: account?.name ?? null });
  } catch (error) {
    return Response.json({ email: null, name: null, error: (error as Error).message });
  }
}

export async function DELETE(request: NextRequest) {
  const owner = requireSession(request);
  if (owner instanceof Response) return owner;
  await deleteGoogleAccount(owner);
  const response = NextResponse.json({ email: null });
  response.cookies.delete(sessionCookie);
  return response;
}
