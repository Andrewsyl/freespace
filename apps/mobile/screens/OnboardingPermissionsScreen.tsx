import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const GREEN     = "#0a8050";
const FG        = "#0f172a";
const BODY_TEXT = "#475569";
const MUTED     = "#94a3b8";

const LOGO         = require("../assets/freespace-logo-grid-black.png");
const IMG_LOCATION = require("../assets/illustrations/city-driver.gif");
const MAP_REGION_KEY = "search.mapRegion";

const STEPS = [
  {
    image:    IMG_LOCATION,
    headline: "Find parking,\nnear you.",
    body:     "Allow location to instantly see parking near you — no need to type your address every time you open the app.",
    cta:      "Allow location",
    skip:     "Skip for now",
  },
  {
    image:    require("../assets/illustrations/push-notifications.png"),
    headline: "Always\nin the loop.",
    body:     "Know the moment you're confirmed, get a heads-up before you park, and hear about spaces in your saved areas.",
    cta:      "Turn on notifications",
    skip:     "Not now",
  },
] as const;

type Props = { onComplete: () => void };

export function OnboardingPermissions({ onComplete }: Props) {
  const insets  = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const current = STEPS[step];

  const ilOpacity  = useRef(new Animated.Value(1)).current;
  const txOpacity  = useRef(new Animated.Value(1)).current;
  const txY        = useRef(new Animated.Value(0)).current;
  const exitOpacity = useRef(new Animated.Value(1)).current;

  const handleComplete = () => {
    Animated.timing(exitOpacity, {
      toValue: 0,
      duration: 260,
      useNativeDriver: true,
    }).start(() => onComplete());
  };

  const progress = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    Animated.timing(progress, {
      toValue:  (step + 1) / STEPS.length,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [step, progress]);

  const advance = () => {
    if (step >= STEPS.length - 1) { handleComplete(); return; }
    Animated.parallel([
      Animated.timing(ilOpacity, { toValue: 0, duration: 140, easing: Easing.in(Easing.quad),  useNativeDriver: true }),
      Animated.timing(txOpacity, { toValue: 0, duration: 110, useNativeDriver: true }),
      Animated.timing(txY,       { toValue: 14, duration: 110, useNativeDriver: true }),
    ]).start(() => {
      txY.setValue(-14);
      setStep((s) => s + 1);
      Animated.parallel([
        Animated.timing(ilOpacity, { toValue: 1, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(txOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(txY,       { toValue: 0, tension: 80, friction: 12, useNativeDriver: true }),
      ]).start();
    });
  };

  const handleContinue = async () => {
    if (step === 0) {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status === "granted") {
        let position: Location.LocationObject | null = null;
        try {
          position = await Promise.race([
            Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 6000)),
          ]);
        } catch {
          position = null;
        }
        if (!position) {
          position = await Location.getLastKnownPositionAsync({
            maxAge: 10 * 60 * 1000,
            requiredAccuracy: 500,
          });
        }
        if (position) {
          await AsyncStorage.setItem(
            MAP_REGION_KEY,
            JSON.stringify({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              latitudeDelta: 0.012,
              longitudeDelta: 0.012,
            })
          );
        }
      }
    } else {
      await Notifications.requestPermissionsAsync();
    }
    advance();
  };

  return (
    <Animated.View style={[S.root, { paddingTop: insets.top + 16, paddingBottom: Math.max(insets.bottom + 20, 36), opacity: exitOpacity }]}>

      {/* Logo */}
      <View style={S.logoWrap}>
        <Image source={LOGO} style={S.logo} resizeMode="contain" />
      </View>

      {/* Illustration */}
      <Animated.View style={[S.imageWrap, { opacity: ilOpacity }]}>
        <Image source={current.image} style={S.image} resizeMode="contain" />
      </Animated.View>

      {/* Progress bar */}
      <View style={S.progressTrack}>
        <Animated.View style={[S.progressFill, {
          width: progress.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }),
        }]} />
      </View>

      {/* Text */}
      <Animated.View style={[S.textBlock, { opacity: txOpacity, transform: [{ translateY: txY }] }]}>
        <View>
          {current.headline.split("\n").map((line, i) => (
            <Text key={i} style={i === 0 ? S.headlineDark : S.headlineGreen}>{line}</Text>
          ))}
        </View>
        <Text style={S.body}>{current.body}</Text>
      </Animated.View>

      <View style={{ flex: 1 }} />

      {/* Primary CTA */}
      <Pressable style={S.ctaBtn} onPress={handleContinue}>
        <Text style={S.ctaLabel}>{current.cta}</Text>
      </Pressable>

      {/* Skip — underlined text only */}
      <Pressable style={S.skipBtn} onPress={advance}>
        <Text style={S.skipLabel}>{current.skip}</Text>
      </Pressable>

    </Animated.View>
  );
}

const S = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex:            900,
    backgroundColor:   "#ffffff",
    paddingHorizontal: 24,
    alignItems:        "center",
  },

  logoWrap: {
    width:          "100%",
    height:         80,
    alignItems:     "center",
    justifyContent: "center",
    marginBottom:   8,
  },
  logo: {
    width:  200,
    height: 80,
  },

  imageWrap: {
    width:        "100%",
    alignItems:   "center",
    marginBottom: 4,
  },
  image: {
    width:  "100%",
    height: 210,
  },

  progressTrack: {
    width:           "100%",
    height:          3,
    borderRadius:    2,
    backgroundColor: "#f1f5f9",
    marginBottom:    20,
    marginTop:       12,
    overflow:        "hidden",
  },
  progressFill: {
    height:          "100%",
    backgroundColor: GREEN,
    borderRadius:    2,
  },

  textBlock: {
    width: "100%",
    gap:   10,
  },
  headlineDark: {
    fontFamily:    "PlusJakartaSans-Medium",
    fontSize:      32,
    lineHeight:    38,
    letterSpacing: -0.6,
    color:         FG,
  },
  headlineGreen: {
    fontFamily:    "PlusJakartaSans-ExtraBold",
    fontSize:      32,
    lineHeight:    44,
    letterSpacing: -0.6,
    color:         GREEN,
  },
  body: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize:   15,
    lineHeight: 23,
    color:      BODY_TEXT,
  },

  ctaBtn: {
    width:           "100%",
    height:          52,
    borderRadius:    14,
    backgroundColor: "#0a8050",
    alignItems:      "center",
    justifyContent:  "center",
    marginBottom:    14,
    shadowColor:     "#0a7a50",
    shadowOffset:    { width: 0, height: 4 },
    shadowOpacity:   0.28,
    shadowRadius:    14,
    elevation:       5,
  },
  ctaLabel: {
    fontFamily:    "PlusJakartaSans-SemiBold",
    fontSize:      16,
    color:         "#ffffff",
    letterSpacing: -0.3,
  },

  skipBtn: {
    height:         40,
    alignItems:     "center",
    justifyContent: "center",
  },
  skipLabel: {
    fontFamily:          "PlusJakartaSans-Regular",
    fontSize:            15,
    color:               MUTED,
    textDecorationLine:  "underline",
  },
});
