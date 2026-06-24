import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface ListingDescriptionInput {
  address: string;
  amenities?: string[];
  capacity?: number;
  availabilityText?: string;
}

const SYSTEM_PROMPT = `You write parking space descriptions for a marketplace called Freespace.
Search the web to find what is actually near the address — major landmarks, stadiums,
hospitals, universities, shopping centres, DART/Luas/bus stops, motorway junctions.
Then write a single natural paragraph of 80–150 words in a helpful, host voice.
Cover: what type of space it is and how to access it, the neighbourhood, the most
notable nearby landmarks and transport links.
No bullet points, no marketing hyperbole, no phrases like "perfect for" or "ideal for".
Write only the paragraph — no title, no preamble.`;

export async function generateListingDescription(
  input: ListingDescriptionInput
): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  const amenityList =
    input.amenities?.length
      ? `Amenities: ${input.amenities.join(", ")}.`
      : "";
  const capacityLine =
    input.capacity && input.capacity > 1
      ? `Capacity: ${input.capacity} spaces.`
      : "";

  const userMessage = [
    `Address: ${input.address}`,
    amenityList,
    capacityLine,
    "Search for what is near this address, then write the parking space description.",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      tools: [{ type: "web_search_20260209", name: "web_search" }],
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const text = response.content
      .filter((block) => block.type === "text")
      .map((block) => (block as { type: "text"; text: string }).text)
      .join("")
      .trim();

    return text || null;
  } catch (err) {
    console.warn("generateListingDescription failed", err);
    return null;
  }
}
