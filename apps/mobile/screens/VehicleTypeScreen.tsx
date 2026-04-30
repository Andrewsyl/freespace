import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Platform,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { Ionicons } from "@expo/vector-icons";
import { updateMe } from "../api";
import { useAuth } from "../auth";
import { SectionHeader, TextInput as AppTextInput } from "../components/ui";
import type { RootStackParamList } from "../types";
import { cardShadow, colors, radius, spacing, textStyles } from "../styles/theme";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

type Props = NativeStackScreenProps<RootStackParamList, "VehicleType">;

const VEHICLE_MAKES = [
  "Audi",
  "BMW",
  "Citroen",
  "Cupra",
  "Dacia",
  "Fiat",
  "Ford",
  "Honda",
  "Hyundai",
  "Kia",
  "Land Rover",
  "Mazda",
  "Mercedes-Benz",
  "Mini",
  "Nissan",
  "Opel",
  "Peugeot",
  "Renault",
  "Seat",
  "Skoda",
  "Tesla",
  "Toyota",
  "Volkswagen",
  "Volvo",
  "Other",
];

const VEHICLE_MODELS_BY_MAKE: Record<string, string[]> = {
  Audi: [
    "A1",
    "A2",
    "A3",
    "A4",
    "A5",
    "A6",
    "A7",
    "A8",
    "Q2",
    "Q3",
    "Q4 e-tron",
    "Q5",
    "Q7",
    "Q8",
    "TT",
    "e-tron",
    "Other",
  ],
  BMW: [
    "1 Series",
    "2 Series",
    "3 Series",
    "4 Series",
    "5 Series",
    "6 Series",
    "7 Series",
    "8 Series",
    "X1",
    "X2",
    "X3",
    "X4",
    "X5",
    "X6",
    "X7",
    "i3",
    "i4",
    "i5",
    "i7",
    "iX",
    "Other",
  ],
  Citroen: ["C1", "C2", "C3", "C3 Aircross", "C4", "C4 X", "C5", "C5 Aircross", "Berlingo", "Dispatch", "Relay", "Other"],
  Cupra: ["Born", "Formentor", "Leon", "Leon Sportstourer", "Ateca", "Tavascan", "Terramar", "Other"],
  Dacia: ["Sandero", "Sandero Stepway", "Duster", "Jogger", "Spring", "Logan", "Other"],
  Fiat: ["500", "500e", "500X", "600", "Panda", "Punto", "Tipo", "Doblo", "Ducato", "Other"],
  Ford: [
    "Fiesta",
    "Focus",
    "Mondeo",
    "Ka",
    "EcoSport",
    "Puma",
    "Kuga",
    "Edge",
    "Mustang",
    "Explorer",
    "Transit Courier",
    "Transit Connect",
    "Transit Custom",
    "Transit",
    "Ranger",
    "Other",
  ],
  Honda: ["Civic", "Jazz", "Accord", "CR-V", "HR-V", "ZR-V", "e", "e:Ny1", "Other"],
  Hyundai: [
    "i10",
    "i20",
    "i30",
    "Bayon",
    "Kona",
    "Tucson",
    "Santa Fe",
    "IONIQ",
    "IONIQ 5",
    "IONIQ 6",
    "Other",
  ],
  Kia: ["Picanto", "Rio", "Ceed", "XCeed", "Stonic", "Niro", "Sportage", "Sorento", "EV3", "EV6", "EV9", "Other"],
  "Land Rover": [
    "Defender",
    "Discovery",
    "Discovery Sport",
    "Freelander",
    "Range Rover",
    "Range Rover Evoque",
    "Range Rover Velar",
    "Range Rover Sport",
    "Other",
  ],
  Mazda: ["Mazda2", "Mazda3", "Mazda6", "CX-3", "CX-30", "CX-5", "CX-60", "CX-80", "MX-5", "MX-30", "Other"],
  "Mercedes-Benz": [
    "A-Class",
    "B-Class",
    "C-Class",
    "CLA",
    "CLS",
    "E-Class",
    "S-Class",
    "GLA",
    "GLB",
    "GLC",
    "GLE",
    "GLS",
    "EQA",
    "EQB",
    "EQC",
    "EQE",
    "EQS",
    "Vito",
    "Sprinter",
    "Other",
  ],
  Mini: ["Hatch", "Convertible", "Clubman", "Countryman", "Aceman", "Paceman", "Other"],
  Nissan: ["Micra", "Note", "Leaf", "Juke", "Qashqai", "X-Trail", "Ariya", "Navara", "Primastar", "Other"],
  Opel: ["Adam", "Corsa", "Astra", "Insignia", "Crossland", "Grandland", "Mokka", "Combo", "Vivaro", "Movano", "Other"],
  Peugeot: ["108", "208", "2008", "308", "3008", "408", "5008", "Partner", "Expert", "Boxer", "Other"],
  Renault: ["Clio", "Megane", "Captur", "Kadjar", "Austral", "Arkana", "Scenic", "Zoe", "Kangoo", "Trafic", "Master", "Other"],
  Seat: ["Mii", "Ibiza", "Leon", "Arona", "Ateca", "Tarraco", "Alhambra", "Other"],
  Skoda: ["Citigo", "Fabia", "Scala", "Octavia", "Superb", "Kamiq", "Karoq", "Kodiaq", "Enyaq", "Other"],
  Tesla: ["Model 3", "Model S", "Model X", "Model Y", "Cybertruck", "Other"],
  Toyota: ["Aygo", "Yaris", "Yaris Cross", "Corolla", "Auris", "Avensis", "Camry", "Prius", "C-HR", "RAV4", "Land Cruiser", "Hilux", "Other"],
  Volkswagen: [
    "up!",
    "Polo",
    "Golf",
    "Passat",
    "Arteon",
    "T-Cross",
    "Taigo",
    "T-Roc",
    "Tiguan",
    "Touareg",
    "ID.3",
    "ID.4",
    "ID.5",
    "Touran",
    "Sharan",
    "Caddy",
    "Transporter",
    "Crafter",
    "Other",
  ],
  Volvo: ["V40", "V60", "V90", "S60", "S90", "XC40", "XC60", "XC90", "C40", "EX30", "EX40", "EX90", "Other"],
  Other: ["Other"],
};

const VEHICLE_COLORS = [
  "Black",
  "White",
  "Silver",
  "Grey",
  "Blue",
  "Red",
  "Green",
  "Yellow",
  "Orange",
  "Brown",
  "Gold",
  "Other",
];

function formatIrishPlateInput(raw: string) {
  const compact = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!compact) return "";

  const firstLetterIndex = compact.search(/[A-Z]/);
  if (firstLetterIndex === -1) return compact.slice(0, 11);

  const yearDigits = compact.slice(0, firstLetterIndex).replace(/\D/g, "");
  const year = yearDigits.slice(0, 3);
  const afterYear = compact.slice(firstLetterIndex);
  const county = (afterYear.match(/[A-Z]/g) ?? []).join("").slice(0, 2);
  const serial = afterYear.replace(/[A-Z]/g, "").replace(/\D/g, "").slice(0, 6);

  if (!year) return compact.slice(0, 11);
  if (!county) return year;
  if (!serial) return `${year}-${county}`;
  return `${year}-${county}-${serial}`;
}

export function VehicleTypeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { token, user, setAuthUser } = useAuth();
  const scrollRef = useRef<ScrollView | null>(null);
  const brandFieldY = useRef(0);
  const modelFieldY = useRef(0);
  const colorFieldY = useRef(0);
  const plateFieldY = useRef(0);
  const [selectedMake, setSelectedMake] = useState<string>("");
  const [selectedModel, setSelectedModel] = useState("");
  const [brandQuery, setBrandQuery] = useState("");
  const [modelQuery, setModelQuery] = useState("");
  const [selectedColor, setSelectedColor] = useState("");
  const [plate, setPlate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [brandFocused, setBrandFocused] = useState(false);
  const [modelFocused, setModelFocused] = useState(false);
  const [plateFocused, setPlateFocused] = useState(false);

  useEffect(() => {
    setSelectedMake(user?.vehicleMake ?? "");
    setSelectedModel(user?.vehicleType ?? "");
    setBrandQuery(user?.vehicleMake ?? "");
    setModelQuery(user?.vehicleType ?? "");
    setSelectedColor(user?.vehicleColor ?? "");
    setPlate(user?.vehiclePlate ?? "");
  }, [user?.vehicleColor, user?.vehicleMake, user?.vehiclePlate, user?.vehicleType]);

  const availableModels = useMemo(
    () => (selectedMake ? VEHICLE_MODELS_BY_MAKE[selectedMake] ?? ["Other"] : []),
    [selectedMake]
  );
  const filteredMakes = useMemo(() => {
    const query = brandQuery.trim().toLowerCase();
    if (!query) return VEHICLE_MAKES;
    return VEHICLE_MAKES.filter((make) => make.toLowerCase().includes(query));
  }, [brandQuery]);
  const filteredModels = useMemo(() => {
    const query = modelQuery.trim().toLowerCase();
    if (!query) return availableModels;
    return availableModels.filter((model) => model.toLowerCase().includes(query));
  }, [availableModels, modelQuery]);

  const canSave = !!token && !!selectedMake && !!selectedModel && !saving;

  const handleSave = async () => {
    if (!token || !selectedMake || !selectedModel) return;
    setSaving(true);
    setError(null);
    try {
      const response = await updateMe(token, {
        vehicleMake: selectedMake,
        vehicleType: selectedModel,
        vehicleColor: selectedColor || null,
        vehiclePlate: plate.trim() ? plate.trim().toUpperCase() : null,
      });
      await setAuthUser(response.user);
      navigation.navigate("Tabs", { screen: "Profile" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save vehicle");
    } finally {
      setSaving(false);
    }
  };

  const scrollToField = (y: number) => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: Math.max(0, y - 120), animated: true });
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
      >
        <View style={styles.header}>
          <Pressable
            onPress={() => navigation.navigate("Tabs", { screen: "Profile" })}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={20} color={colors.text} />
            <Text style={styles.backText}>Back</Text>
          </Pressable>
          <Text style={styles.title}>My vehicle</Text>
          <Text style={styles.subtitle}>Your vehicle details</Text>
        </View>

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[styles.content, { paddingBottom: spacing.xl + Math.max(insets.bottom, spacing.md) }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.sheet}>
            <SectionHeader
              title="Vehicle details"
              subtitle="Save your car brand, model, color, and registration so bookings use the right vehicle."
            />

            <View
              style={styles.section}
              onLayout={(event) => {
                brandFieldY.current = event.nativeEvent.layout.y;
              }}
            >
              <Text style={styles.sectionLabel}>Car brand</Text>
              <AppTextInput
                containerStyle={styles.autoInputContainer}
                value={brandQuery}
                onChangeText={(value) => {
                  setBrandQuery(value);
                  if (value !== selectedMake) {
                    setSelectedMake("");
                    setSelectedModel("");
                    setModelQuery("");
                  }
                }}
                onFocus={() => {
                  setBrandFocused(true);
                  scrollToField(brandFieldY.current);
                }}
                onBlur={() => setTimeout(() => setBrandFocused(false), 120)}
                placeholder="Search car brand"
                style={styles.autoInput}
                autoCapitalize="words"
                autoCorrect={false}
              />
              {brandFocused ? (
                <View style={styles.suggestionList}>
                  {filteredMakes.slice(0, 8).map((make) => (
                    <Pressable
                      key={make}
                      style={styles.suggestionRow}
                      onPress={() => {
                        setSelectedMake(make);
                        setBrandQuery(make);
                        setSelectedModel("");
                        setModelQuery("");
                        setBrandFocused(false);
                      }}
                    >
                      <Text style={styles.suggestionText}>{make}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>

            <View
              style={styles.section}
              onLayout={(event) => {
                modelFieldY.current = event.nativeEvent.layout.y;
              }}
            >
              <Text style={styles.sectionLabel}>Model</Text>
              <AppTextInput
                containerStyle={styles.autoInputContainer}
                value={modelQuery}
                onChangeText={(value) => {
                  setModelQuery(value);
                  if (value !== selectedModel) setSelectedModel("");
                }}
                onFocus={() => {
                  if (selectedMake) {
                    setModelFocused(true);
                    scrollToField(modelFieldY.current);
                  }
                }}
                onBlur={() => setTimeout(() => setModelFocused(false), 120)}
                placeholder={selectedMake ? "Search model" : "Select brand first"}
                style={[styles.autoInput, !selectedMake && styles.autoInputDisabled]}
                autoCapitalize="words"
                autoCorrect={false}
                editable={!!selectedMake}
              />
              {modelFocused && selectedMake ? (
                <View style={styles.suggestionList}>
                  {filteredModels.slice(0, 8).map((model) => (
                    <Pressable
                      key={model}
                      style={styles.suggestionRow}
                      onPress={() => {
                        setSelectedModel(model);
                        setModelQuery(model);
                        setModelFocused(false);
                      }}
                    >
                      <Text style={styles.suggestionText}>{model}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>

            <View
              style={styles.section}
              onLayout={(event) => {
                colorFieldY.current = event.nativeEvent.layout.y;
              }}
            >
              <Text style={styles.sectionLabel}>Color</Text>
              <View style={styles.select}>
                <Picker
                  selectedValue={selectedColor || ""}
                  onValueChange={(value) => setSelectedColor(String(value || ""))}
                  style={styles.picker}
                  dropdownIconColor={colors.textMuted}
                >
                  <Picker.Item label="Select color" value="" color={colors.textMuted} />
                  {VEHICLE_COLORS.map((color) => (
                    <Picker.Item key={color} label={color} value={color} />
                  ))}
                </Picker>
              </View>
            </View>

            <View
              style={styles.section}
              onLayout={(event) => {
                plateFieldY.current = event.nativeEvent.layout.y;
              }}
            >
              <Text style={styles.sectionLabel}>Registration plate</Text>
              <View style={[styles.regRow, plateFocused && styles.regRowFocused]}>
                <View style={styles.plateCountry} />
                <View style={styles.regDetails}>
                  <AppTextInput
                    containerStyle={styles.regInputContainer}
                    variant="embedded"
                    value={plate}
                    onChangeText={(value) => setPlate(formatIrishPlateInput(value))}
                    placeholder="Enter reg plate"
                    autoCapitalize="characters"
                    autoCorrect={false}
                    textAlign="center"
                    style={[styles.regInput, styles.regInputText]}
                    onFocus={() => {
                      setPlateFocused(true);
                      scrollToField(plateFieldY.current);
                    }}
                    onBlur={() => setPlateFocused(false)}
                  />
                </View>
              </View>
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={!canSave}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.saveButtonText}>Save vehicle</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.appBg,
  },
  backButton: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
  },
  backText: {
    ...textStyles.body,
    color: colors.text,
  },
  header: {
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.screenY,
    paddingBottom: spacing.md,
  },
  content: {
    paddingBottom: spacing.xl,
  },
  sheet: {
    backgroundColor: colors.cardBg,
    borderColor: colors.border,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    flex: 1,
    padding: spacing.xl,
    ...cardShadow,
  },
  title: {
    ...textStyles.screenTitle,
    marginBottom: spacing.xs,
    marginTop: spacing.xs,
  },
  subtitle: {
    ...textStyles.subtitle,
  },
  section: {
    marginBottom: 14,
  },
  sectionLabel: {
    ...textStyles.sectionTitle,
    color: colors.text,
    marginBottom: 10,
  },
  autoInputContainer: {
    marginBottom: 0,
  },
  autoInput: {
    ...textStyles.body,
    color: colors.text,
    paddingHorizontal: 0,
    paddingVertical: 12,
  },
  autoInputDisabled: {
    opacity: 0.55,
  },
  suggestionList: {
    backgroundColor: colors.cardBg,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 10,
    overflow: "hidden",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 6,
  },
  suggestionRow: {
    backgroundColor: colors.cardBg,
    borderBottomColor: "#EEF2F6",
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  suggestionText: {
    ...textStyles.bodyStrong,
    color: colors.text,
  },
  select: {
    backgroundColor: "#FCFEFD",
    borderColor: "#D7DEE7",
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  picker: {
    color: colors.text,
    marginVertical: -6,
  },
  regRow: {
    alignItems: "center",
    backgroundColor: colors.cardBg,
    borderColor: "#D7DEE7",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    overflow: "hidden",
  },
  regRowFocused: {
    borderColor: colors.accent,
  },
  regDetails: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  plateCountry: {
    alignItems: "center",
    alignSelf: "stretch",
    backgroundColor: "#003399",
    justifyContent: "center",
    width: 34,
  },
  regInputContainer: {
    marginBottom: 0,
    flex: 1,
  },
  regInput: {
    backgroundColor: "transparent",
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  regInputText: {
    fontFamily: "UKNumberPlate",
    fontSize: 22,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: colors.text,
  },
  error: {
    ...textStyles.meta,
    color: colors.danger,
    marginBottom: 12,
    textAlign: "center",
  },
  saveButton: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: 16,
    marginTop: 4,
    paddingVertical: 15,
  },
  saveButtonDisabled: {
    opacity: 0.55,
  },
  saveButtonText: {
    ...textStyles.button,
    color: "#fff",
  },
});
