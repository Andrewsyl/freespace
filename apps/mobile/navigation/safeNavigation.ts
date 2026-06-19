import { CommonActions, type NavigationProp, type ParamListBase } from "@react-navigation/native";

type SafeRoute = {
  name: string;
  params?: object;
};

type SafeNavigation = Pick<NavigationProp<ParamListBase>, "canGoBack" | "goBack" | "dispatch">;

const SEARCH_FALLBACK: SafeRoute = {
  name: "Tabs",
  params: { screen: "Search" },
};

export function resetToSafeRoute(
  navigation: SafeNavigation,
  fallback: SafeRoute = SEARCH_FALLBACK
) {
  navigation.dispatch(
    CommonActions.reset({
      index: 0,
      routes: [{ name: fallback.name, params: fallback.params }],
    })
  );
}

export function goBackOrFallback(
  navigation: SafeNavigation,
  fallback: SafeRoute = SEARCH_FALLBACK
) {
  if (navigation.canGoBack()) {
    navigation.goBack();
    return;
  }
  resetToSafeRoute(navigation, fallback);
}

export const fallbackRoutes = {
  search: SEARCH_FALLBACK,
  profile: { name: "Tabs", params: { screen: "Profile" } },
  bookings: { name: "Tabs", params: { screen: "History" } },
  saved: { name: "Tabs", params: { screen: "Favorites" } },
  listings: { name: "Listings" },
} satisfies Record<string, SafeRoute>;
