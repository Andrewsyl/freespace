import { render, userEvent, waitFor } from "@testing-library/react-native";
import { GlobalToastProvider } from "../components/GlobalToast";
import { SignInScreen } from "../screens/SignInScreen";

jest.mock("../auth", () => ({
  useAuth: () => ({
    login: jest.fn(),
    register: jest.fn(),
    loginWithOAuth: jest.fn(),
    acceptLegal: jest.fn(),
    logout: jest.fn(),
  }),
}));

jest.mock("../api", () => ({
  requestEmailVerification: jest.fn(),
}));

const navigation = {
  replace: jest.fn(),
  navigate: jest.fn(),
  dispatch: jest.fn(),
  setOptions: jest.fn(),
};

const route = { key: "SignIn", name: "SignIn", params: undefined };

describe("SignInScreen", () => {
  it("renders the sign-in header", () => {
    const { getAllByText, getByText } = render(
      <GlobalToastProvider>
        <SignInScreen navigation={navigation as any} route={route as any} />
      </GlobalToastProvider>
    );

    expect(getAllByText(/sign in/i).length).toBeGreaterThan(0);
    expect(getByText("Email")).toBeTruthy();
  });

  it("shows a validation error for invalid email on sign-in", async () => {
    const { getByPlaceholderText, getByText, getByTestId } = render(
      <GlobalToastProvider>
        <SignInScreen navigation={navigation as any} route={route as any} />
      </GlobalToastProvider>
    );
    const user = userEvent.setup({ delay: null as unknown as number });

    await user.type(getByPlaceholderText("you@example.com"), "invalid");
    await user.type(getByPlaceholderText("••••••••"), "123456");
    await user.press(getByTestId("sign-in-button"));

    await waitFor(() => expect(getByText("Enter a valid email address.")).toBeTruthy());
  });

  it("does not show create account on the sign-in form", () => {
    const { queryByText } = render(
      <GlobalToastProvider>
        <SignInScreen navigation={navigation as any} route={route as any} />
      </GlobalToastProvider>
    );

    expect(queryByText("Create account")).toBeNull();
  });
});
