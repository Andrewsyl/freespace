import Svg, { Path, SvgXml } from "react-native-svg";
import {
  siChevrolet,
  siChrysler,
  siAudi,
  siBmw,
  siCitroen,
  siDacia,
  siDsautomobiles,
  siFiat,
  siFord,
  siHonda,
  siHyundai,
  siJeep,
  siKia,
  siMaserati,
  siMazda,
  siMg,
  siMini,
  siMitsubishi,
  siNissan,
  siOpel,
  siPeugeot,
  siPolestar,
  siPorsche,
  siRenault,
  siSeat,
  siSkoda,
  siSmart,
  siSubaru,
  siSuzuki,
  siTesla,
  siToyota,
  siVauxhall,
  siVolkswagen,
  siVolvo,
} from "simple-icons";
import { StyleSheet, Text, View } from "react-native";
import { colors } from "../styles/theme";
import { brandSvgXml } from "./vehicleBrandLogos.generated";

const BRAND_ICONS = {
  Chevrolet: siChevrolet,
  Chrysler: siChrysler,
  Audi: siAudi,
  BMW: siBmw,
  Citroen: siCitroen,
  Dacia: siDacia,
  DS: siDsautomobiles,
  Fiat: siFiat,
  Ford: siFord,
  Honda: siHonda,
  Hyundai: siHyundai,
  Jeep: siJeep,
  Kia: siKia,
  Maserati: siMaserati,
  Mazda: siMazda,
  MG: siMg,
  Mini: siMini,
  Mitsubishi: siMitsubishi,
  Nissan: siNissan,
  Opel: siOpel,
  Peugeot: siPeugeot,
  Polestar: siPolestar,
  Porsche: siPorsche,
  Renault: siRenault,
  SEAT: siSeat,
  Seat: siSeat,
  Skoda: siSkoda,
  Smart: siSmart,
  Subaru: siSubaru,
  Suzuki: siSuzuki,
  Tesla: siTesla,
  Toyota: siToyota,
  Vauxhall: siVauxhall,
  Volkswagen: siVolkswagen,
  Volvo: siVolvo,
} as const;

const CUSTOM_BRAND_XML: Record<string, string> = {
  Cupra: brandSvgXml.Cupra,
  "Mercedes-Benz": brandSvgXml["Mercedes-Benz"],
  "Land Rover": brandSvgXml["Land Rover"],
};

function getFallbackText(make: string) {
  const cleaned = make.replace(/[^A-Za-z0-9]/g, "");
  if (!cleaned) return "CAR";
  return cleaned.length <= 3 ? cleaned.toUpperCase() : cleaned.slice(0, 2).toUpperCase();
}

export function VehicleBrandLogo({
  make,
  size = 20,
}: {
  make?: string | null;
  size?: number;
}) {
  if (!make) return null;
  const icon = BRAND_ICONS[make as keyof typeof BRAND_ICONS];
  const customXml = CUSTOM_BRAND_XML[make];

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      {icon ? (
        <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityLabel={`${make} logo`}>
          <Path d={icon.path} fill={colors.text} />
        </Svg>
      ) : customXml ? (
        <SvgXml xml={customXml} width={size} height={size} />
      ) : (
        <Text style={[styles.fallback, { fontSize: Math.round(size * 0.45) }]}>
          {getFallbackText(make)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    color: colors.text,
    fontFamily: "PlusJakartaSans-SemiBold",
    fontWeight: "600",
    letterSpacing: 0.4,
  },
});
