import React from "react";
import { render, userEvent, waitFor } from "@testing-library/react-native";
import { RegisterScreen } from "../screens/RegisterScreen";

const mockRegister = jest.fn();

jest.mock("../auth", () => ({
  useAuth: () => ({ register: mockRegister }),
}));

const navigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  dispatch: jest.fn(),
};

const route = { key: "Register", name: "Register", params: {} };

function renderScreen() {
  return render(<RegisterScreen navigation={navigation as any} route={route as any} />);
}

describe("RegisterScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows an error when first name is missing", async () => {
    const { getByText, getByTestId } = renderScreen();
    const user = userEvent.setup({ delay: null as unknown as number });
    await user.press(getByTestId("register-btn"));
    await waitFor(() => expect(getByText("Enter your first name.")).toBeTruthy());
  });

  it("shows an error when last name is missing", async () => {
    const { getByText, getByPlaceholderText, getByTestId } = renderScreen();
    const user = userEvent.setup({ delay: null as unknown as number });
    await user.type(getByPlaceholderText("John"), "Jane");
    await user.press(getByTestId("register-btn"));
    await waitFor(() => expect(getByText("Enter your last name.")).toBeTruthy());
  });

  it("shows an error when terms are not accepted", async () => {
    const { getByText, getByPlaceholderText, getByTestId } = renderScreen();
    const user = userEvent.setup({ delay: null as unknown as number });
    await user.type(getByPlaceholderText("John"), "Jane");
    await user.type(getByPlaceholderText("Smith"), "Doe");
    await user.press(getByTestId("register-btn"));
    await waitFor(() =>
      expect(getByText("Please accept the terms and privacy policy.")).toBeTruthy()
    );
  });

  it("shows an error for an invalid email address", async () => {
    const { getByText, getByPlaceholderText, getByTestId } = renderScreen();
    const user = userEvent.setup({ delay: null as unknown as number });
    await user.type(getByPlaceholderText("John"), "Jane");
    await user.type(getByPlaceholderText("Smith"), "Doe");
    await user.press(getByTestId("terms-checkbox"));
    await user.type(getByPlaceholderText("johndoe@gmail.com"), "notanemail");
    await user.press(getByTestId("register-btn"));
    await waitFor(() => expect(getByText("Enter a valid email address.")).toBeTruthy());
  });

  it("shows an error when the password is too short", async () => {
    const { getByText, getByPlaceholderText, getAllByPlaceholderText, getByTestId } = renderScreen();
    const user = userEvent.setup({ delay: null as unknown as number });
    await user.type(getByPlaceholderText("John"), "Jane");
    await user.type(getByPlaceholderText("Smith"), "Doe");
    await user.press(getByTestId("terms-checkbox"));
    await user.type(getByPlaceholderText("johndoe@gmail.com"), "jane@example.com");
    const [passwordField] = getAllByPlaceholderText("••••••••");
    await user.type(passwordField, "abc");
    await user.press(getByTestId("register-btn"));
    await waitFor(() =>
      expect(getByText("Password must be at least 6 characters.")).toBeTruthy()
    );
  });

  it("shows an error when passwords do not match", async () => {
    const { getByText, getByPlaceholderText, getAllByPlaceholderText, getByTestId } = renderScreen();
    const user = userEvent.setup({ delay: null as unknown as number });
    await user.type(getByPlaceholderText("John"), "Jane");
    await user.type(getByPlaceholderText("Smith"), "Doe");
    await user.press(getByTestId("terms-checkbox"));
    await user.type(getByPlaceholderText("johndoe@gmail.com"), "jane@example.com");
    const [passwordField, confirmField] = getAllByPlaceholderText("••••••••");
    await user.type(passwordField, "secret123");
    await user.type(confirmField, "different");
    await user.press(getByTestId("register-btn"));
    await waitFor(() => expect(getByText("Passwords do not match.")).toBeTruthy());
  });

  it("calls register and navigates on valid submission", async () => {
    mockRegister.mockResolvedValue({
      user: { termsVersion: "2026-01-10", privacyVersion: "2026-01-10" },
    });

    const { getByText, getByPlaceholderText, getAllByPlaceholderText, getByTestId } = renderScreen();
    const user = userEvent.setup({ delay: null as unknown as number });
    await user.type(getByPlaceholderText("John"), "Jane");
    await user.type(getByPlaceholderText("Smith"), "Doe");
    await user.press(getByTestId("terms-checkbox"));
    await user.type(getByPlaceholderText("johndoe@gmail.com"), "jane@example.com");
    const [passwordField, confirmField] = getAllByPlaceholderText("••••••••");
    await user.type(passwordField, "secret123");
    await user.type(confirmField, "secret123");
    await user.press(getByTestId("register-btn"));

    await waitFor(() => expect(mockRegister).toHaveBeenCalledWith(
      "jane@example.com",
      "secret123",
      expect.objectContaining({ firstName: "Jane", lastName: "Doe" })
    ));
    expect(navigation.dispatch).toHaveBeenCalled();
  });

  it("shows the API error and clears password fields on failure", async () => {
    mockRegister.mockRejectedValue(new Error("Email already in use"));

    const { getByText, getByPlaceholderText, getAllByPlaceholderText, getByTestId } = renderScreen();
    const user = userEvent.setup({ delay: null as unknown as number });
    await user.type(getByPlaceholderText("John"), "Jane");
    await user.type(getByPlaceholderText("Smith"), "Doe");
    await user.press(getByTestId("terms-checkbox"));
    await user.type(getByPlaceholderText("johndoe@gmail.com"), "jane@example.com");
    const [passwordField, confirmField] = getAllByPlaceholderText("••••••••");
    await user.type(passwordField, "secret123");
    await user.type(confirmField, "secret123");
    await user.press(getByTestId("register-btn"));

    await waitFor(() => expect(getByText("Email already in use")).toBeTruthy());
    expect(passwordField.props.value).toBe("");
    expect(confirmField.props.value).toBe("");
  });
});
