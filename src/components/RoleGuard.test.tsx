import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { RoleGuard } from "./RoleGuard";

// Mocked auth state — mutated per-test
const authState: {
  user: any;
  role: string | null;
  isLoading: boolean;
} = { user: null, role: null, isLoading: true };

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => authState,
}));

function renderAt(path: string, allow: any) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/admin"
          element={
            <RoleGuard allow={allow}>
              <div>ADMIN_CONTENT</div>
            </RoleGuard>
          }
        />
        <Route path="/auth" element={<div>AUTH_PAGE</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("RoleGuard", () => {
  beforeEach(() => {
    authState.user = null;
    authState.role = null;
    authState.isLoading = true;
  });

  it("shows spinner while auth is loading and does NOT redirect", () => {
    authState.isLoading = true;
    renderAt("/admin", "admin");

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText(/loading your account/i)).toBeInTheDocument();
    expect(screen.queryByText("ADMIN_CONTENT")).not.toBeInTheDocument();
    expect(screen.queryByText("AUTH_PAGE")).not.toBeInTheDocument();
  });

  it("shows spinner when `ready` prop is false even after auth resolves", () => {
    authState.isLoading = false;
    authState.user = { id: "u1" };
    authState.role = "admin";

    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route
            path="/admin"
            element={
              <RoleGuard allow="admin" ready={false}>
                <div>ADMIN_CONTENT</div>
              </RoleGuard>
            }
          />
          <Route path="/auth" element={<div>AUTH_PAGE</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByText("ADMIN_CONTENT")).not.toBeInTheDocument();
  });

  it("renders children after loading finishes and role matches", () => {
    authState.isLoading = false;
    authState.user = { id: "u1" };
    authState.role = "admin";

    renderAt("/admin", "admin");

    expect(screen.getByText("ADMIN_CONTENT")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("redirects to /auth after loading finishes if role does not match", () => {
    authState.isLoading = false;
    authState.user = { id: "u1" };
    authState.role = "customer";

    renderAt("/admin", "admin");

    expect(screen.getByText("AUTH_PAGE")).toBeInTheDocument();
    expect(screen.queryByText("ADMIN_CONTENT")).not.toBeInTheDocument();
  });

  it("redirects to /auth after loading finishes if user is missing", () => {
    authState.isLoading = false;
    authState.user = null;
    authState.role = null;

    renderAt("/admin", "admin");

    expect(screen.getByText("AUTH_PAGE")).toBeInTheDocument();
  });

  it("allows any role in the `allow` array once loading finishes", () => {
    authState.isLoading = false;
    authState.user = { id: "u1" };
    authState.role = "rider";

    renderAt("/admin", ["admin", "rider"]);

    expect(screen.getByText("ADMIN_CONTENT")).toBeInTheDocument();
  });
});
