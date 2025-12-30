import { NextResponse } from "next/server";

export const runtime = "nodejs";

const PINATA_FILE_ENDPOINT = "https://api.pinata.cloud/pinning/pinFileToIPFS";
const PINATA_JSON_ENDPOINT = "https://api.pinata.cloud/pinning/pinJSONToIPFS";

// Validation constants
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_NAME_LENGTH = 32;
const MAX_SYMBOL_LENGTH = 10;
const MAX_DESCRIPTION_LENGTH = 200;

interface PinataResponse {
  IpfsHash?: string;
  PinSize?: number;
  Timestamp?: string;
}

// Get authentication headers - supports both JWT and API Key methods
function getPinataAuthHeaders(): Record<string, string> {
  const jwt = process.env.PINATA_JWT?.trim();
  const apiKey = process.env.PINATA_API_KEY?.trim();
  const apiSecret = process.env.PINATA_API_SECRET?.trim();

  // Prefer API Key authentication (more reliable)
  if (apiKey && apiSecret) {
    return {
      pinata_api_key: apiKey,
      pinata_secret_api_key: apiSecret,
    };
  }

  // Fall back to JWT
  if (jwt) {
    return {
      Authorization: `Bearer ${jwt}`,
    };
  }

  throw new Error("No Pinata credentials configured");
}

async function uploadFileToPinata(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file, file.name || "token-image");

  const authHeaders = getPinataAuthHeaders();

  const response = await fetch(PINATA_FILE_ENDPOINT, {
    method: "POST",
    headers: authHeaders,
    body: form,
  });

  if (!response.ok) {
    const text = await response.text();
    console.error("Pinata file upload error:", text);
    throw new Error(`Failed to upload image to IPFS`);
  }

  const data = (await response.json()) as PinataResponse;
  if (!data.IpfsHash) {
    throw new Error("IPFS upload failed - no hash returned");
  }

  return data.IpfsHash;
}

async function uploadJsonToPinata(metadata: object): Promise<string> {
  const authHeaders = getPinataAuthHeaders();

  const response = await fetch(PINATA_JSON_ENDPOINT, {
    method: "POST",
    headers: {
      ...authHeaders,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(metadata),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error("Pinata JSON upload error:", text);
    throw new Error(`Failed to upload metadata to IPFS`);
  }

  const data = (await response.json()) as PinataResponse;
  if (!data.IpfsHash) {
    throw new Error("IPFS upload failed - no hash returned");
  }

  return data.IpfsHash;
}

export async function POST(request: Request) {
  try {
    // Check for credentials
    const hasJwt = !!process.env.PINATA_JWT?.trim();
    const hasApiKey =
      !!process.env.PINATA_API_KEY?.trim() &&
      !!process.env.PINATA_API_SECRET?.trim();

    if (!hasJwt && !hasApiKey) {
      return NextResponse.json(
        { error: "Server configuration error: Missing Pinata credentials." },
        { status: 500 },
      );
    }

    // Parse form data
    const formData = await request.formData();
    const image = formData.get("image");
    const name = String(formData.get("name") ?? "").trim();
    const symbol = String(formData.get("symbol") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    const website = String(formData.get("website") ?? "").trim();
    const twitter = String(formData.get("twitter") ?? "").trim();
    const telegram = String(formData.get("telegram") ?? "").trim();

    // Validate image
    if (!(image instanceof File)) {
      return NextResponse.json(
        { error: "Please provide an image file." },
        { status: 400 },
      );
    }

    if (image.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: `Image too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`,
        },
        { status: 400 },
      );
    }

    if (!ALLOWED_TYPES.includes(image.type)) {
      return NextResponse.json(
        { error: "Invalid image format. Allowed: JPEG, PNG, GIF, WebP." },
        { status: 400 },
      );
    }

    // Validate name
    if (!name) {
      return NextResponse.json(
        { error: "Token name is required." },
        { status: 400 },
      );
    }

    if (name.length > MAX_NAME_LENGTH) {
      return NextResponse.json(
        { error: `Token name must be ${MAX_NAME_LENGTH} characters or less.` },
        { status: 400 },
      );
    }

    // Validate symbol
    if (!symbol) {
      return NextResponse.json(
        { error: "Token symbol is required." },
        { status: 400 },
      );
    }

    if (symbol.length > MAX_SYMBOL_LENGTH) {
      return NextResponse.json(
        { error: `Symbol must be ${MAX_SYMBOL_LENGTH} characters or less.` },
        { status: 400 },
      );
    }

    // Validate description length
    if (description.length > MAX_DESCRIPTION_LENGTH) {
      return NextResponse.json(
        {
          error: `Description must be ${MAX_DESCRIPTION_LENGTH} characters or less.`,
        },
        { status: 400 },
      );
    }

    // Upload image to IPFS
    const imageCid = await uploadFileToPinata(image);
    const imageUrl = `https://gateway.pinata.cloud/ipfs/${imageCid}`;

    // Build external links array (only include non-empty links)
    const externalLinks: { type: string; url: string }[] = [];
    if (website) externalLinks.push({ type: "website", url: website });
    if (twitter) externalLinks.push({ type: "twitter", url: twitter });
    if (telegram) externalLinks.push({ type: "telegram", url: telegram });

    // Create and upload metadata JSON (follows Metaplex standard)
    const metadata: Record<string, unknown> = {
      name,
      symbol: symbol.toUpperCase(),
      description,
      image: imageUrl,
      attributes: [],
      properties: {
        files: [
          {
            uri: imageUrl,
            type: image.type,
          },
        ],
        category: "image",
      },
      // Add external URLs if provided (follows common token metadata conventions)
      ...(website && { external_url: website }),
      // Extensions for social links
      extensions: {
        ...(website && { website }),
        ...(twitter && { twitter }),
        ...(telegram && { telegram }),
      },
    };

    // Remove empty extensions object
    if (Object.keys(metadata.extensions as object).length === 0) {
      delete metadata.extensions;
    }

    const metadataCid = await uploadJsonToPinata(metadata);
    const metadataUrl = `https://gateway.pinata.cloud/ipfs/${metadataCid}`;

    return NextResponse.json({
      success: true,
      imageUrl,
      metadataUrl,
    });
  } catch (error) {
    console.error("Upload error:", error);
    const message =
      error instanceof Error
        ? error.message
        : "Upload failed. Please try again.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
