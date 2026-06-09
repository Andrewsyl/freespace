import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Platform,
} from "react-native";
import { ArrowLeft, Check, ChevronDown, Search, X } from "lucide-react-native";
import { updateMe } from "../api";
import { useAuth } from "../auth";
import { VehicleBrandLogo } from "../components/VehicleBrandLogo";
import type { RootStackParamList } from "../types";
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
  { name: "Black",  hex: "#1F2937" },
  { name: "White",  hex: "#FFFFFF" },
  { name: "Silver", hex: "#C0C7D1" },
  { name: "Grey",   hex: "#8B95A7" },
  { name: "Blue",   hex: "#2563EB" },
  { name: "Red",    hex: "#DC2626" },
  { name: "Green",  hex: "#16A34A" },
  { name: "Orange", hex: "#EA580C" },
  { name: "Yellow", hex: "#CA8A04" },
  { name: "Brown",  hex: "#78350F" },
  { name: "Beige",  hex: "#D4B896" },
  { name: "Other",  hex: "#CBD5E1" },
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
  const makeSearchRef = useRef<TextInput | null>(null);

  const [plate, setPlate] = useState("");
  const [selectedMake, setSelectedMake] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [selectedColour, setSelectedColour] = useState("");
  const [makeModalOpen, setMakeModalOpen] = useState(false);
  const [modelModalOpen, setModelModalOpen] = useState(false);
  const [makeSearch, setMakeSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPlate(user?.vehiclePlate ?? "");
    setSelectedMake(user?.vehicleMake ?? "");
    setSelectedModel(user?.vehicleType ?? "");
    setSelectedColour(user?.vehicleColor ?? "");
  }, [user?.vehicleColor, user?.vehicleMake, user?.vehiclePlate, user?.vehicleType]);

  const filteredMakes = useMemo(() => {
    const q = makeSearch.trim().toLowerCase();
    if (!q) return VEHICLE_MAKES;
    return VEHICLE_MAKES.filter((m) => m.toLowerCase().includes(q));
  }, [makeSearch]);

  const availableModels = useMemo(
    () => (selectedMake ? VEHICLE_MODELS_BY_MAKE[selectedMake] ?? ["Other"] : []),
    [selectedMake]
  );

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

  const openMakeModal = () => {
    setMakeSearch("");
    setMakeModalOpen(true);
    setTimeout(() => makeSearchRef.current?.focus(), 300);
  };

  const selectMake = (make: string) => {
    setSelectedMake(make);
    setSelectedModel("");
    setMakeModalOpen(false);
  };

  const selectedColourHex = COLOURS.find((c) => c.name === selectedColour)?.hex;

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
            <ArrowLeft size={20} color={FG} strokeWidth={2.5} />
          </Pressable>
          <Text style={styles.navTitle}>My vehicle</Text>
          <View style={{ width: 38 }} />
        </View>

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[styles.content, { paddingBottom: 24 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

          {/* ── Registration plate ── */}
          <View
            style={styles.card}
            onLayout={(e) => { plateFieldY.current = e.nativeEvent.layout.y; }}
          >
            <Text style={styles.fieldLabel}>Registration plate</Text>
            <Pressable style={styles.plateWrap} onPress={() => plateInputRef.current?.focus()}>
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
                  onFocus={() =>
                    scrollRef.current?.scrollTo({ y: Math.max(0, plateFieldY.current - 100), animated: true })
                  }
                />
              </View>
            </Pressable>
            <Text style={styles.hint}>Required for parking space entry</Text>
          </View>

          {/* ── Make dropdown ── */}
          <View style={styles.card}>
            <Text style={styles.fieldLabel}>Make</Text>
            <Pressable style={styles.dropdownField} onPress={openMakeModal}>
              {selectedMake ? (
                <View style={styles.dropdownSelectedContent}>
                  <VehicleBrandLogo make={selectedMake} size={24} />
                  <Text style={styles.dropdownSelectedText}>{selectedMake}</Text>
                </View>
              ) : (
                <Text style={styles.dropdownPlaceholder}>Select make…</Text>
              )}
              <ChevronDown size={18} color={MUTED} strokeWidth={2} />
            </Pressable>
          </View>

          {/* ── Model dropdown ── */}
          {selectedMake ? (
            <View style={styles.card}>
              <Text style={styles.fieldLabel}>Model</Text>
              <Pressable
                style={styles.dropdownField}
                onPress={() => setModelModalOpen(true)}
              >
                {selectedModel ? (
                  <Text style={styles.dropdownSelectedText}>{selectedModel}</Text>
                ) : (
                  <Text style={styles.dropdownPlaceholder}>Select model…</Text>
                )}
                <ChevronDown size={18} color={MUTED} strokeWidth={2} />
              </Pressable>
            </View>
          ) : null}

          {/* ── Colour ── */}
          <View style={styles.card}>
            <View style={styles.fieldLabelRow}>
              <Text style={styles.fieldLabel}>Colour</Text>
              {selectedColour && selectedColourHex ? (
                <View style={styles.colourBadge}>
                  <View
                    style={[
                      styles.colourBadgeDot,
                      { backgroundColor: selectedColourHex },
                      selectedColour === "White" && styles.colourBadgeDotBorder,
                    ]}
                  />
                  <Text style={styles.colourBadgeText}>{selectedColour}</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.coloursGrid}>
              {COLOURS.map((colour) => {
                const active = selectedColour === colour.name;
                return (
                  <Pressable
                    key={colour.name}
                    style={styles.colourCell}
                    onPress={() => setSelectedColour(active ? "" : colour.name)}
                  >
                    <View style={[styles.colourRing, active && styles.colourRingActive]}>
                      <View
                        style={[
                          styles.colourCircle,
                          { backgroundColor: colour.hex },
                          colour.name === "White" && styles.colourCircleBorder,
                        ]}
                      />
                    </View>
                    <Text
                      style={[styles.colourName, active && styles.colourNameActive]}
                      numberOfLines={1}
                    >
                      {colour.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <Pressable
            style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!canSave}
          >
            <Text style={styles.saveBtnText}>{saving ? "Saving…" : "Save vehicle"}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {/* ── Make picker modal ── */}
      <Modal
        visible={makeModalOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setMakeModalOpen(false)}
      >
        <SafeAreaView style={styles.sheetContainer} edges={["top", "bottom"]}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Select make</Text>
            <Pressable style={styles.sheetClose} onPress={() => setMakeModalOpen(false)} hitSlop={10}>
              <X size={20} color={FG} strokeWidth={2.5} />
            </Pressable>
          </View>

          <View style={styles.sheetSearchWrap}>
            <Search size={16} color="#9ca3af" strokeWidth={2} />
            <TextInput
              ref={makeSearchRef}
              style={styles.sheetSearchInput}
              value={makeSearch}
              onChangeText={setMakeSearch}
              placeholder="Search makes…"
              placeholderTextColor="#9ca3af"
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
          </View>

          <FlatList
            data={filteredMakes}
            keyExtractor={(item) => item}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.sheetListContent}
            renderItem={({ item: make }) => {
              const active = selectedMake === make;
              return (
                <Pressable
                  style={[styles.sheetRow, active && styles.sheetRowActive]}
                  onPress={() => selectMake(make)}
                >
                  <View style={styles.sheetRowLogo}>
                    <VehicleBrandLogo make={make} size={26} />
                  </View>
                  <Text style={[styles.sheetRowText, active && styles.sheetRowTextActive]}>
                    {make}
                  </Text>
                  {active && (
                    <Check size={18} color={GREEN} strokeWidth={2.5} />
                  )}
                </Pressable>
              );
            }}
            ItemSeparatorComponent={() => <View style={styles.sheetSeparator} />}
          />
        </SafeAreaView>
      </Modal>

      {/* ── Model picker modal ── */}
      <Modal
        visible={modelModalOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModelModalOpen(false)}
      >
        <SafeAreaView style={styles.sheetContainer} edges={["top", "bottom"]}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Select model</Text>
            <Pressable style={styles.sheetClose} onPress={() => setModelModalOpen(false)} hitSlop={10}>
              <X size={20} color={FG} strokeWidth={2.5} />
            </Pressable>
          </View>

          <FlatList
            data={availableModels}
            keyExtractor={(item) => item}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.sheetListContent}
            renderItem={({ item: model }) => {
              const active = selectedModel === model;
              return (
                <Pressable
                  style={[styles.sheetRow, active && styles.sheetRowActive]}
                  onPress={() => {
                    setSelectedModel(active ? "" : model);
                    setModelModalOpen(false);
                  }}
                >
                  <Text style={[styles.sheetRowText, active && styles.sheetRowTextActive]}>
                    {model}
                  </Text>
                  {active && (
                    <Check size={18} color={GREEN} strokeWidth={2.5} />
                  )}
                </Pressable>
              );
            }}
            ItemSeparatorComponent={() => <View style={styles.sheetSeparator} />}
          />
        </SafeAreaView>
      </Modal>

    </SafeAreaView>
  );
}

const GREEN = "#0a8050";
const FG    = "#111827";
const LINE  = "#E5E7EB";
const MUTED = "#6b7280";

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F6F8" },
  flex: { flex: 1 },

  nav: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: LINE,
    backgroundColor: "#ffffff",
  },
  backBtn: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  navTitle: { fontFamily: "PlusJakartaSans-Bold", fontSize: 17, color: FG, letterSpacing: -0.3 },

  content: { paddingHorizontal: 16, paddingTop: 16 },

  card: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: LINE,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 22,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },

  fieldLabelRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginBottom: 14,
  },
  fieldLabel: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 13, color: MUTED,
    letterSpacing: 0.4, textTransform: "uppercase",
    marginBottom: 14,
  },

  // Plate
  plateWrap: {
    flexDirection: "row",
    borderRadius: 11, borderWidth: 2, borderColor: "#3D6FB6",
    overflow: "hidden", backgroundColor: "#ffffff",
    shadowColor: "#3D6FB6", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, shadowRadius: 8, elevation: 3,
  },
  plateEuStripe: {
    width: 40, backgroundColor: "#3D6FB6",
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
  hint: {
    fontFamily: "PlusJakartaSans-Regular", fontSize: 12,
    color: MUTED, marginTop: 10, textAlign: "center",
  },

  // Dropdown field
  dropdownField: {
    flexDirection: "row", alignItems: "center",
    borderWidth: 1.5, borderColor: LINE, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 14,
    backgroundColor: "#FAFAFA",
  },
  dropdownSelectedContent: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: 10,
  },
  dropdownSelectedText: {
    flex: 1, fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 15, color: FG,
  },
  dropdownPlaceholder: {
    flex: 1, fontFamily: "PlusJakartaSans-Regular",
    fontSize: 15, color: "#9ca3af",
  },

  // Colour badge in label row
  colourBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    marginBottom: 14,
  },
  colourBadgeDot: {
    width: 14, height: 14, borderRadius: 7,
  },
  colourBadgeDotBorder: {
    borderWidth: 1.5, borderColor: LINE,
  },
  colourBadgeText: {
    fontFamily: "PlusJakartaSans-SemiBold", fontSize: 13, color: GREEN,
  },

  // Colour grid — 4 per row
  coloursGrid: { flexDirection: "row", flexWrap: "wrap" },
  colourCell: {
    width: "25%", alignItems: "center",
    paddingBottom: 12, gap: 6,
  },
  colourRing: {
    padding: 3, borderRadius: 999,
    borderWidth: 2.5, borderColor: "transparent",
  },
  colourRingActive: { borderColor: GREEN },
  colourCircle: { width: 40, height: 40, borderRadius: 20 },
  colourCircleBorder: { borderWidth: 1.5, borderColor: LINE },
  colourName: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 11, color: MUTED, textAlign: "center",
  },
  colourNameActive: { fontFamily: "PlusJakartaSans-SemiBold", color: GREEN },

  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: LINE,
    backgroundColor: "#ffffff",
  },

  errorText: {
    fontFamily: "PlusJakartaSans-Regular", fontSize: 13,
    color: "#DC2626", textAlign: "center", marginBottom: 8,
  },

  saveBtn: {
    height: 52, borderRadius: 14,
    backgroundColor: "#0a8050",
    alignItems: "center", justifyContent: "center",
    marginTop: 4,
    shadowColor: "#0a7a50",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 5,
  },
  saveBtnDisabled: { opacity: 0.4, shadowOpacity: 0 },
  saveBtnText: {
    fontFamily: "PlusJakartaSans-SemiBold", fontSize: 16,
    color: "#ffffff", letterSpacing: -0.3,
  },

  // Modal sheet
  sheetContainer: {
    flex: 1, backgroundColor: "#ffffff",
  },
  sheetHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: LINE,
  },
  sheetTitle: {
    fontFamily: "PlusJakartaSans-Bold", fontSize: 17,
    color: FG, letterSpacing: -0.3,
  },
  sheetClose: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "#F3F4F6",
    alignItems: "center", justifyContent: "center",
  },
  sheetSearchWrap: {
    flexDirection: "row", alignItems: "center", gap: 10,
    marginHorizontal: 16, marginVertical: 12,
    borderWidth: 1.5, borderColor: LINE, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    backgroundColor: "#F9FAFB",
  },
  sheetSearchInput: {
    flex: 1, fontFamily: "PlusJakartaSans-Regular",
    fontSize: 15, color: FG, padding: 0,
  },
  sheetListContent: { paddingBottom: 24 },
  sheetRow: {
    flexDirection: "row", alignItems: "center", gap: 14,
    paddingHorizontal: 20, paddingVertical: 16,
  },
  sheetRowActive: { backgroundColor: "#F0FAF6" },
  sheetRowLogo: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: "#F9FAFB",
    borderWidth: 1, borderColor: LINE,
    alignItems: "center", justifyContent: "center",
  },
  sheetRowText: {
    flex: 1, fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 15, color: FG,
  },
  sheetRowTextActive: { color: GREEN },
  sheetSeparator: {
    height: 1, backgroundColor: "#F3F4F6",
    marginLeft: 20,
  },
});
