import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { describe, expect, it } from "vitest";
import AuthRequiredModal from "@/components/Common/AuthRequiredModal";

describe("AuthRequiredModal", () => {
  it("renders and triggers login callback", () => {
    const onClose = vi.fn();
    const onLogin = vi.fn();

    render(<AuthRequiredModal open={true} onClose={onClose} onLogin={onLogin} />);
    fireEvent.click(screen.getByRole("button", { name: /go to login/i }));

    expect(onLogin).toHaveBeenCalledTimes(1);
  });
});
