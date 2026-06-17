import { render, userEvent } from "@testing-library/react-native";
import { SearchScreen } from "../screens/SearchScreen";
import { GlobalLoadingProvider } from "../components/GlobalLoading";

jest.mock("../auth", () => ({
  useAuth: () => ({ user: null }),
}));

jest.mock("../favorites", () => ({
  useFavorites: () => ({
    favorites: [],
    isFavorite: jest.fn().mockReturnValue(false),
    toggle: jest.fn(),
  }),
}));

jest.mock("../api", () => ({
  searchListings: jest.fn().mockResolvedValue([]),
}));

jest.mock("../components/MapSection", () => {
  const { View } = require("react-native");
  return () => <View />;
});

jest.mock("../components/MapBottomCard", () => {
  const { View } = require("react-native");
  return { MapBottomCard: () => <View /> };
});

const navigation = {
  navigate: jest.fn(),
  replace: jest.fn(),
  dispatch: jest.fn(),
  setOptions: jest.fn(),
  setParams: jest.fn(),
};

const route = { key: "Search", name: "Search", params: undefined };

describe("SearchScreen", () => {
  it("renders the search bar", () => {
    const { getByTestId, getByText } = render(
      <GlobalLoadingProvider><SearchScreen navigation={navigation as any} route={route as any} /></GlobalLoadingProvider>
    );

    expect(getByTestId("search-bar")).toBeTruthy();
    expect(getByText(/where to\?/i)).toBeTruthy();
  });

  it("opens the search sheet when tapping the search bar", async () => {
    const { getByTestId, getByPlaceholderText } = render(
      <GlobalLoadingProvider><SearchScreen navigation={navigation as any} route={route as any} /></GlobalLoadingProvider>
    );
    const user = userEvent.setup({ delay: null as unknown as number });

    await user.press(getByTestId("search-bar"));
    expect(getByPlaceholderText("Area, address or landmark")).toBeTruthy();
  });
});
