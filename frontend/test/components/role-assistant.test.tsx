import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import RoleAssistant from "@/components/management/RoleAssistant";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("RoleAssistant", () => {
  it("does not call AI until the authenticated manager submits a question", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ message: "Verified result", conversationId: "c1" }), { status: 200 }));
    render(<RoleAssistant role="seller" onClose={() => undefined} />);
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Ask a management question"), { target: { value: "Summarize my sales" } });
    fireEvent.click(screen.getByRole("button", { name: /^Ask$/ }));
    await screen.findByText("Verified result");
    expect(fetchMock).toHaveBeenCalledWith("/api/ai/ask", expect.objectContaining({ method: "POST" }));
    const request = fetchMock.mock.calls[0][1];
    const body = JSON.parse(String(request?.body));
    expect(body.message).toBe("Summarize my sales");
    expect(body).not.toHaveProperty("role");
  });

  it("shows backend errors without affecting the dashboard", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ error: "AI provider unavailable" }), { status: 503 }));
    render(<RoleAssistant role="shipper" onClose={() => undefined} />);
    fireEvent.change(screen.getByLabelText("Ask a management question"), { target: { value: "What is delayed?" } });
    fireEvent.click(screen.getByRole("button", { name: /^Ask$/ }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("AI provider unavailable"));
  });
});
