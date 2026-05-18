// @vitest-environment node
import { describe, test, expect, vi, beforeEach } from "vitest";
import { SignJWT } from "jose";
import type { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

const mockCookieStore = {
  set: vi.fn(),
  get: vi.fn(),
  delete: vi.fn(),
};

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => mockCookieStore),
}));

import { createSession, getSession, deleteSession, verifySession } from "../auth";

const TEST_SECRET = new TextEncoder().encode("development-secret-key");
const COOKIE_NAME = "auth-token";
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

async function makeToken(
  userId: string,
  email: string,
  expiresIn: string = "7d"
): Promise<string> {
  const expiresAt = new Date(Date.now() + SEVEN_DAYS_MS);
  return new SignJWT({ userId, email, expiresAt })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(expiresIn)
    .setIssuedAt()
    .sign(TEST_SECRET);
}

function makeRequest(token?: string): NextRequest {
  return {
    cookies: {
      get: (name: string) =>
        name === COOKIE_NAME && token ? { value: token } : undefined,
    },
  } as unknown as NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createSession", () => {
  test("sets an httpOnly cookie named auth-token", async () => {
    await createSession("user-1", "test@example.com");

    expect(mockCookieStore.set).toHaveBeenCalledOnce();
    const [name, , options] = mockCookieStore.set.mock.calls[0];
    expect(name).toBe(COOKIE_NAME);
    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe("lax");
    expect(options.path).toBe("/");
  });

  test("token is a non-empty string", async () => {
    await createSession("user-1", "test@example.com");

    const [, token] = mockCookieStore.set.mock.calls[0];
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(0);
  });

  test("cookie expires in approximately 7 days", async () => {
    const before = Date.now();
    await createSession("user-1", "test@example.com");
    const after = Date.now();

    const [, , options] = mockCookieStore.set.mock.calls[0];
    const expiresAt = (options.expires as Date).getTime();
    expect(expiresAt).toBeGreaterThanOrEqual(before + SEVEN_DAYS_MS - 100);
    expect(expiresAt).toBeLessThanOrEqual(after + SEVEN_DAYS_MS + 100);
  });
});

describe("getSession", () => {
  test("returns null when no cookie is present", async () => {
    mockCookieStore.get.mockReturnValue(undefined);
    expect(await getSession()).toBeNull();
  });

  test("returns null for a malformed token", async () => {
    mockCookieStore.get.mockReturnValue({ value: "not.a.jwt" });
    expect(await getSession()).toBeNull();
  });

  test("returns null for an expired token", async () => {
    const token = await makeToken("user-1", "test@example.com", "-1s");
    mockCookieStore.get.mockReturnValue({ value: token });
    expect(await getSession()).toBeNull();
  });

  test("returns session payload for a valid token", async () => {
    const token = await makeToken("user-1", "test@example.com");
    mockCookieStore.get.mockReturnValue({ value: token });

    const session = await getSession();
    expect(session).not.toBeNull();
    expect(session?.userId).toBe("user-1");
    expect(session?.email).toBe("test@example.com");
  });

  test("reads the auth-token cookie by name", async () => {
    mockCookieStore.get.mockReturnValue(undefined);
    await getSession();
    expect(mockCookieStore.get).toHaveBeenCalledWith(COOKIE_NAME);
  });
});

describe("deleteSession", () => {
  test("deletes the auth-token cookie", async () => {
    await deleteSession();
    expect(mockCookieStore.delete).toHaveBeenCalledWith(COOKIE_NAME);
  });
});

describe("verifySession", () => {
  test("returns null when no cookie in the request", async () => {
    expect(await verifySession(makeRequest())).toBeNull();
  });

  test("returns null for a malformed token", async () => {
    expect(await verifySession(makeRequest("not.a.jwt"))).toBeNull();
  });

  test("returns null for an expired token", async () => {
    const token = await makeToken("user-2", "other@example.com", "-1s");
    expect(await verifySession(makeRequest(token))).toBeNull();
  });

  test("returns session payload for a valid token", async () => {
    const token = await makeToken("user-2", "other@example.com");
    const session = await verifySession(makeRequest(token));
    expect(session?.userId).toBe("user-2");
    expect(session?.email).toBe("other@example.com");
  });
});
