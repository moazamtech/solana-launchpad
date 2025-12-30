"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import {
  AuthorityType,
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createInitializeMintInstruction,
  createMintToInstruction,
  createSetAuthorityInstruction,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import {
  createCreateMetadataAccountV3Instruction,
  PROGRAM_ID as TOKEN_METADATA_PROGRAM_ID,
} from "@metaplex-foundation/mpl-token-metadata";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";

type LaunchForm = {
  name: string;
  symbol: string;
  decimals: string;
  supply: string;
  description: string;
  metadataUrl: string;
  website: string;
  twitter: string;
  telegram: string;
};

type FormErrors = {
  name?: string;
  symbol?: string;
  decimals?: string;
  supply?: string;
  description?: string;
  image?: string;
};

const DEFAULT_FORM: LaunchForm = {
  name: "",
  symbol: "",
  decimals: "9",
  supply: "1000000000",
  description: "",
  metadataUrl: "",
  website: "",
  twitter: "",
  telegram: "",
};

const MAX_NAME_LENGTH = 32;
const MAX_SYMBOL_LENGTH = 10;
const MAX_DESCRIPTION_LENGTH = 200;
const MAX_IMAGE_SIZE_MB = 5;
const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;

// Estimated costs in SOL (these are approximate minimums)
const ESTIMATED_COSTS = {
  mintAccount: 0.00145, // Rent for mint account (~82 bytes)
  tokenAccount: 0.00204, // Rent for token account (~165 bytes)
  metadataAccount: 0.01, // Rent for metadata account (~679 bytes)
  transactions: 0.00015, // Transaction fees (3 txs × ~5000 lamports)
};

const TOTAL_ESTIMATED_COST =
  ESTIMATED_COSTS.mintAccount +
  ESTIMATED_COSTS.tokenAccount +
  ESTIMATED_COSTS.metadataAccount +
  ESTIMATED_COSTS.transactions;

function toBigIntAmount(value: string, decimals: number): bigint {
  const trimmed = value.trim();
  if (!trimmed) return 0n;
  if (!/^\d+$/.test(trimmed)) {
    throw new Error("Only whole numbers are supported for supply.");
  }
  return BigInt(trimmed) * BigInt(10) ** BigInt(decimals);
}

function validateForm(form: LaunchForm, imageFile: File | null): FormErrors {
  const errors: FormErrors = {};

  // Name validation
  if (!form.name.trim()) {
    errors.name = "Token name is required";
  } else if (form.name.length > MAX_NAME_LENGTH) {
    errors.name = `Name must be ${MAX_NAME_LENGTH} characters or less`;
  } else if (!/^[a-zA-Z0-9\s\-_]+$/.test(form.name)) {
    errors.name =
      "Name can only contain letters, numbers, spaces, hyphens, and underscores";
  }

  // Symbol validation
  if (!form.symbol.trim()) {
    errors.symbol = "Token symbol is required";
  } else if (form.symbol.length > MAX_SYMBOL_LENGTH) {
    errors.symbol = `Symbol must be ${MAX_SYMBOL_LENGTH} characters or less`;
  } else if (!/^[A-Z0-9]+$/.test(form.symbol.toUpperCase())) {
    errors.symbol = "Symbol can only contain letters and numbers";
  }

  // Decimals validation
  const decimals = Number(form.decimals);
  if (isNaN(decimals) || !Number.isInteger(decimals)) {
    errors.decimals = "Decimals must be a whole number";
  } else if (decimals < 0 || decimals > 9) {
    errors.decimals = "Decimals must be between 0 and 9";
  }

  // Supply validation
  if (!form.supply.trim()) {
    errors.supply = "Supply is required";
  } else if (!/^\d+$/.test(form.supply.trim())) {
    errors.supply = "Supply must be a whole number";
  } else if (BigInt(form.supply.trim()) <= 0n) {
    errors.supply = "Supply must be greater than 0";
  } else if (BigInt(form.supply.trim()) > BigInt("18446744073709551615")) {
    errors.supply = "Supply exceeds maximum allowed value";
  }

  // Description validation (optional but with limits)
  if (form.description.length > MAX_DESCRIPTION_LENGTH) {
    errors.description = `Description must be ${MAX_DESCRIPTION_LENGTH} characters or less`;
  }

  // Image validation
  if (imageFile) {
    if (imageFile.size > MAX_IMAGE_SIZE_BYTES) {
      errors.image = `Image must be ${MAX_IMAGE_SIZE_MB}MB or less`;
    }
    const validTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!validTypes.includes(imageFile.type)) {
      errors.image = "Image must be JPEG, PNG, GIF, or WebP";
    }
  }

  return errors;
}

function formatAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-6)}`;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="ml-2 rounded-md bg-slate-200 px-2 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-300"
      title="Copy to clipboard"
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

export default function Home() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction, connected } = useWallet();
  const [form, setForm] = useState<LaunchForm>(DEFAULT_FORM);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [status, setStatus] = useState<string>("");
  const [statusType, setStatusType] = useState<"info" | "success" | "error">(
    "info",
  );
  const [mintAddress, setMintAddress] = useState<string>("");
  const [tokenAccount, setTokenAccount] = useState<string>("");
  const [isLaunching, setIsLaunching] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  // Fetch wallet balance using onAccountChange for real-time updates
  useEffect(() => {
    if (!publicKey || !connection) {
      setWalletBalance(null);
      return;
    }

    let subscriptionId: number | null = null;
    let isMounted = true;

    // Function to update balance
    const updateBalance = async () => {
      try {
        // Use getAccountInfo as primary method (more reliable)
        const accountInfo = await connection.getAccountInfo(publicKey);
        if (isMounted) {
          if (accountInfo) {
            setWalletBalance(accountInfo.lamports / LAMPORTS_PER_SOL);
          } else {
            // Account exists but might have 0 balance, try getBalance
            const balance = await connection.getBalance(publicKey);
            setWalletBalance(balance / LAMPORTS_PER_SOL);
          }
        }
      } catch (err) {
        console.error("Failed to fetch balance:", err);
        if (isMounted) {
          // Fallback to getBalance
          try {
            const balance = await connection.getBalance(publicKey);
            setWalletBalance(balance / LAMPORTS_PER_SOL);
          } catch {
            setWalletBalance(0);
          }
        }
      }
    };

    // Get initial balance immediately
    updateBalance();

    // Subscribe to account changes for real-time updates
    try {
      subscriptionId = connection.onAccountChange(
        publicKey,
        (accountInfo) => {
          if (isMounted) {
            setWalletBalance(accountInfo.lamports / LAMPORTS_PER_SOL);
          }
        },
        "confirmed",
      );
    } catch (err) {
      console.error("Failed to subscribe to account changes:", err);
    }

    // Also poll every 5 seconds as backup
    const intervalId = setInterval(updateBalance, 5000);

    // Cleanup
    return () => {
      isMounted = false;
      clearInterval(intervalId);
      if (subscriptionId !== null) {
        connection.removeAccountChangeListener(subscriptionId).catch(() => {});
      }
    };
  }, [publicKey, connection]);

  // Manual refresh function for after transactions
  const refreshBalance = useCallback(async () => {
    if (!publicKey || !connection) return;
    try {
      const balance = await connection.getBalance(publicKey, "confirmed");
      setWalletBalance(balance / LAMPORTS_PER_SOL);
    } catch (err) {
      console.error("Failed to refresh balance:", err);
    }
  }, [publicKey, connection]);

  const solscanUrl = useMemo(() => {
    if (!mintAddress) return "";
    const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK || "mainnet-beta";
    const cluster = network === "mainnet-beta" ? "" : `?cluster=${network}`;
    return `https://solscan.io/token/${mintAddress}${cluster}`;
  }, [mintAddress]);

  const raydiumSwapUrl = useMemo(() => {
    if (!mintAddress) return "";
    const output = encodeURIComponent(mintAddress);
    return `https://raydium.io/swap/?inputCurrency=sol&outputCurrency=${output}`;
  }, [mintAddress]);

  const raydiumLiquidityUrl = useMemo(() => {
    if (!mintAddress) return "https://raydium.io/liquidity/create/cpmm-pool/";
    return `https://raydium.io/liquidity/create/cpmm-pool/?mint=${encodeURIComponent(mintAddress)}`;
  }, [mintAddress]);

  const updateForm = (field: keyof LaunchForm) => (value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    // Clear error for this field when user types
    if (formErrors[field as keyof FormErrors]) {
      setFormErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleImageChange = (file: File | null) => {
    setImageFile(file);
    setFormErrors((prev) => ({ ...prev, image: undefined }));

    if (!file) {
      setImagePreview("");
      return;
    }

    // Validate image
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      setFormErrors((prev) => ({
        ...prev,
        image: `Image must be ${MAX_IMAGE_SIZE_MB}MB or less`,
      }));
      return;
    }

    const validTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!validTypes.includes(file.type)) {
      setFormErrors((prev) => ({
        ...prev,
        image: "Image must be JPEG, PNG, GIF, or WebP",
      }));
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(typeof reader.result === "string" ? reader.result : "");
    };
    reader.readAsDataURL(file);
  };

  const setStatusMessage = (
    message: string,
    type: "info" | "success" | "error" = "info",
  ) => {
    setStatus(message);
    setStatusType(type);
  };

  const uploadMetadata = async () => {
    if (!imageFile) {
      setStatusMessage("Please upload an image first.", "error");
      return;
    }

    if (!form.name.trim() || !form.symbol.trim()) {
      setStatusMessage(
        "Please fill in token name and symbol before uploading metadata.",
        "error",
      );
      return;
    }

    // Validate image
    const errors = validateForm(form, imageFile);
    if (errors.image) {
      setFormErrors((prev) => ({ ...prev, image: errors.image }));
      setStatusMessage(errors.image, "error");
      return;
    }

    setIsUploading(true);
    setStatusMessage("Uploading image and metadata to IPFS...", "info");

    try {
      const formData = new FormData();
      formData.append("image", imageFile);
      formData.append("name", form.name.trim());
      formData.append("symbol", form.symbol.trim().toUpperCase());
      formData.append("description", form.description.trim());
      formData.append("website", form.website.trim());
      formData.append("twitter", form.twitter.trim());
      formData.append("telegram", form.telegram.trim());

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: "Upload failed" }));
        throw new Error(errorData.error || "Failed to upload metadata");
      }

      const data = (await response.json()) as {
        imageUrl: string;
        metadataUrl: string;
      };

      setForm((prev) => ({ ...prev, metadataUrl: data.metadataUrl }));
      setStatusMessage("Metadata uploaded successfully to IPFS!", "success");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Upload failed. Please try again.";
      setStatusMessage(message, "error");
    } finally {
      setIsUploading(false);
    }
  };

  const createToken = async () => {
    if (!publicKey) {
      setStatusMessage("Please connect your Phantom wallet first.", "error");
      return;
    }

    // Validate form
    const errors = validateForm(form, imageFile);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      const firstError = Object.values(errors)[0];
      setStatusMessage(firstError || "Please fix the form errors.", "error");
      return;
    }

    // Check wallet balance
    if (walletBalance !== null && walletBalance < TOTAL_ESTIMATED_COST) {
      setStatusMessage(
        `Insufficient balance. You need at least ~${TOTAL_ESTIMATED_COST.toFixed(4)} SOL. Current balance: ${walletBalance.toFixed(4)} SOL`,
        "error",
      );
      return;
    }

    setIsLaunching(true);
    setCurrentStep(1);
    setStatusMessage("Step 1/4: Creating mint account...", "info");

    try {
      const decimals = Number(form.decimals);

      const mintKeypair = Keypair.generate();
      const lamports =
        await connection.getMinimumBalanceForRentExemption(MINT_SIZE);
      const ata = await getAssociatedTokenAddress(
        mintKeypair.publicKey,
        publicKey,
      );

      const createMintTx = new Transaction().add(
        SystemProgram.createAccount({
          fromPubkey: publicKey,
          newAccountPubkey: mintKeypair.publicKey,
          space: MINT_SIZE,
          lamports,
          programId: TOKEN_PROGRAM_ID,
        }),
        createInitializeMintInstruction(
          mintKeypair.publicKey,
          decimals,
          publicKey,
          publicKey,
        ),
        createAssociatedTokenAccountInstruction(
          publicKey,
          ata,
          publicKey,
          mintKeypair.publicKey,
        ),
        createMintToInstruction(
          mintKeypair.publicKey,
          ata,
          publicKey,
          toBigIntAmount(form.supply, decimals),
        ),
      );

      setCurrentStep(2);
      setStatusMessage(
        "Step 2/4: Please sign the transaction in your wallet...",
        "info",
      );

      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash();
      createMintTx.recentBlockhash = blockhash;
      createMintTx.feePayer = publicKey;

      const signature = await sendTransaction(createMintTx, connection, {
        signers: [mintKeypair],
      });

      setStatusMessage("Step 2/4: Confirming transaction...", "info");
      await connection.confirmTransaction(
        { signature, blockhash, lastValidBlockHeight },
        "confirmed",
      );

      // Create metadata if URL provided
      if (form.metadataUrl.trim()) {
        setCurrentStep(3);
        setStatusMessage("Step 3/4: Creating on-chain metadata...", "info");

        const [metadataPda] = PublicKey.findProgramAddressSync(
          [
            Buffer.from("metadata"),
            TOKEN_METADATA_PROGRAM_ID.toBuffer(),
            mintKeypair.publicKey.toBuffer(),
          ],
          TOKEN_METADATA_PROGRAM_ID,
        );

        const metadataTx = new Transaction().add(
          createCreateMetadataAccountV3Instruction(
            {
              metadata: metadataPda,
              mint: mintKeypair.publicKey,
              mintAuthority: publicKey,
              payer: publicKey,
              updateAuthority: publicKey,
            },
            {
              createMetadataAccountArgsV3: {
                data: {
                  name: form.name.trim(),
                  symbol: form.symbol.trim().toUpperCase(),
                  uri: form.metadataUrl.trim(),
                  sellerFeeBasisPoints: 0,
                  creators: null,
                  collection: null,
                  uses: null,
                },
                isMutable: false, // Make metadata immutable for trust
                collectionDetails: null,
              },
            },
          ),
        );

        const metadataSig = await sendTransaction(metadataTx, connection);
        await connection.confirmTransaction(metadataSig, "confirmed");
      }

      setCurrentStep(4);
      setStatusMessage(
        "Step 4/4: Revoking mint and freeze authorities...",
        "info",
      );

      const revokeTx = new Transaction().add(
        createSetAuthorityInstruction(
          mintKeypair.publicKey,
          publicKey,
          AuthorityType.MintTokens,
          null,
        ),
        createSetAuthorityInstruction(
          mintKeypair.publicKey,
          publicKey,
          AuthorityType.FreezeAccount,
          null,
        ),
      );

      const revokeSig = await sendTransaction(revokeTx, connection);
      await connection.confirmTransaction(revokeSig, "confirmed");

      setMintAddress(mintKeypair.publicKey.toBase58());
      setTokenAccount(ata.toBase58());
      setCurrentStep(5);
      setStatusMessage(
        "Token created successfully! Mint and freeze authorities have been revoked.",
        "success",
      );

      // Refresh balance
      refreshBalance();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Token creation failed. Please try again.";
      setStatusMessage(message, "error");
      setCurrentStep(0);
    } finally {
      setIsLaunching(false);
    }
  };

  const openRaydiumLiquidity = () => {
    if (!mintAddress) {
      setStatusMessage(
        "Please create the token first before adding liquidity.",
        "error",
      );
      return;
    }
    window.open(raydiumLiquidityUrl, "_blank", "noopener,noreferrer");
  };

  const inputBaseClass =
    "w-full rounded-xl border bg-white/80 px-4 py-3 text-sm shadow-sm backdrop-blur transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500/50";

  const getInputClass = (hasError: boolean) =>
    `${inputBaseClass} ${hasError ? "border-red-400 bg-red-50/50" : "border-slate-200"}`;

  const isFormValid = useMemo(() => {
    const errors = validateForm(form, imageFile);
    return (
      Object.keys(errors).length === 0 && form.name.trim() && form.symbol.trim()
    );
  }, [form, imageFile]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-white">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/50 bg-white/80 backdrop-blur-lg">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="space-y-0.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-purple-600 sm:text-xs">
              Sol Launchpad
            </p>
            <h1 className="text-lg font-bold text-slate-900 sm:text-xl lg:text-2xl">
              Solana Token Launch Console
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {connected && (
              <div className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700">
                {walletBalance !== null
                  ? `${walletBalance.toFixed(4)} SOL`
                  : "Loading..."}
              </div>
            )}
            <WalletMultiButton className="!rounded-full !bg-purple-600 !px-4 !py-2 !text-sm !font-semibold !text-white hover:!bg-purple-700" />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        {/* Cost Estimate Banner */}
        <div className="mb-6 rounded-2xl border border-purple-200 bg-gradient-to-r from-purple-50 to-blue-50 p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-purple-900">
            Estimated Cost to Launch
          </h3>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span className="text-2xl font-bold text-purple-700">
              ~{TOTAL_ESTIMATED_COST.toFixed(4)} SOL
            </span>
            <span className="text-sm text-slate-600">
              (includes rent-exempt deposits + transaction fees)
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            This covers: Mint account (~0.00145 SOL) + Token account (~0.00204
            SOL) + Metadata (~0.01 SOL) + Transaction fees (~0.00015 SOL). No
            platform fees.
          </p>
        </div>

        <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
          {/* Left Column - Form */}
          <section className="flex-1 space-y-6">
            {/* Token Creation Form */}
            <div className="rounded-3xl border border-white/60 bg-white/90 p-5 shadow-xl backdrop-blur sm:p-6">
              <h2 className="text-xl font-bold text-slate-900">
                Create Your Token
              </h2>
              <p className="mt-1.5 text-sm text-slate-600">
                Launch your SPL token with immutable supply and on-chain
                metadata.
              </p>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {/* Token Name */}
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-slate-700">
                    Token Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    className={getInputClass(!!formErrors.name)}
                    value={form.name}
                    onChange={(e) => updateForm("name")(e.target.value)}
                    placeholder="e.g., Moon Rocket"
                    maxLength={MAX_NAME_LENGTH}
                    aria-invalid={!!formErrors.name}
                    aria-describedby={
                      formErrors.name ? "name-error" : undefined
                    }
                  />
                  {formErrors.name ? (
                    <p id="name-error" className="text-xs text-red-600">
                      {formErrors.name}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-400">
                      {form.name.length}/{MAX_NAME_LENGTH} characters
                    </p>
                  )}
                </div>

                {/* Symbol */}
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-slate-700">
                    Symbol <span className="text-red-500">*</span>
                  </label>
                  <input
                    className={getInputClass(!!formErrors.symbol)}
                    value={form.symbol}
                    onChange={(e) =>
                      updateForm("symbol")(e.target.value.toUpperCase())
                    }
                    placeholder="e.g., MOON"
                    maxLength={MAX_SYMBOL_LENGTH}
                    aria-invalid={!!formErrors.symbol}
                  />
                  {formErrors.symbol ? (
                    <p className="text-xs text-red-600">{formErrors.symbol}</p>
                  ) : (
                    <p className="text-xs text-slate-400">
                      {form.symbol.length}/{MAX_SYMBOL_LENGTH} characters
                    </p>
                  )}
                </div>

                {/* Decimals */}
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-slate-700">
                    Decimals <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="9"
                    className={getInputClass(!!formErrors.decimals)}
                    value={form.decimals}
                    onChange={(e) => updateForm("decimals")(e.target.value)}
                    placeholder="9"
                    aria-invalid={!!formErrors.decimals}
                  />
                  {formErrors.decimals ? (
                    <p className="text-xs text-red-600">
                      {formErrors.decimals}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-400">
                      0-9 (9 is standard, like SOL)
                    </p>
                  )}
                </div>

                {/* Total Supply */}
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-slate-700">
                    Total Supply <span className="text-red-500">*</span>
                  </label>
                  <input
                    className={getInputClass(!!formErrors.supply)}
                    value={form.supply}
                    onChange={(e) =>
                      updateForm("supply")(e.target.value.replace(/\D/g, ""))
                    }
                    placeholder="1000000000"
                    aria-invalid={!!formErrors.supply}
                  />
                  {formErrors.supply ? (
                    <p className="text-xs text-red-600">{formErrors.supply}</p>
                  ) : (
                    <p className="text-xs text-slate-400">
                      Fixed supply (cannot be changed after creation)
                    </p>
                  )}
                </div>
              </div>

              {/* Image & Metadata Section */}
              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                <h3 className="text-sm font-semibold text-slate-800">
                  Token Image & Metadata (Optional)
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Add an image and description to make your token stand out on
                  explorers.
                </p>

                <div className="mt-4 grid gap-4 sm:grid-cols-[140px,1fr]">
                  {/* Image Upload */}
                  <div className="space-y-2">
                    <label
                      className={`flex h-[140px] w-[140px] cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed transition-colors ${
                        formErrors.image
                          ? "border-red-400 bg-red-50"
                          : "border-slate-300 bg-white hover:border-purple-400 hover:bg-purple-50"
                      }`}
                    >
                      {imagePreview ? (
                        <img
                          src={imagePreview}
                          alt="Token preview"
                          className="h-full w-full rounded-2xl object-cover"
                        />
                      ) : (
                        <div className="text-center">
                          <div className="text-2xl">📷</div>
                          <span className="mt-1 block text-xs text-slate-400">
                            Upload image
                          </span>
                        </div>
                      )}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/gif,image/webp"
                        className="sr-only"
                        onChange={(e) =>
                          handleImageChange(e.target.files?.[0] ?? null)
                        }
                        aria-label="Upload token image"
                      />
                    </label>
                    {formErrors.image && (
                      <p className="text-xs text-red-600">{formErrors.image}</p>
                    )}
                    {imageFile && !formErrors.image && (
                      <button
                        type="button"
                        onClick={() => handleImageChange(null)}
                        className="text-xs text-slate-500 underline hover:text-slate-700"
                      >
                        Remove image
                      </button>
                    )}
                  </div>

                  {/* Description & Metadata URL */}
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium text-slate-700">
                        Description
                      </label>
                      <textarea
                        className={`${getInputClass(!!formErrors.description)} min-h-[80px] resize-none`}
                        value={form.description}
                        onChange={(e) =>
                          updateForm("description")(e.target.value)
                        }
                        placeholder="Brief description for explorers..."
                        maxLength={MAX_DESCRIPTION_LENGTH}
                      />
                      <p className="text-xs text-slate-400">
                        {form.description.length}/{MAX_DESCRIPTION_LENGTH}{" "}
                        characters
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium text-slate-700">
                        Metadata URL
                      </label>
                      <input
                        className={
                          inputBaseClass + " border-slate-200 bg-slate-100"
                        }
                        value={form.metadataUrl}
                        readOnly
                        placeholder="Upload image to generate..."
                      />
                    </div>

                    {/* Social Links */}
                    <div className="space-y-3 border-t border-slate-200 pt-4">
                      <p className="text-xs font-medium text-slate-600">
                        Social Links (Optional)
                      </p>

                      <div className="space-y-1.5">
                        <label className="block text-xs font-medium text-slate-600">
                          Website
                        </label>
                        <input
                          className={
                            inputBaseClass + " border-slate-200 py-2 text-xs"
                          }
                          value={form.website}
                          onChange={(e) =>
                            updateForm("website")(e.target.value)
                          }
                          placeholder="https://yourtoken.com"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-xs font-medium text-slate-600">
                          X (Twitter)
                        </label>
                        <input
                          className={
                            inputBaseClass + " border-slate-200 py-2 text-xs"
                          }
                          value={form.twitter}
                          onChange={(e) =>
                            updateForm("twitter")(e.target.value)
                          }
                          placeholder="https://x.com/yourtoken"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-xs font-medium text-slate-600">
                          Telegram
                        </label>
                        <input
                          className={
                            inputBaseClass + " border-slate-200 py-2 text-xs"
                          }
                          value={form.telegram}
                          onChange={(e) =>
                            updateForm("telegram")(e.target.value)
                          }
                          placeholder="https://t.me/yourtoken"
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      className="inline-flex items-center rounded-full border border-purple-300 bg-purple-50 px-4 py-2 text-xs font-semibold text-purple-700 transition hover:bg-purple-100 disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={uploadMetadata}
                      disabled={
                        isUploading ||
                        !imageFile ||
                        !form.name.trim() ||
                        !form.symbol.trim()
                      }
                    >
                      {isUploading ? (
                        <>
                          <span className="mr-2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-purple-600 border-t-transparent" />
                          Uploading...
                        </>
                      ) : form.metadataUrl ? (
                        "Re-upload Metadata"
                      ) : (
                        "Upload to IPFS"
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  className="inline-flex items-center rounded-full bg-purple-600 px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-purple-700 hover:shadow-xl disabled:cursor-not-allowed disabled:bg-slate-400 disabled:shadow-none"
                  onClick={createToken}
                  disabled={isLaunching || !connected || !isFormValid}
                >
                  {isLaunching ? (
                    <>
                      <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Creating Token...
                    </>
                  ) : !connected ? (
                    "Connect Wallet First"
                  ) : (
                    "Create Token"
                  )}
                </button>

                {mintAddress && (
                  <button
                    type="button"
                    className="rounded-full border border-purple-300 bg-white px-6 py-3 text-sm font-semibold text-purple-700 transition hover:bg-purple-50"
                    onClick={openRaydiumLiquidity}
                  >
                    Add Liquidity on Raydium
                  </button>
                )}
              </div>
            </div>

            {/* Status Panel */}
            <div
              className={`rounded-2xl border p-4 shadow-md sm:p-5 ${
                statusType === "success"
                  ? "border-green-200 bg-green-50"
                  : statusType === "error"
                    ? "border-red-200 bg-red-50"
                    : "border-white/60 bg-white/90"
              }`}
            >
              <h3 className="text-sm font-semibold text-slate-800">Status</h3>
              {status ? (
                <p
                  className={`mt-2 text-sm ${
                    statusType === "success"
                      ? "text-green-700"
                      : statusType === "error"
                        ? "text-red-700"
                        : "text-slate-600"
                  }`}
                >
                  {status}
                </p>
              ) : (
                <p className="mt-2 text-sm text-slate-400">
                  {connected
                    ? "Ready to create your token."
                    : "Connect your Phantom wallet to start."}
                </p>
              )}

              {/* Progress Steps */}
              {isLaunching && currentStep > 0 && (
                <div className="mt-4 flex gap-2">
                  {[1, 2, 3, 4].map((step) => (
                    <div
                      key={step}
                      className={`h-2 flex-1 rounded-full ${
                        step < currentStep
                          ? "bg-green-500"
                          : step === currentStep
                            ? "animate-pulse bg-purple-500"
                            : "bg-slate-200"
                      }`}
                    />
                  ))}
                </div>
              )}

              {/* Token Info */}
              {mintAddress && (
                <div className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-white p-4">
                  <div>
                    <p className="text-xs font-medium uppercase text-slate-500">
                      Mint Address
                    </p>
                    <div className="mt-1 flex items-center">
                      <code className="text-sm font-mono text-slate-800 break-all">
                        {mintAddress}
                      </code>
                      <CopyButton text={mintAddress} />
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase text-slate-500">
                      Your Token Account
                    </p>
                    <div className="mt-1 flex items-center">
                      <code className="text-sm font-mono text-slate-800 break-all">
                        {tokenAccount}
                      </code>
                      <CopyButton text={tokenAccount} />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-2">
                    <a
                      href={solscanUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center rounded-md bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-200"
                    >
                      View on Solscan ↗
                    </a>
                    <a
                      href={raydiumSwapUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center rounded-md bg-purple-100 px-3 py-1.5 text-xs font-medium text-purple-700 transition hover:bg-purple-200"
                    >
                      Swap on Raydium ↗
                    </a>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Right Column - Info & Checklist */}
          <section className="w-full space-y-6 lg:w-80">
            {/* Launch Checklist */}
            <div className="rounded-2xl border border-white/60 bg-white/90 p-5 shadow-lg">
              <h3 className="text-sm font-bold text-slate-800">
                Launch Checklist
              </h3>
              <ul className="mt-4 space-y-3">
                {[
                  { step: 1, text: "Connect Phantom wallet", done: connected },
                  {
                    step: 2,
                    text: "Fill token details",
                    done: form.name.trim() && form.symbol.trim(),
                  },
                  {
                    step: 3,
                    text: "Upload metadata (optional)",
                    done: !!form.metadataUrl,
                  },
                  { step: 4, text: "Create token mint", done: !!mintAddress },
                  { step: 5, text: "Add liquidity on Raydium", done: false },
                ].map(({ step, text, done }) => (
                  <li key={step} className="flex items-center gap-3 text-sm">
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                        done
                          ? "bg-green-500 text-white"
                          : "bg-slate-200 text-slate-500"
                      }`}
                    >
                      {done ? "✓" : step}
                    </span>
                    <span
                      className={
                        done ? "text-slate-600 line-through" : "text-slate-700"
                      }
                    >
                      {text}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* What Happens Section */}
            <div className="rounded-2xl border border-purple-200 bg-gradient-to-br from-purple-50 to-white p-5 shadow-lg">
              <h3 className="text-sm font-bold text-purple-900">
                What Happens When You Create
              </h3>
              <ul className="mt-3 space-y-2 text-xs text-slate-600">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-purple-500">●</span>
                  <span>New SPL token mint is created on Solana</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-purple-500">●</span>
                  <span>Full supply is minted to your wallet</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-purple-500">●</span>
                  <span>Metadata is stored on IPFS (decentralized)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-purple-500">●</span>
                  <span>
                    Mint authority is permanently revoked (no more tokens can be
                    created)
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-purple-500">●</span>
                  <span>
                    Freeze authority is revoked (tokens can never be frozen)
                  </span>
                </li>
              </ul>
            </div>

            {/* Network Info */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">
                  Network
                </span>
                <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800">
                  {process.env.NEXT_PUBLIC_SOLANA_NETWORK === "mainnet-beta"
                    ? "Mainnet"
                    : process.env.NEXT_PUBLIC_SOLANA_NETWORK === "testnet"
                      ? "Testnet"
                      : "Devnet"}
                </span>
              </div>
              {process.env.NEXT_PUBLIC_SOLANA_NETWORK !== "mainnet-beta" && (
                <p className="mt-2 text-xs text-amber-600">
                  You are on a test network. Tokens created here have no real
                  value.
                </p>
              )}
            </div>

            {/* Help Section */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-500">
              <p className="font-medium text-slate-700">Need help?</p>
              <p className="mt-1">
                After creating your token, add liquidity on Raydium to enable
                trading. Share the swap link to let others trade your token.
              </p>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white/80 py-4 text-center text-xs text-slate-500">
        <p>Sol Launchpad - Personal Use Only - No Fees</p>
      </footer>
    </div>
  );
}
