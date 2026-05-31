import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { updateMe } from "../api";
import { useAuth } from "../auth";
import { Button, TextInput as AppTextInput } from "../components/ui";
import { VehicleBrandLogo } from "../components/VehicleBrandLogo";
import type { RootStackParamList } from "../types";
import { cardShadow, colors, radius, spacing, textStyles } from "../styles/theme";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

type Props = NativeStackScreenProps<RootStackParamList, "VehicleType">;

const VEHICLE_MAKES = [
  "Alfa Romeo",
  "Audi",
  "BMW",
  "BYD",
  "Chevrolet",
  "Chrysler",
  "Citroen",
  "Cupra",
  "Dacia",
  "DS",
  "Fiat",
  "Ford",
  "Genesis",
  "Honda",
  "Hyundai",
  "Isuzu",
  "Jaguar",
  "Jeep",
  "Kia",
  "Land Rover",
  "Lexus",
  "Maserati",
  "Mazda",
  "Mercedes-Benz",
  "MG",
  "Mini",
  "Mitsubishi",
  "Nissan",
  "Opel",
  "Peugeot",
  "Polestar",
  "Porsche",
  "Renault",
  "Saab",
  "SEAT",
  "Seat",
  "Skoda",
  "Smart",
  "Subaru",
  "Suzuki",
  "Tesla",
  "Toyota",
  "Vauxhall",
  "Volkswagen",
  "Volvo",
  "Other",
];

const VEHICLE_MODELS_BY_MAKE: Record<string, string[]> = {
  "Alfa Romeo": ["Giulia", "Giulietta", "MiTo", "Tonale", "Stelvio", "Junior", "159", "Brera", "Spider", "Other"],
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
    "Q8 e-tron",
    "RS3",
    "RS4",
    "RS5",
    "RS6",
    "RS7",
    "S1",
    "S3",
    "S4",
    "S5",
    "S6",
    "S7",
    "S8",
    "SQ5",
    "SQ7",
    "SQ8",
    "TT",
    "R8",
    "e-tron",
    "Other",
  ],
  BMW: [
    "1 Series",
    "1 Series M",
    "114d",
    "116d",
    "116i",
    "118d",
    "118i",
    "120i",
    "120d",
    "2 Series",
    "2 Series Active Tourer",
    "2 Series Gran Coupe",
    "2 Series Gran Tourer",
    "3 Series",
    "3 Series Touring",
    "4 Series",
    "4 Series Convertible",
    "4 Series Gran Coupe",
    "5 Series",
    "5 Series Touring",
    "6 Series",
    "6 Series Gran Turismo",
    "7 Series",
    "8 Series",
    "8 Series Gran Coupe",
    "M2",
    "M3",
    "M4",
    "M5",
    "M8",
    "XM",
    "X1",
    "X2",
    "X3",
    "X4",
    "X5",
    "X6",
    "X7",
    "Z4",
    "i3",
    "iX1",
    "iX2",
    "i4",
    "i5",
    "iX3",
    "i7",
    "iX",
    "Other",
  ],
  BYD: ["ATTO 3", "DOLPHIN", "SEAL", "SEAL U", "SEALION 7", "HAN", "TANG", "Other"],
  Chevrolet: ["Aveo", "Camaro", "Captiva", "Corvette", "Cruze", "Lacetti", "Matiz", "Orlando", "Spark", "Trax", "Volt", "Other"],
  Chrysler: ["300C", "Crossfire", "Grand Voyager", "PT Cruiser", "Voyager", "Ypsilon", "Other"],
  Citroen: ["C1", "C2", "C3", "C3 Aircross", "C4", "C4 X", "C5", "C5 Aircross", "Berlingo", "Dispatch", "Relay", "Other"],
  Cupra: ["Born", "Formentor", "Leon", "Leon Sportstourer", "Ateca", "Tavascan", "Terramar", "Other"],
  Dacia: ["Sandero", "Sandero Stepway", "Duster", "Jogger", "Spring", "Logan", "Other"],
  DS: ["DS 3", "DS 3 Crossback", "DS 4", "DS 5", "DS 7", "DS 9", "Other"],
  Fiat: ["500", "500e", "500X", "600", "Panda", "Punto", "Tipo", "Doblo", "Ducato", "Other"],
  Ford: [
    "Fiesta",
    "Focus",
    "Focus ST",
    "Mondeo",
    "Ka",
    "Ka+",
    "EcoSport",
    "Puma",
    "Kuga",
    "Edge",
    "Mustang",
    "Mustang Mach-E",
    "Explorer",
    "S-Max",
    "Galaxy",
    "Capri",
    "Transit Courier",
    "Transit Connect",
    "Transit Custom",
    "Transit",
    "Ranger",
    "Other",
  ],
  Genesis: ["G70", "G80", "G90", "GV60", "GV70", "GV80", "Other"],
  Honda: ["Civic", "Jazz", "Accord", "CR-V", "HR-V", "ZR-V", "Insight", "Prelude", "e", "e:Ny1", "Other"],
  Hyundai: [
    "i10",
    "i20",
    "i30",
    "i40",
    "ix20",
    "ix35",
    "Bayon",
    "Inster",
    "Kona",
    "Tucson",
    "Santa Fe",
    "IONIQ Hybrid",
    "IONIQ",
    "IONIQ 5",
    "IONIQ 6",
    "IONIQ 9",
    "Other",
  ],
  Isuzu: ["D-Max", "MU-X", "Trooper", "Other"],
  Jaguar: ["E-PACE", "F-PACE", "I-PACE", "XE", "XF", "XJ", "F-TYPE", "Other"],
  Jeep: ["Avenger", "Renegade", "Compass", "Cherokee", "Grand Cherokee", "Wrangler", "Other"],
  Kia: ["Picanto", "Rio", "Ceed", "ProCeed", "XCeed", "Stonic", "Niro", "Sportage", "Sorento", "EV3", "EV5", "EV6", "EV9", "Other"],
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
  Lexus: ["CT", "IS", "ES", "LC", "LS", "LBX", "UX", "NX", "RX", "RZ", "GX", "LX", "Other"],
  Maserati: ["Ghibli", "GranCabrio", "GranTurismo", "Grecale", "Levante", "MC20", "Quattroporte", "Other"],
  Mazda: ["Mazda2", "Mazda3", "Mazda6", "CX-3", "CX-30", "CX-5", "CX-60", "CX-80", "CX-90", "MX-5", "MX-30", "Other"],
  "Mercedes-Benz": [
    "A-Class",
    "B-Class",
    "C-Class",
    "CLA",
    "CLS",
    "E-Class",
    "EQA SUV",
    "S-Class",
    "SL",
    "GLC Coupe",
    "GLE Coupe",
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
    "V-Class",
    "Sprinter",
    "Other",
  ],
  MG: ["MG3", "MG4", "MG5", "MG Cyberster", "MG ZS", "HS", "Marvel R", "Other"],
  Mini: ["Hatch", "Convertible", "Clubman", "Countryman", "Aceman", "Paceman", "Other"],
  Mitsubishi: ["ASX", "Colt", "Eclipse Cross", "L200", "Mirage", "Outlander", "Pajero", "Other"],
  Nissan: ["Micra", "Note", "Leaf", "Juke", "Qashqai", "X-Trail", "Ariya", "350Z", "370Z", "Navara", "Primastar", "Townstar", "Interstar", "Other"],
  Opel: ["Adam", "Corsa", "Astra", "Insignia", "Crossland", "Grandland", "Mokka", "Combo", "Vivaro", "Movano", "Other"],
  Peugeot: ["108", "208", "2008", "308", "3008", "408", "508", "5008", "Partner", "Rifter", "Expert", "Boxer", "Other"],
  Polestar: ["Polestar 2", "Polestar 3", "Polestar 4", "Other"],
  Porsche: ["718 Boxster", "718 Cayman", "911", "Cayenne", "Macan", "Panamera", "Taycan", "Other"],
  Renault: ["Clio", "Megane", "Captur", "Kadjar", "Austral", "Arkana", "Scenic", "Espace", "Rafale", "Symbioz", "Twingo", "Zoe", "Kangoo", "Trafic", "Master", "Other"],
  Saab: ["9-3", "9-5", "900", "9000", "9-4X", "9-7X", "Other"],
  SEAT: ["Mii", "Ibiza", "Leon", "Arona", "Ateca", "Tarraco", "Alhambra", "Other"],
  Seat: ["Mii", "Ibiza", "Leon", "Arona", "Ateca", "Tarraco", "Alhambra", "Other"],
  Skoda: ["Citigo", "Fabia", "Rapid", "Scala", "Octavia", "Superb", "Kamiq", "Karoq", "Kodiaq", "Elroq", "Enyaq", "Other"],
  Smart: ["fortwo", "forfour", "#1", "#3", "Roadster", "Other"],
  Subaru: ["BRZ", "Forester", "Impreza", "Legacy", "Levorg", "Outback", "Solterra", "XV", "Other"],
  Suzuki: ["Across", "Alto", "Baleno", "Ignis", "Jimny", "S-Cross", "Swift", "Swace", "Vitara", "Other"],
  Tesla: ["Model 3", "Model S", "Model X", "Model Y", "Cybertruck", "Other"],
  Toyota: ["Aygo", "Aygo X", "Yaris", "Yaris Cross", "Corolla", "Corolla Cross", "Auris", "Avensis", "Camry", "Prius", "GR86", "bZ4X", "C-HR", "RAV4", "Land Cruiser", "Hilux", "Proace", "Proace City", "Other"],
  Vauxhall: ["Adam", "Agila", "Astra", "Combo", "Corsa", "Crossland", "Frontera", "Grandland", "Insignia", "Meriva", "Mokka", "Viva", "Vivaro", "Movano", "Zafira", "Other"],
  Volkswagen: [
    "up!",
    "Polo",
    "Golf",
    "Golf GTI",
    "Golf R",
    "Passat",
    "Arteon",
    "ID. Buzz",
    "T-Cross",
    "Taigo",
    "T-Roc",
    "Tiguan",
    "Touareg",
    "ID.3",
    "ID.4",
    "ID.5",
    "ID.7",
    "Touran",
    "Sharan",
    "Caddy",
    "Transporter",
    "Crafter",
    "Other",
  ],
  Volvo: ["V40", "V60", "V90", "S60", "S90", "XC40", "XC60", "XC90", "C40", "EC40", "EX30", "EX40", "EX90", "Other"],
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

const VEHICLE_COLOR_SWATCHES: Record<string, string> = {
  Black: "#1F2937",
  White: "#FFFFFF",
  Silver: "#C0C7D1",
  Grey: "#8B95A7",
  Blue: "#2563EB",
  Red: "#DC2626",
  Green: "#16A34A",
  Yellow: "#EAB308",
  Orange: "#F97316",
  Brown: "#8B5E3C",
  Gold: "#D4A017",
  Other: "#CBD5E1",
};

const VEHICLE_COLOR_MARKERS: Record<string, string> = {
  Black: "⬛",
  White: "⬜",
  Silver: "◻️",
  Grey: "◼️",
  Blue: "🟦",
  Red: "🟥",
  Green: "🟩",
  Yellow: "🟨",
  Orange: "🟧",
  Brown: "🟫",
  Gold: "🟨",
  Other: "▪️",
};

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

export function VehicleTypeScreen({ navigation, route }: Props) {
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
  const [colorSheetVisible, setColorSheetVisible] = useState(false);

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
      if (route.params?.returnTo === "BookingSummary") {
        navigation.goBack();
      } else {
        navigation.navigate("Tabs", { screen: "Profile" });
      }
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

  useEffect(() => {
    if (route.params?.focusField !== "plate") return;
    const timer = setTimeout(() => {
      scrollToField(plateFieldY.current);
    }, 180);
    return () => clearTimeout(timer);
  }, [route.params?.focusField]);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
      >
        <View style={styles.stickyHeader}>
          <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={20} color={colors.text} />
            <Text style={styles.backText}>Back</Text>
          </Pressable>
        </View>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[styles.content, { paddingBottom: spacing.xl + Math.max(insets.bottom, spacing.md) }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <View style={styles.headerTextWrap}>
              <Text style={styles.title}>My vehicle</Text>
              <Text style={styles.subtitle}>Your vehicle details</Text>
            </View>
            {selectedMake ? (
              <View style={styles.headerBrandLogo}>
                <VehicleBrandLogo make={selectedMake} size={30} />
              </View>
            ) : null}
          </View>

          <View style={styles.sheet}>
            <View
              style={styles.section}
              onLayout={(event) => {
                brandFieldY.current = event.nativeEvent.layout.y;
              }}
            >
              <Text style={styles.sectionLabel}>Car brand</Text>
              <View style={styles.brandInputWrap}>
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
              </View>
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
              <View style={styles.brandInputWrap}>
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
              </View>
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
              <Pressable style={styles.colorSelect} onPress={() => setColorSheetVisible(true)}>
                {selectedColor ? (
                  <View style={[styles.colorSelectSwatch, { backgroundColor: VEHICLE_COLOR_SWATCHES[selectedColor] ?? "#ccc" }, selectedColor === "White" && styles.colorSelectSwatchBorder]} />
                ) : null}
                <Text style={[styles.colorSelectText, !selectedColor && styles.colorSelectPlaceholder]}>
                  {selectedColor || "Select colour"}
                </Text>
                <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
              </Pressable>
            </View>

            <View
              style={styles.section}
              onLayout={(event) => {
                plateFieldY.current = event.nativeEvent.layout.y;
              }}
            >
              <Text style={styles.sectionLabel}>Registration plate</Text>
              <View style={styles.regRow}>
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
                    autoFocus={route.params?.focusField === "plate"}
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

          </View>

          <Button
            style={styles.saveButton}
            title="Save"
            onPress={handleSave}
            disabled={!canSave}
            loading={saving}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal transparent animationType="slide" visible={colorSheetVisible}>
        <View style={styles.sheetBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setColorSheetVisible(false)} />
          <View style={[styles.sheetContainer, { paddingBottom: Math.max(24, insets.bottom + 12) }]}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Colour</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {VEHICLE_COLORS.map((color, i) => (
                <TouchableOpacity
                  key={color}
                  style={[styles.sheetRow, i > 0 && styles.sheetRowBorder]}
                  activeOpacity={0.6}
                  onPress={() => {
                    setSelectedColor(color);
                    setColorSheetVisible(false);
                  }}
                >
                  <View style={[styles.sheetSwatch, { backgroundColor: VEHICLE_COLOR_SWATCHES[color] ?? "#ccc" }, color === "White" && styles.colorSelectSwatchBorder]} />
                  <Text style={styles.sheetRowText}>{color}</Text>
                  {selectedColor === color ? (
                    <Ionicons name="checkmark" size={18} color="#0fa968" />
                  ) : null}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.appBg,
  },
  stickyHeader: {
    backgroundColor: colors.appBg,
    paddingTop: spacing.screenY,
    paddingBottom: spacing.xs,
    zIndex: 5,
  },
  backButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    flexDirection: "row",
    gap: 4,
    marginLeft: spacing.screenX,
    marginTop: spacing.screenY,
  },
  backText: {
    ...textStyles.body,
    color: colors.text,
  },
  header: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.xs,
    paddingBottom: spacing.lg,
  },
  headerTextWrap: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  headerBrandLogo: {
    alignItems: "center",
    height: 64,
    justifyContent: "center",
    minWidth: 88,
  },
  content: {
    paddingBottom: spacing.xl,
  },
  sheet: {
    backgroundColor: "transparent",
    flex: 1,
    paddingHorizontal: spacing.screenX,
  },
  title: {
    color: colors.text,
    fontFamily: "PlusJakartaSans-ExtraBold",
    fontSize: 27,
    letterSpacing: -0.8,
    lineHeight: 32,
    marginBottom: 4,
    marginTop: spacing.xs,
  },
  subtitle: {
    color: "#6B6B6B",
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 14,
    lineHeight: 21,
  },
  section: {
    marginBottom: 14,
  },
  sectionLabel: {
    color: "#888888",
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 11,
    letterSpacing: 0.8,
    lineHeight: 16,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  brandInputWrap: {
    justifyContent: "center",
    position: "relative",
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
  colorSelect: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#FCFEFD", borderColor: "#D7DEE7",
    borderRadius: 16, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 14,
  },
  colorSelectSwatch: { width: 18, height: 18, borderRadius: 9 },
  colorSelectSwatchBorder: { borderWidth: 1, borderColor: "#D7DEE7" },
  colorSelectText: { flex: 1, fontFamily: "PlusJakartaSans-SemiBold", fontSize: 15, color: colors.text },
  colorSelectPlaceholder: { color: colors.textMuted, fontFamily: "PlusJakartaSans-Regular" },

  sheetBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheetContainer: {
    backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingTop: 12, maxHeight: "70%",
  },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: "#E0E0E0", alignSelf: "center", marginBottom: 16 },
  sheetTitle: { fontFamily: "PlusJakartaSans-ExtraBold", fontSize: 20, color: colors.text, letterSpacing: -0.4, paddingHorizontal: 20, marginBottom: 8 },
  sheetRow: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 20, paddingVertical: 14 },
  sheetRowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#E6E6E4" },
  sheetSwatch: { width: 22, height: 22, borderRadius: 11 },
  sheetRowText: { flex: 1, fontFamily: "PlusJakartaSans-SemiBold", fontSize: 15, color: colors.text },
  regRow: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#3D6FB6",
    borderRadius: 6,
    borderWidth: 1.5,
    flexDirection: "row",
    overflow: "hidden",
  },
  regDetails: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  plateCountry: {
    alignItems: "center",
    alignSelf: "stretch",
    backgroundColor: "#3D6FB6",
    justifyContent: "center",
    width: 34,
  },
  regInputContainer: {
    marginBottom: 0,
    flex: 1,
  },
  regInput: {
    backgroundColor: "transparent",
    includeFontPadding: false,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  regInputText: {
    color: colors.text,
    fontFamily: "UKNumberPlate",
    fontSize: 24,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  error: {
    ...textStyles.meta,
    color: colors.danger,
    marginBottom: 12,
    textAlign: "center",
  },
  saveButton: {
    marginHorizontal: spacing.screenX,
    marginTop: spacing.lg,
  },
});
