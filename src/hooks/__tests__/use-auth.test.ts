import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useAuth } from "@/hooks/use-auth";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/actions", () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("@/lib/anon-work-tracker", () => ({
  getAnonWorkData: vi.fn(),
  clearAnonWork: vi.fn(),
}));

vi.mock("@/actions/get-projects", () => ({
  getProjects: vi.fn(),
}));

vi.mock("@/actions/create-project", () => ({
  createProject: vi.fn(),
}));

import { signIn as signInAction, signUp as signUpAction } from "@/actions";
import { getAnonWorkData, clearAnonWork } from "@/lib/anon-work-tracker";
import { getProjects } from "@/actions/get-projects";
import { createProject } from "@/actions/create-project";

describe("useAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getAnonWorkData as any).mockReturnValue(null);
    (getProjects as any).mockResolvedValue([]);
    (createProject as any).mockResolvedValue({ id: "new-project-id" });
  });

  describe("initial state", () => {
    test("isLoading starts as false", () => {
      const { result } = renderHook(() => useAuth());
      expect(result.current.isLoading).toBe(false);
    });

    test("exposes signIn, signUp and isLoading", () => {
      const { result } = renderHook(() => useAuth());
      expect(typeof result.current.signIn).toBe("function");
      expect(typeof result.current.signUp).toBe("function");
      expect(typeof result.current.isLoading).toBe("boolean");
    });
  });

  describe("signIn", () => {
    test("returns the action result on failure", async () => {
      const failureResult = { success: false, error: "Invalid credentials" };
      (signInAction as any).mockResolvedValue(failureResult);

      const { result } = renderHook(() => useAuth());
      let returned: any;

      await act(async () => {
        returned = await result.current.signIn("bad@example.com", "wrongpass");
      });

      expect(returned).toEqual(failureResult);
      expect(mockPush).not.toHaveBeenCalled();
    });

    test("sets isLoading true during the call and false after", async () => {
      let resolveAction: (v: any) => void;
      (signInAction as any).mockImplementation(
        () => new Promise((res) => { resolveAction = res; })
      );

      const { result } = renderHook(() => useAuth());

      act(() => {
        result.current.signIn("user@example.com", "password");
      });

      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        resolveAction!({ success: false });
      });

      expect(result.current.isLoading).toBe(false);
    });

    test("resets isLoading to false even when the action throws", async () => {
      (signInAction as any).mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useAuth());

      await expect(
        act(async () => { await result.current.signIn("user@example.com", "pass"); })
      ).rejects.toThrow("Network error");

      expect(result.current.isLoading).toBe(false);
    });

    test("calls signInAction with the provided credentials", async () => {
      (signInAction as any).mockResolvedValue({ success: false });

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("user@example.com", "mypassword");
      });

      expect(signInAction).toHaveBeenCalledWith("user@example.com", "mypassword");
    });

    describe("post-sign-in navigation — with anonymous work", () => {
      const anonWork = {
        messages: [{ role: "user", content: "make a button" }],
        fileSystemData: { "/App.jsx": { type: "file", content: "..." } },
      };

      beforeEach(() => {
        (signInAction as any).mockResolvedValue({ success: true });
        (getAnonWorkData as any).mockReturnValue(anonWork);
        (createProject as any).mockResolvedValue({ id: "anon-project-id" });
      });

      test("creates a project with the anon work content", async () => {
        const { result } = renderHook(() => useAuth());
        await act(async () => { await result.current.signIn("u@e.com", "pass"); });

        expect(createProject).toHaveBeenCalledWith(
          expect.objectContaining({
            messages: anonWork.messages,
            data: anonWork.fileSystemData,
          })
        );
      });

      test("clears anonymous work after creating the project", async () => {
        const { result } = renderHook(() => useAuth());
        await act(async () => { await result.current.signIn("u@e.com", "pass"); });

        expect(clearAnonWork).toHaveBeenCalled();
      });

      test("redirects to the newly created project", async () => {
        const { result } = renderHook(() => useAuth());
        await act(async () => { await result.current.signIn("u@e.com", "pass"); });

        expect(mockPush).toHaveBeenCalledWith("/anon-project-id");
      });

      test("does not call getProjects when anon work exists", async () => {
        const { result } = renderHook(() => useAuth());
        await act(async () => { await result.current.signIn("u@e.com", "pass"); });

        expect(getProjects).not.toHaveBeenCalled();
      });
    });

    describe("post-sign-in navigation — anon work present but empty messages", () => {
      beforeEach(() => {
        (signInAction as any).mockResolvedValue({ success: true });
        (getAnonWorkData as any).mockReturnValue({ messages: [], fileSystemData: {} });
      });

      test("falls through to getProjects when anon messages array is empty", async () => {
        (getProjects as any).mockResolvedValue([{ id: "existing-project" }]);

        const { result } = renderHook(() => useAuth());
        await act(async () => { await result.current.signIn("u@e.com", "pass"); });

        expect(getProjects).toHaveBeenCalled();
        expect(mockPush).toHaveBeenCalledWith("/existing-project");
      });
    });

    describe("post-sign-in navigation — no anonymous work", () => {
      beforeEach(() => {
        (signInAction as any).mockResolvedValue({ success: true });
        (getAnonWorkData as any).mockReturnValue(null);
      });

      test("redirects to the most recent project when one exists", async () => {
        (getProjects as any).mockResolvedValue([
          { id: "project-1" },
          { id: "project-2" },
        ]);

        const { result } = renderHook(() => useAuth());
        await act(async () => { await result.current.signIn("u@e.com", "pass"); });

        expect(mockPush).toHaveBeenCalledWith("/project-1");
        expect(createProject).not.toHaveBeenCalled();
      });

      test("creates a new project and redirects when no projects exist", async () => {
        (getProjects as any).mockResolvedValue([]);
        (createProject as any).mockResolvedValue({ id: "brand-new-project" });

        const { result } = renderHook(() => useAuth());
        await act(async () => { await result.current.signIn("u@e.com", "pass"); });

        expect(createProject).toHaveBeenCalledWith(
          expect.objectContaining({ messages: [], data: {} })
        );
        expect(mockPush).toHaveBeenCalledWith("/brand-new-project");
      });

      test("does not call handlePostSignIn when sign in fails", async () => {
        (signInAction as any).mockResolvedValue({ success: false, error: "Bad creds" });

        const { result } = renderHook(() => useAuth());
        await act(async () => { await result.current.signIn("u@e.com", "pass"); });

        expect(getProjects).not.toHaveBeenCalled();
        expect(createProject).not.toHaveBeenCalled();
        expect(mockPush).not.toHaveBeenCalled();
      });
    });
  });

  describe("signUp", () => {
    test("returns the action result on failure", async () => {
      const failureResult = { success: false, error: "Email already registered" };
      (signUpAction as any).mockResolvedValue(failureResult);

      const { result } = renderHook(() => useAuth());
      let returned: any;

      await act(async () => {
        returned = await result.current.signUp("existing@example.com", "password");
      });

      expect(returned).toEqual(failureResult);
      expect(mockPush).not.toHaveBeenCalled();
    });

    test("calls signUpAction with the provided credentials", async () => {
      (signUpAction as any).mockResolvedValue({ success: false });

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signUp("new@example.com", "newpassword");
      });

      expect(signUpAction).toHaveBeenCalledWith("new@example.com", "newpassword");
    });

    test("sets isLoading true during the call and false after", async () => {
      let resolveAction: (v: any) => void;
      (signUpAction as any).mockImplementation(
        () => new Promise((res) => { resolveAction = res; })
      );

      const { result } = renderHook(() => useAuth());

      act(() => {
        result.current.signUp("new@example.com", "password");
      });

      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        resolveAction!({ success: false });
      });

      expect(result.current.isLoading).toBe(false);
    });

    test("resets isLoading to false even when the action throws", async () => {
      (signUpAction as any).mockRejectedValue(new Error("Server error"));

      const { result } = renderHook(() => useAuth());

      await expect(
        act(async () => { await result.current.signUp("u@e.com", "pass"); })
      ).rejects.toThrow("Server error");

      expect(result.current.isLoading).toBe(false);
    });

    test("runs post-sign-in flow on successful sign up — redirects to existing project", async () => {
      (signUpAction as any).mockResolvedValue({ success: true });
      (getProjects as any).mockResolvedValue([{ id: "my-project" }]);

      const { result } = renderHook(() => useAuth());
      await act(async () => { await result.current.signUp("u@e.com", "pass"); });

      expect(mockPush).toHaveBeenCalledWith("/my-project");
    });

    test("runs post-sign-in flow on successful sign up — creates project when none exist", async () => {
      (signUpAction as any).mockResolvedValue({ success: true });
      (getProjects as any).mockResolvedValue([]);
      (createProject as any).mockResolvedValue({ id: "first-project" });

      const { result } = renderHook(() => useAuth());
      await act(async () => { await result.current.signUp("u@e.com", "pass"); });

      expect(createProject).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/first-project");
    });
  });
});
