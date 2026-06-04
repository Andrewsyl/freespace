import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { updateMe } from "../api";
import { useAuth } from "../auth";
import { VehicleBrandLogo } from "../components/VehicleBrandLogo";
import type { RootStackParamList } from "../types";
import { colors, spacing } from "../styles/theme";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

type Props = NativeStackScreenProps<RootStackParamList, "VehicleType">;

const VEHICLE_MAKES = [
  "Alfa Romeo", "Audi", "BMW", "BYD", "Chevrolet", "Chrysler", "Citroen",
  "Cupra", "Dacia", "DS", "Fiat", "Ford", "Genesis", "Honda", "Hyundai",
  "Isuzu", "Jaguar", "Jeep", "Kia", "Land Rover", "Lexus", "Maserati",
  "Mazda", "Mercedes-Benz", "MG", "Mini", "Mitsubishi", "Nissan", "Opel",
  "Peugeot", "Polestar", "Porsche", "Renault", "Saab", "SEAT", "Skoda",
  "Smart", "Subaru", "Suzuki", "Tesla", "Toyota", "Vauxhall", "Volkswagen",
  "Volvo", "Other",
];

const VEHICLE_MODELS_BY_MAKE: Record<string, string[]> = {
  "Alfa Romeo": ["Giulia", "Giulietta", "MiTo", "Tonale", "Stelvio", "Junior", "159", "Brera", "Spider", "Other"],
  Audi: ["A1","A2","A3","A4","A5","A6","A7","A8","Q2","Q3","Q4 e-tron","Q5","Q7","Q8","Q8 e-tron","RS3","RS4","RS5","RS6","RS7","S3","S4","S5","S6","S7","S8","TT","R8","e-tron","Other"],
  BMW: ["1 Series","2 Series","3 Series","4 Series","5 Series","6 Series","7 Series","8 Series","M2","M3","M4","M5","M8","X1","X2","X3","X4","X5","X6","X7","Z4","i3","i4","i5","i7","iX","iX1","iX2","iX3","Other"],
  BYD: ["ATTO 3","DOLPHIN","SEAL","SEAL U","SEALION 7","HAN","TANG","Other"],
  Chevrolet: ["Aveo","Camaro","Captiva","Corvette","Cruze","Lacetti","Matiz","Orlando","Spark","Trax","Volt","Other"],
  Chrysler: ["300C","Crossfire","Grand Voyager","PT Cruiser","Voyager","Ypsilon","Other"],
  Citroen: ["C1","C2","C3","C3 Aircross","C4","C4 X","C5","C5 Aircross","Berlingo","Dispatch","Relay","Other"],
  Cupra: ["Born","Formentor","Leon","Leon Sportstourer","Ateca","Tavascan","Terramar","Other"],
  Dacia: ["Sandero","Sandero Stepway","Duster","Jogger","Spring","Logan","Other"],
  DS: ["DS 3","DS 3 Crossback","DS 4","DS 5","DS 7","DS 9","Other"],
  Fiat: ["500","500e","500X","600","Panda","Punto","Tipo","Doblo","Ducato","Other"],
  Ford: ["Fiesta","Focus","Focus ST","Mondeo","Ka","Ka+","EcoSport","Puma","Kuga","Edge","Mustang","Mustang Mach-E","Explorer","S-Max","Galaxy","Capri","Transit","Ranger","Other"],
  Genesis: ["G70","G80","G90","GV60","GV70","GV80","Other"],
  Honda: ["Civic","Jazz","Accord","CR-V","HR-V","ZR-V","Insight","Prelude","e","e:Ny1","Other"],
  Hyundai: ["i10","i20","i30","i40","ix20","ix35","Bayon","Inster","Kona","Tucson","Santa Fe","IONIQ","IONIQ 5","IONIQ 6","IONIQ 9","Other"],
  Isuzu: ["D-Max","MU-X","Trooper","Other"],
  Jaguar: ["E-PACE","F-PACE","I-PACE","XE","XF","XJ","F-TYPE","Other"],
  Jeep: ["Avenger","Renegade","Compass","Cherokee","Grand Cherokee","Wrangler","Other"],
  Kia: ["Picanto","Rio","Ceed","ProCeed","XCeed","Stonic","Niro","Sportage","Sorento","EV3","EV5","EV6","EV9","Other"],
  "Land Rover": ["Defender","Discovery","Discovery Sport","Freelander","Range Rover","Range Rover Evoque","Range Rover Velar","Range Rover Sport","Other"],
  Lexus: ["CT","IS","ES","LC","LS","LBX","UX","NX","RX","RZ","GX","LX","Other"],
  Maserati: ["Ghibli","GranCabrio","GranTurismo","Grecale","Levante","MC20","Quattroporte","Other"],
  Mazda: ["Mazda2","Mazda3","Mazda6","CX-3","CX-30","CX-5","CX-60","CX-80","CX-90","MX-5","MX-30","Other"],
  "Mercedes-Benz": ["A-Class","B-Class","C-Class","CLA","CLS","E-Class","S-Class","SL","GLA","GLB","GLC","GLE","GLS","EQA","EQB","EQC","EQE","EQS","Vito","V-Class","Sprinter","Other"],
  MG: ["MG3","MG4","MG5","MG Cyberster","MG ZS","HS","Marvel R","Other"],
  Mini: ["Hatch","Convertible","Clubman","Countryman","Aceman","Paceman","Other"],
  Mitsubishi: ["ASX","Colt","Eclipse Cross","L200","Mirage","Outlander","Pajero","Other"],
  Nissan: ["Micra","Note","Leaf","Juke","Qashqai","X-Trail","Ariya","350Z","370Z","Navara","Townstar","Other"],
  Opel: ["Adam","Corsa","Astra","Insignia","Crossland","Grandland","Mokka","Combo","Vivaro","Movano","Other"],
  Peugeot: ["108","208","2008","308","3008","408","508","5008","Partner","Rifter","Expert","Boxer","Other"],
  Polestar: ["Polestar 2","Polestar 3","Polestar 4","Other"],
  Porsche: ["718 Boxster","718 Cayman","911","Cayenne","Macan","Panamera","Taycan","Other"],
  Renault: ["Clio","Megane","Captur","Kadjar","Austral","Arkana","Scenic","Espace","Rafale","Twingo","Zoe","Kangoo","Trafic","Master","Other"],
  Saab: ["9-3","9-5","900","9000","Other"],
  SEAT: ["Mii","Ibiza","Leon","Arona","Ateca","Tarraco","Alhambra","Other"],
  Skoda: ["Citigo","Fabia","Rapid","Scala","Octavia","Superb","Kamiq","Karoq","Kodiaq","Elroq","Enyaq","Other"],
  Smart: ["fortwo","forfour","#1","#3","Roadster","Other"],
  Subaru: ["BRZ","Forester","Impreza","Legacy","Levorg","Outback","Solterra","XV","Other"],
  Suzuki: ["Across","Alto","Baleno","Ignis","Jimny","S-Cross","Swift","Swace","Vitara","Other"],
  Tesla: ["Model 3","Model S","Model X","Model Y","Cybertruck","Other"],
  Toyota: ["Aygo","Aygo X","Yaris","Yaris Cross","Corolla","Corolla Cross","Auris","Avensis","Camry","Prius","GR86","bZ4X","C-HR","RAV4","Land Cruiser","Hilux","Proace","Proace City","Other"],
  Vauxhall: ["Adam","Agila","Astra","Combo","Corsa","Crossland","Frontera","Grandland","Insignia","Meriva","Mokka","Viva","Vivaro","Movano","Zafira","Other"],
  Volkswagen: ["up!","Polo","Golf","Golf GTI","Golf R","Passat","Arteon","ID. Buzz","T-Cross","Taigo","T-Roc","Tiguan","Touareg","ID.3","ID.4","ID.5","ID.7","Touran","Sharan","Caddy","Transporter","Crafter","Other"],
  Volvo: ["V40","V60","V90","S60","S90","XC40","XC60","XC90","C40","EC40","EX30","EX40","EX90","Other"],
  Other: ["Other"],
};

const COLOURS = [
  { name: "Black",    hex: "#1F2937" },
  { name: "White",    hex: "#FFFFFF" },
  { name: "Silver",   hex: "#C0C7D1" },
  { name: "Grey",     hex: "#8B95A7" },
  { name: "Blue",     hex: "#2563EB" },
  { name: "Red",      hex: "#DC2626" },
  { name: "Green",    hex: "#16A34A" },
  { name: "Orange",   hex: "#EA580C" },
  { name: "Yellow",   hex: "#CA8A04" },
  { name: "Brown",    hex: "#78350F" },
  { name: "Beige",    hex: "#D4B896" },
  { name: "Other",    hex: "#CBD5E1" },
];

function formatIrishPlate(raw: string) {
  const upper = raw.toUpperCase();
  const endsWithSep = /[\s-]$/.test(raw);
  const segments = upper.split(/[\s-]+/).filter(Boolean);
  if (segments.length === 0) return "";
  if (segments.length >= 2 || endsWithSep) {
    const year   = (segments[0] ?? "").replace(/[^0-9]/g, "").slice(0, 3);
    const county = (segments[1] ?? "").replace(/[^A-Z]/g, "").slice(0, 2);
    const serial = (segments[2] ?? "").replace(/[^0-9]/g, "").slice(0, 6);
    if (!year) return "";
    if (endsWithSep && segments.length === 1) return `${year}-`;
    if (!county) return year;
    if (endsWithSep && segments.length === 2) return `${year}-${county}-`;
    if (!serial) return `${year}-${county}`;
    return `${year}-${county}-${serial}`;
  }
  const compact = segments[0].replace(/[^A-Z0-9]/g, "");
  const firstLetter = compact.search(/[A-Z]/);
  if (firstLetter === -1) return compact.slice(0, 3);
  const year   = compact.slice(0, firstLetter).slice(0, 3);
  const after  = compact.slice(firstLetter);
  const county = (after.match(/[A-Z]/g) ?? []).join("").slice(0, 2);
  const serial = after.replace(/[A-Z]/g, "").slice(0, 6);
  if (!year)   return compact.slice(0, 11);
  if (!county) return year;
  if (!serial) return `${year}-${county}`;
  return `${year}-${county}-${serial}`;
}

export function VehicleTypeScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { token, user, setAuthUser } = useAuth();
  const scrollRef = useRef<ScrollView | null>(null);
  const plateInputRef = useRef<TextInput | null>(null);
  const plateFieldY = useRef(0);
  const makeFieldY = useRef(0);

  const [plate, setPlate] = useState("");
  const [selectedMake, setSelectedMake] = useState("");
  const [brandQuery, setBrandQuery] = useState("");
  const [brandFocused, setBrandFocused] = useState(false);
  const [selectedModel, setSelectedModel] = useState("");
  const [modelQuery, setModelQuery] = useState("");
  const [modelFocused, setModelFocused] = useState(false);
  const [selectedColour, setSelectedColour] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPlate(user?.vehiclePlate ?? "");
    setSelectedMake(user?.vehicleMake ?? "");
    setBrandQuery(user?.vehicleMake ?? "");
    setSelectedModel(user?.vehicleType ?? "");
    setModelQuery(user?.vehicleType ?? "");
    setSelectedColour(user?.vehicleColor ?? "");
  }, [user?.vehicleColor, user?.vehicleMake, user?.vehiclePlate, user?.vehicleType]);

  const filteredMakes = useMemo(() => {
    const q = brandQuery.trim().toLowerCase();
    if (!q) return VEHICLE_MAKES;
    return VEHICLE_MAKES.filter((m) => m.toLowerCase().includes(q));
  }, [brandQuery]);

  const availableModels = useMemo(
    () => (selectedMake ? VEHICLE_MODELS_BY_MAKE[selectedMake] ?? ["Other"] : []),
    [selectedMake]
  );

  const filteredModels = useMemo(() => {
    const q = modelQuery.trim().toLowerCase();
    if (!q) return availableModels;
    return availableModels.filter((m) => m.toLowerCase().includes(q));
  }, [availableModels, modelQuery]);

  const canSave = !!token && !saving && !!plate.trim();

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      const response = await updateMe(token!, {
        vehicleMake: selectedMake || null,
        vehicleType: selectedModel || null,
        vehicleColor: selectedColour || null,
        vehiclePlate: plate.trim().toUpperCase(),
      });
      await setAuthUser(response.user);
      navigation.goBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save vehicle");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (route.params?.focusField !== "plate") return;
    const timer = setTimeout(() => {
      plateInputRef.current?.focus();
      scrollRef.current?.scrollTo({ y: Math.max(0, plateFieldY.current - 120), animated: true });
    }, 200);
    return () => clearTimeout(timer);
  }, [route.params?.focusField]);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
      >
        {/* Nav */}
        <View style={styles.nav}>
          <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={10}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={styles.navTitle}>My vehicle</Text>
          <View style={{ width: 38 }} />
        </View>

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[styles.content, { paddingBottom: 32 + Math.max(insets.bottom, 16) }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Brand logo hero */}
          <View style={styles.logoHero}>
            {selectedMake ? (
              <VehicleBrandLogo make={selectedMake} size={64} />
            ) : (
              <View style={styles.logoPlaceholder}>
                <Ionicons name="car-outline" size={32} color="#9ca3af" />
              </View>
            )}
            {selectedMake ? (
              <Text style={styles.logoMakeName}>{selectedMake}</Text>
            ) : (
              <Text style={styles.logoMakeName} />
            )}
            {selectedColour ? (
              <View style={[styles.colourDot, { backgroundColor: COLOURS.find(c => c.name === selectedColour)?.hex ?? "#ccc" }, selectedColour === "White" && styles.colourDotBorder]} />
            ) : null}
          </View>

          {/* Plate hero */}
          <View
            style={styles.plateSection}
            onLayout={(e) => { plateFieldY.current = e.nativeEvent.layout.y; }}
          >
            <Text style={styles.fieldLabel}>Registration plate</Text>
            <Pressable
              style={styles.plateWrap}
              onPress={() => plateInputRef.current?.focus()}
            >
              <View style={styles.plateEuStripe}>
                <Text style={styles.plateEuText}>IRL</Text>
              </View>
              <View style={styles.plateBody}>
                <TextInput
                  ref={plateInputRef}
                  style={styles.plateInput}
                  value={plate}
                  onChangeText={(v) => setPlate(formatIrishPlate(v))}
                  placeholder="191-D-12345"
                  placeholderTextColor="#b0b8c8"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  textAlign="center"
                  returnKeyType="done"
                  onFocus={() => scrollRef.current?.scrollTo({ y: Math.max(0, plateFieldY.current - 100), animated: true })}
                />
              </View>
            </Pressable>
            <Text style={styles.plateHint}>Required for entry to the parking space</Text>
          </View>

          {/* Make */}
          <View
            style={styles.fieldSection}
            onLayout={(e) => { makeFieldY.current = e.nativeEvent.layout.y; }}
          >
            <Text style={styles.fieldLabel}>Car make</Text>
            <View style={styles.makeInputWrap}>
              <Ionicons name="search-outline" size={16} color="#9ca3af" style={styles.makeSearchIcon} />
              <TextInput
                style={styles.makeInput}
                value={brandQuery}
                onChangeText={(v) => {
                  setBrandQuery(v);
                  if (v !== selectedMake) setSelectedMake("");
                }}
                onFocus={() => {
                  setBrandFocused(true);
                  scrollRef.current?.scrollTo({ y: Math.max(0, makeFieldY.current - 100), animated: true });
                }}
                onBlur={() => setTimeout(() => setBrandFocused(false), 120)}
                placeholder="Search car brand"
                placeholderTextColor="#9ca3af"
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="done"
              />
              {selectedMake ? (
                <Ionicons name="checkmark-circle" size={18} color="#0a8050" style={{ marginRight: 12 }} />
              ) : null}
            </View>
            {brandFocused && filteredMakes.length > 0 ? (
              <View style={styles.suggestions}>
                {filteredMakes.slice(0, 7).map((make, i) => (
                  <Pressable
                    key={make}
                    style={[styles.suggestionRow, i > 0 && styles.suggestionBorder]}
                    onPress={() => {
                      setSelectedMake(make);
                      setBrandQuery(make);
                      setSelectedModel("");
                      setModelQuery("");
                      setBrandFocused(false);
                    }}
                  >
                    <VehicleBrandLogo make={make} size={20} />
                    <Text style={styles.suggestionText}>{make}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>

          {/* Model */}
          {selectedMake ? (
            <View style={styles.fieldSection}>
              <Text style={styles.fieldLabel}>Model</Text>
              <View style={styles.makeInputWrap}>
                <Ionicons name="search-outline" size={16} color="#9ca3af" style={styles.makeSearchIcon} />
                <TextInput
                  style={styles.makeInput}
                  value={modelQuery}
                  onChangeText={(v) => {
                    setModelQuery(v);
                    if (v !== selectedModel) setSelectedModel("");
                  }}
                  onFocus={() => setModelFocused(true)}
                  onBlur={() => setTimeout(() => setModelFocused(false), 120)}
                  placeholder="Search model"
                  placeholderTextColor="#9ca3af"
                  autoCapitalize="words"
                  autoCorrect={false}
                  returnKeyType="done"
                />
                {selectedModel ? (
                  <Ionicons name="checkmark-circle" size={18} color="#0a8050" style={{ marginRight: 12 }} />
                ) : null}
              </View>
              {modelFocused && filteredModels.length > 0 ? (
                <View style={styles.suggestions}>
                  {filteredModels.slice(0, 7).map((model, i) => (
                    <Pressable
                      key={model}
                      style={[styles.suggestionRow, i > 0 && styles.suggestionBorder]}
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
          ) : null}

          {/* Colour grid */}
          <View style={styles.fieldSection}>
            <Text style={styles.fieldLabel}>Colour</Text>
            <View style={styles.colourGrid}>
              {COLOURS.map((c) => {
                const active = selectedColour === c.name;
                return (
                  <Pressable
                    key={c.name}
                    style={styles.colourCell}
                    onPress={() => setSelectedColour(active ? "" : c.name)}
                    hitSlop={4}
                  >
                    <View style={[
                      styles.colourCircle,
                      { backgroundColor: c.hex },
                      c.name === "White" && styles.colourCircleBorder,
                      active && styles.colourCircleActive,
                    ]}>
                      {active ? <Ionicons name="checkmark" size={16} color={c.name === "White" || c.name === "Beige" || c.name === "Silver" || c.name === "Yellow" ? "#0a8050" : "#ffffff"} /> : null}
                    </View>
                    <Text style={[styles.colourLabel, active && styles.colourLabelActive]} numberOfLines={1}>{c.name}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {/* Save */}
          <Pressable
            style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!canSave}
          >
            <Text style={styles.saveBtnText}>{saving ? "Saving…" : "Save vehicle"}</Text>
          </Pressable>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const GREEN = "#0a8050";
const FG    = "#111827";
const LINE  = "#D1D5DB";
const MUTED = "#374151";

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#ffffff" },
  flex: { flex: 1 },

  nav: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8,
    borderBottomWidth: 1, borderBottomColor: LINE,
  },
  backBtn: {
    width: 38, height: 38, alignItems: "center", justifyContent: "center",
  },
  navTitle: {
    fontFamily: "PlusJakartaSans-Bold", fontSize: 17, color: FG, letterSpacing: -0.3,
  },

  content: { paddingHorizontal: 20, paddingTop: 24 },

  // Logo hero
  logoHero: {
    alignItems: "center", marginBottom: 28, gap: 8,
  },
  logoPlaceholder: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: "#f3f4f6",
    alignItems: "center", justifyContent: "center",
  },
  logoMakeName: {
    fontFamily: "PlusJakartaSans-Bold", fontSize: 18, color: FG,
    letterSpacing: -0.3, minHeight: 22,
  },
  colourDot: {
    width: 12, height: 12, borderRadius: 6,
  },
  colourDotBorder: { borderWidth: 1, borderColor: LINE },

  // Plate
  plateSection: { marginBottom: 24 },
  fieldLabel: {
    fontFamily: "PlusJakartaSans-SemiBold", fontSize: 11,
    color: MUTED, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 10,
  },
  plateWrap: {
    flexDirection: "row",
    borderRadius: 10, borderWidth: 2, borderColor: "#3D6FB6",
    overflow: "hidden", backgroundColor: "#ffffff",
    shadowColor: "#3D6FB6", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, shadowRadius: 8, elevation: 3,
  },
  plateEuStripe: {
    width: 38, backgroundColor: "#3D6FB6",
    alignItems: "center", justifyContent: "center",
  },
  plateEuText: {
    fontFamily: "PlusJakartaSans-Bold", fontSize: 9,
    color: "#ffffff", letterSpacing: 1.2, textTransform: "uppercase",
  },
  plateBody: {
    flex: 1, paddingHorizontal: 16, paddingVertical: 14,
    alignItems: "center", justifyContent: "center",
  },
  plateInput: {
    fontFamily: "UKNumberPlate", fontSize: 28,
    color: FG, letterSpacing: 2, textTransform: "uppercase",
    width: "100%", textAlign: "center",
    includeFontPadding: false, padding: 0,
  },
  plateHint: {
    fontFamily: "PlusJakartaSans-Regular", fontSize: 12,
    color: "#6b7280", marginTop: 8, textAlign: "center",
  },

  // Make
  fieldSection: { marginBottom: 24 },
  makeInputWrap: {
    flexDirection: "row", alignItems: "center",
    borderWidth: 1, borderColor: LINE, borderRadius: 12,
    backgroundColor: "#f9fafb",
  },
  makeSearchIcon: { marginLeft: 14 },
  makeInput: {
    flex: 1, fontFamily: "PlusJakartaSans-SemiBold", fontSize: 15, color: FG,
    paddingHorizontal: 10, paddingVertical: 14,
  },
  suggestions: {
    marginTop: 6, borderRadius: 12, borderWidth: 1, borderColor: LINE,
    backgroundColor: "#ffffff", overflow: "hidden",
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06, shadowRadius: 10, elevation: 4,
  },
  suggestionRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    backgroundColor: "#ffffff",
  },
  suggestionBorder: { borderTopWidth: 1, borderTopColor: LINE },
  suggestionText: {
    fontFamily: "PlusJakartaSans-SemiBold", fontSize: 15, color: FG, flex: 1,
  },

  // Colour grid
  colourGrid: {
    flexDirection: "row", flexWrap: "wrap",
    marginHorizontal: -4,
  },
  colourCell: {
    width: "20%", alignItems: "center", paddingVertical: 10, paddingHorizontal: 4,
  },
  colourCircle: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: "center", justifyContent: "center",
    marginBottom: 6,
  },
  colourCircleBorder: { borderWidth: 1.5, borderColor: LINE },
  colourCircleActive: {
    borderWidth: 3, borderColor: GREEN,
  },
  colourLabel: {
    fontFamily: "PlusJakartaSans-SemiBold", fontSize: 11,
    color: MUTED, textAlign: "center",
  },
  colourLabelActive: { color: GREEN },

  error: {
    fontFamily: "PlusJakartaSans-Regular", fontSize: 13,
    color: colors.danger, textAlign: "center", marginBottom: 12,
  },

  // Save
  saveBtn: {
    marginTop: 8, height: 54, borderRadius: 14,
    backgroundColor: GREEN, alignItems: "center", justifyContent: "center",
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: {
    fontFamily: "PlusJakartaSans-Bold", fontSize: 16, color: "#ffffff", letterSpacing: -0.2,
  },
});
