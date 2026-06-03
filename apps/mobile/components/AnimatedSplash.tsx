import { Dimensions, StyleSheet } from "react-native";
import LottieView from "lottie-react-native";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

const { width: screenWidth } = Dimensions.get("window");
const LOTTIE_WIDTH = screenWidth * 0.9;
const LOTTIE_HEIGHT = LOTTIE_WIDTH * (360 / 640);

type Props = {
  onFinish: () => void;
};

export function AnimatedSplash({ onFinish }: Props) {
  const opacity = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  function handleAnimationFinish() {
    opacity.value = withTiming(0, { duration: 400 }, (finished) => {
      if (finished) runOnJS(onFinish)();
    });
  }

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.container, animatedStyle]}>
      <LottieView
        source={require("../assets/splash-animation.json")}
        autoPlay
        loop={false}
        onAnimationFinish={handleAnimationFinish}
        style={styles.lottie}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 999,
  },
  lottie: {
    width: LOTTIE_WIDTH,
    height: LOTTIE_HEIGHT,
  },
});
