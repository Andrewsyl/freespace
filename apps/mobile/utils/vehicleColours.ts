// Vehicle colour swatches. Lives here rather than in VehicleTypeScreen because
// the booking summary shows the same swatch next to the driver's car, and two
// copies of the list would drift the moment one screen gains a colour.
export const VEHICLE_COLOURS = [
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
