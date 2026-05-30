import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";

type BookingProgressBarProps = {
  currentStep: 1 | 2 | 3;
};

export function BookingProgressBar({ currentStep }: BookingProgressBarProps) {
  const steps = [
    { number: 1, label: "Select" },
    { number: 2, label: "Confirm" },
    { number: 3, label: "Pay" },
  ];

  const getStepStatus = (stepNumber: number) => {
    if (stepNumber < currentStep) return "completed";
    if (stepNumber === currentStep) return "active";
    return "upcoming";
  };

  return (
    <View style={styles.container}>
      <View style={styles.progressRow}>
        {steps.map((step, index) => {
          const status = getStepStatus(step.number);

          return (
            <React.Fragment key={step.number}>
              <View style={styles.stepWrapper}>
                <View
                  style={[
                    styles.circle,
                    status === "completed" && styles.circleCompleted,
                    status === "active" && styles.circleActive,
                    status === "upcoming" && styles.circleUpcoming,
                  ]}
                >
                  {status === "completed" ? (
                    <Svg width={18} height={14} viewBox="0 0 16 12">
                      <Path
                        d="M1 6l4 4 10-9"
                        stroke="#FFFFFF"
                        strokeWidth={2.5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="none"
                      />
                    </Svg>
                  ) : (
                    <Text
                      style={[
                        styles.stepNumber,
                        status === "active" && styles.stepNumberActive,
                        status === "upcoming" && styles.stepNumberUpcoming,
                      ]}
                    >
                      {step.number}
                    </Text>
                  )}
                </View>
                <Text
                  style={[
                    styles.label,
                    status === "completed" && styles.labelCompleted,
                    status === "active" && styles.labelActive,
                    status === "upcoming" && styles.labelUpcoming,
                  ]}
                >
                  {step.label}
                </Text>
              </View>

              {index < steps.length - 1 ? (
                <View
                  style={[
                    styles.line,
                    (status === "completed" || status === "active") &&
                      styles.lineActive,
                    status === "upcoming" && styles.lineUpcoming,
                  ]}
                />
              ) : null}
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 40,
    paddingTop: 8,
    paddingBottom: 10,
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  stepWrapper: {
    alignItems: "center",
    minWidth: 48,
  },
  circle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  circleCompleted: {
    backgroundColor: "#0fa968",
    borderColor: "#0fa968",
    borderWidth: 2,
  },
  circleActive: {
    backgroundColor: "#FFFFFF",
    borderColor: "#F97316",
    borderWidth: 2,
  },
  circleUpcoming: {
    backgroundColor: "#FFFFFF",
    borderColor: "#D1D5DB",
    borderWidth: 2,
  },
  checkmark: {
    color: "#0fa968",
    fontSize: 12,
    fontWeight: "600",
  },
  stepNumber: {
    color: "#111827",
    fontSize: 12,
    fontWeight: "700",
    fontFamily: "PlusJakartaSans-SemiBold",
  },
  stepNumberActive: {
    color: "#F97316",
  },
  stepNumberUpcoming: {
    color: "#9CA3AF",
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "PlusJakartaSans-SemiBold",
    textAlign: "center",
  },
  labelCompleted: {
    color: "#0fa968",
  },
  labelActive: {
    color: "#111827",
  },
  labelUpcoming: {
    color: "#9CA3AF",
  },
  line: {
    height: 2,
    flex: 1,
    marginTop: -12,
    marginHorizontal: 4,
    borderRadius: 999,
  },
  lineActive: {
    backgroundColor: "#0fa968",
  },
  lineUpcoming: {
    backgroundColor: "#D1D5DB",
  },
});
