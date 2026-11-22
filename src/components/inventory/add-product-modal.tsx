'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic,
  MicOff,
  Keyboard,
  Camera,
  Sparkles,
  ArrowLeft,
  Check,
  ChevronRight,
  X,
  Upload,
  Calendar,
  IndianRupee,
  Package,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Image as ImageIcon,
  Layers,
  Volume2,
  FileText,
  Clock,
  Tag,
  Hash,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useRetailStore } from '@/components/providers/retail-store-provider';
import { PRODUCT_CATEGORIES, ProductCategory } from '@/lib/retail-config';
import { Product } from '@/lib/retail-types';
import { addDaysIso, daysUntil, parseSentenceIntake } from '@/lib/retail-rules';
import { formatINR } from '@/lib/utils';
import {
  resolveProductImage,
  PRODUCT_IMAGES_CATALOGUE,
  ProductImageDefinition,
} from '@/lib/retail-images';

export type WorkflowMethod = 'voice' | 'text' | 'photo';
type ModalStep = 'choose' | WorkflowMethod | 'review';

export interface AddProductModalProps {
  intlLocale: string;
  initialProductId?: string;
  initialMethod?: WorkflowMethod;
  onClose: () => void;
  onOpenIntake?: () => void;
}

interface ProductDraft {
  sourceMethod: WorkflowMethod;
  matchedProductId?: string;
  name: string;
  category: ProductCategory;
  sku: string;
  barcode: string;
  quantity: number;
  costPrice: number;
  sellingPrice: number;
  mrp: number;
  mfgDate: string;
  expiryDate: string;
  batchNo: string;
  supplierId?: string;
  imagePreview?: string | null;
  imageUrl?: string;
}

interface SamplePreset {
  id: string;
  name: string;
  category: ProductCategory;
  mfgDate: string;
  expiryDate: string;
  costPrice: number;
  mrp: number;
  batchNo: string;
  emoji: string;
  imageUrl: string;
}

const SAMPLE_PRESETS: SamplePreset[] = [
  {
    id: 'milk',
    name: 'Amul Taaza Milk 1L',
    category: 'Dairy',
    mfgDate: '2026-11-10',
    expiryDate: '2027-02-10',
    costPrice: 56,
    mrp: 64,
    batchNo: 'BN-AMUL-261110',
    emoji: '🥛',
    imageUrl: '/products/amul-taaza.jpg',
  },
  {
    id: 'tea',
    name: 'Tata Tea Gold 250g',
    category: 'Beverages',
    mfgDate: '2026-08-20',
    expiryDate: '2027-08-20',
    costPrice: 130,
    mrp: 160,
    batchNo: 'BN-TTG-260820',
    emoji: '☕',
    imageUrl: '/products/tea.jpg',
  },
  {
    id: 'maggi',
    name: 'Maggi 2-Minute Noodles',
    category: 'Snacks',
    mfgDate: '2026-10-15',
    expiryDate: '2027-04-15',
    costPrice: 12,
    mrp: 14,
    batchNo: 'BN-MAGGI-261015',
    emoji: '🍜',
    imageUrl: '/products/maggi-noodles.jpg',
  },
  {
    id: 'lays',
    name: 'Lay\'s Classic Salted Chips',
    category: 'Snacks',
    mfgDate: '2026-10-20',
    expiryDate: '2027-03-20',
    costPrice: 16,
    mrp: 20,
    batchNo: 'BN-LAYS-261020',
    emoji: '🥔',
    imageUrl: '/products/lays-classic.jpg',
  },
  {
    id: 'tata-salt',
    name: 'Tata Salt 1kg Pack',
    category: 'Packaged Foods',
    mfgDate: '2026-09-01',
    expiryDate: '2028-09-01',
    costPrice: 24,
    mrp: 28,
    batchNo: 'BN-SALT-260901',
    emoji: '🧂',
    imageUrl: '/products/tata-salt.png',
  },
  {
    id: 'biscuit',
    name: 'Parle-G Biscuits 130g',
    category: 'Snacks',
    mfgDate: '2026-10-25',
    expiryDate: '2027-04-25',
    costPrice: 8,
    mrp: 10,
    batchNo: 'BN-PARLE-261025',
    emoji: '🍪',
    imageUrl: '/products/biscuits.jpg',
  },
];

export function AddProductModal({
  intlLocale,
  initialProductId,
  initialMethod,
  onClose,
}: AddProductModalProps) {
  const { products, suppliers, addProductWithBatch, addBatchToProduct } = useRetailStore();

  const [step, setStep] = useState<ModalStep>(initialMethod ?? 'choose');

  const initialProduct = useMemo(
    () => (initialProductId ? products.find((p) => p.id === initialProductId) : null),
    [initialProductId, products]
  );

  const [draft, setDraft] = useState<ProductDraft>(() => {
    const today = new Date().toISOString().slice(0, 10);
    const defaultExp = addDaysIso(new Date(), 180);
    const initialName = initialProduct?.name ?? '';
    const initialCat = initialProduct?.category ?? 'Daily Essentials';
    const initialImg = initialProduct?.imageUrl || resolveProductImage(initialName, initialCat);

    return {
      sourceMethod: initialMethod ?? 'text',
      matchedProductId: initialProduct?.id,
      name: initialName,
      category: initialCat,
      sku: initialProduct?.sku ?? `SKU-${Math.floor(100 + Math.random() * 899)}`,
      barcode: initialProduct?.barcode ?? String(8901000000000 + Math.floor(Math.random() * 999999)),
      quantity: 10,
      costPrice: initialProduct?.purchasePrice ?? 25,
      sellingPrice: initialProduct?.sellingPrice ?? 30,
      mrp: initialProduct?.mrp ?? 30,
      mfgDate: today,
      expiryDate: defaultExp,
      batchNo: `BN-${Date.now().toString().slice(-6)}`,
      supplierId: initialProduct?.supplierId ?? suppliers[0]?.id ?? 'sup-02',
      imagePreview: initialImg,
      imageUrl: initialImg,
    };
  });

  const handleOpenMethod = (method: WorkflowMethod) => {
    setDraft((prev) => ({ ...prev, sourceMethod: method }));
    setStep(method);
  };

  const handleSaveToInventory = () => {
    if (!draft.name.trim()) {
      toast.error('Please provide a valid product name.');
      return;
    }
    if (draft.quantity <= 0) {
      toast.error('Please enter a quantity greater than 0.');
      return;
    }
    if (draft.sellingPrice <= 0) {
      toast.error('Please provide a valid selling price.');
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const mfg = draft.mfgDate || today;
    const exp = draft.expiryDate || addDaysIso(new Date(), 180);
    const batchNo = draft.batchNo || `BN-${Date.now().toString().slice(-6)}`;

    // Resolve the best, high-resolution product image
    const finalImageUrl =
      draft.imageUrl ||
      draft.imagePreview ||
      resolveProductImage(draft.name, draft.category);

    // If an existing product is matched by ID or exact name
    const existing =
      draft.matchedProductId
        ? products.find((p) => p.id === draft.matchedProductId)
        : products.find((p) => p.name.toLowerCase() === draft.name.trim().toLowerCase());

    if (existing) {
      addBatchToProduct(existing.id, {
        batchNo,
        mfgDate: mfg,
        expiryDate: exp,
        qty: Number(draft.quantity),
        costPrice: Number(draft.costPrice) || existing.purchasePrice,
      });
      toast.success(
        `Added ${draft.quantity} units to existing product "${existing.name}" (Batch ${batchNo}).`
      );
    } else {
      addProductWithBatch(
        {
          name: draft.name.trim(),
          barcode: draft.barcode,
          sku: draft.sku,
          category: draft.category,
          mrp: Number(draft.mrp) || Number(draft.sellingPrice),
          purchasePrice: Number(draft.costPrice) || 0,
          sellingPrice: Number(draft.sellingPrice),
          minStock: 10,
          supplierId: draft.supplierId || suppliers[0]?.id || 'sup-02',
          shelfLifeDays: Math.max(30, daysUntil(exp, new Date(mfg))),
          imageUrl: finalImageUrl,
        },
        {
          batchNo,
          mfgDate: mfg,
          expiryDate: exp,
          qty: Number(draft.quantity),
          costPrice: Number(draft.costPrice) || 0,
        }
      );
      toast.success(
        `"${draft.name.trim()}" added to inventory with ${draft.quantity} units (Batch ${batchNo}).`
      );
    }

    onClose();
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div
        className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-product-title"
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className="relative z-10 max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-gray-200/90 bg-white p-6 sm:p-8 shadow-2xl dark:border-neutral-800 dark:bg-neutral-950"
      >
        <AnimatePresence mode="wait">
          {step === 'choose' && (
            <MethodSelectionView
              key="choose"
              onSelect={handleOpenMethod}
              onClose={onClose}
            />
          )}

          {step === 'voice' && (
            <VoiceWorkflow
              key="voice"
              intlLocale={intlLocale}
              products={products}
              draft={draft}
              onBack={() => setStep('choose')}
              onClose={onClose}
              onProceed={(updated) => {
                setDraft(updated);
                setStep('review');
              }}
            />
          )}

          {step === 'text' && (
            <TextWorkflow
              key="text"
              intlLocale={intlLocale}
              products={products}
              suppliers={suppliers}
              draft={draft}
              onBack={() => setStep('choose')}
              onClose={onClose}
              onProceed={(updated) => {
                setDraft(updated);
                setStep('review');
              }}
            />
          )}

          {step === 'photo' && (
            <PhotoWorkflow
              key="photo"
              intlLocale={intlLocale}
              products={products}
              draft={draft}
              onBack={() => setStep('choose')}
              onClose={onClose}
              onProceed={(updated) => {
                setDraft(updated);
                setStep('review');
              }}
            />
          )}

          {step === 'review' && (
            <CommonProductReview
              key="review"
              intlLocale={intlLocale}
              draft={draft}
              suppliers={suppliers}
              onBack={() => setStep(draft.sourceMethod)}
              onClose={onClose}
              onUpdateDraft={(updates) => setDraft((prev) => ({ ...prev, ...updates }))}
              onConfirm={handleSaveToInventory}
            />
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

/* -------------------------------------------------------------------------- */
/* 1. SELECTION MODAL: Three Balanced Cards, No Clutter                       */
/* -------------------------------------------------------------------------- */

interface MethodSelectionViewProps {
  onSelect: (method: WorkflowMethod) => void;
  onClose: () => void;
}

function MethodSelectionView({ onSelect, onClose }: MethodSelectionViewProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.18 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-start justify-between border-b border-gray-100 pb-5 dark:border-neutral-800">
        <div>
          <h2
            id="add-product-title"
            className="text-2xl font-bold tracking-tight text-gray-950 dark:text-white sm:text-3xl"
          >
            Add New Products
          </h2>
          <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">
            Choose how you'd like to add products to your inventory.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-neutral-800 dark:hover:text-gray-200"
          aria-label="Close dialog"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* 3 Balanced Cards */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {/* Option 1 – Voice Based (Blue) */}
        <motion.button
          type="button"
          whileHover={{ y: -4 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onSelect('voice')}
          className="group relative flex min-h-[260px] flex-col justify-between rounded-2xl border border-gray-200/90 bg-white p-6 text-left shadow-sm transition-all duration-200 hover:border-blue-400 hover:shadow-xl hover:shadow-blue-500/10 focus:outline-none focus:ring-4 focus:ring-blue-500/20 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-blue-600"
        >
          <div>
            <div className="flex items-center justify-between">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 transition-transform duration-200 group-hover:scale-105 dark:bg-blue-950/60 dark:text-blue-400">
                <Mic className="h-6 w-6" />
              </div>
              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700 ring-1 ring-inset ring-blue-500/20 dark:bg-blue-950/80 dark:text-blue-300">
                AI Powered
              </span>
            </div>

            <div className="mt-5">
              <h3 className="text-lg font-bold tracking-tight text-gray-950 dark:text-white">
                Add using Voice
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                Speak naturally to add product information.
              </p>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between border-t border-gray-100 pt-4 text-xs font-semibold text-blue-600 dark:border-neutral-800 dark:text-blue-400">
            <span>Start voice intake</span>
            <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </div>
        </motion.button>

        {/* Option 2 – Text Based (Purple) */}
        <motion.button
          type="button"
          whileHover={{ y: -4 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onSelect('text')}
          className="group relative flex min-h-[260px] flex-col justify-between rounded-2xl border border-gray-200/90 bg-white p-6 text-left shadow-sm transition-all duration-200 hover:border-purple-400 hover:shadow-xl hover:shadow-purple-500/10 focus:outline-none focus:ring-4 focus:ring-purple-500/20 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-purple-600"
        >
          <div>
            <div className="flex items-center justify-between">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 text-purple-600 transition-transform duration-200 group-hover:scale-105 dark:bg-purple-950/60 dark:text-purple-400">
                <Keyboard className="h-6 w-6" />
              </div>
              <span className="rounded-full bg-purple-50 px-2.5 py-1 text-[11px] font-semibold text-purple-700 ring-1 ring-inset ring-purple-500/20 dark:bg-purple-950/80 dark:text-purple-300">
                Manual Entry
              </span>
            </div>

            <div className="mt-5">
              <h3 className="text-lg font-bold tracking-tight text-gray-950 dark:text-white">
                Add using Text
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                Enter product information manually.
              </p>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between border-t border-gray-100 pt-4 text-xs font-semibold text-purple-600 dark:border-neutral-800 dark:text-purple-400">
            <span>Open form</span>
            <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </div>
        </motion.button>

        {/* Option 3 – Photo Based (Green) */}
        <motion.button
          type="button"
          whileHover={{ y: -4 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onSelect('photo')}
          className="group relative flex min-h-[260px] flex-col justify-between rounded-2xl border border-gray-200/90 bg-white p-6 text-left shadow-sm transition-all duration-200 hover:border-emerald-400 hover:shadow-xl hover:shadow-emerald-500/10 focus:outline-none focus:ring-4 focus:ring-emerald-500/20 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-emerald-600"
        >
          <div>
            <div className="flex items-center justify-between">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 transition-transform duration-200 group-hover:scale-105 dark:bg-emerald-950/60 dark:text-emerald-400">
                <Camera className="h-6 w-6" />
              </div>
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-500/20 dark:bg-emerald-950/80 dark:text-emerald-300">
                AI Powered
              </span>
            </div>

            <div className="mt-5">
              <h3 className="text-lg font-bold tracking-tight text-gray-950 dark:text-white">
                Add using Photo
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                Capture or upload a product image for AI-assisted identification.
              </p>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between border-t border-gray-100 pt-4 text-xs font-semibold text-emerald-600 dark:border-neutral-800 dark:text-emerald-400">
            <span>Upload or capture</span>
            <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </div>
        </motion.button>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end border-t border-gray-100 pt-4 dark:border-neutral-800">
        <Button variant="ghost" onClick={onClose} className="text-gray-500">
          Cancel
        </Button>
      </div>
    </motion.div>
  );
}

/* -------------------------------------------------------------------------- */
/* 2. DEDICATED WORKFLOW: Voice Based                                         */
/* -------------------------------------------------------------------------- */

interface VoiceWorkflowProps {
  intlLocale: string;
  products: Product[];
  draft: ProductDraft;
  onBack: () => void;
  onClose: () => void;
  onProceed: (updatedDraft: ProductDraft) => void;
}

function VoiceWorkflow({
  intlLocale,
  products,
  draft,
  onBack,
  onClose,
  onProceed,
}: VoiceWorkflowProps) {
  const [voiceLang, setVoiceLang] = useState<'en-IN' | 'kn-IN' | 'hi-IN'>('en-IN');
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const recognitionRef = useRef<any>(null);

  const sampleVoicePhrases = [
    {
      label: 'Maggi Noodles',
      text: 'Add 24 packets of Maggi Noodles at 14 rupees each, expiring in December 2027',
    },
    {
      label: 'Amul Taaza Milk',
      text: '20 packets Amul Taaza Milk 1L at 56 rupees, batch BN-992',
    },
    {
      label: 'Tata Salt',
      text: '15 packs Tata Salt 1kg at 28 rupees',
    },
  ];

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
    };
  }, []);

  const toggleListening = () => {
    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      setIsListening(false);
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      toast.info('Speech recognition not supported in this browser. You can type or use sample phrases below.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = voiceLang;
      recognition.interimResults = true;
      recognition.continuous = true;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        let currentTranscript = '';
        for (let i = 0; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript + ' ';
        }
        setTranscript(currentTranscript.trim());
      };

      recognition.onerror = (event: any) => {
        setIsListening(false);
        if (event.error !== 'no-speech') {
          toast.error(`Voice capture error: ${event.error}`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setIsListening(false);
      toast.error('Could not initialize microphone. Please check permissions.');
    }
  };

  const handleProcessVoice = async () => {
    const textToProcess = transcript.trim();
    if (!textToProcess) {
      toast.error('Please speak or enter product details first.');
      return;
    }

    setIsProcessing(true);

    try {
      const apiLocale = intlLocale ? intlLocale.slice(0, 2) : 'en';
      const res = await fetch(`/${apiLocale}/api/ai/voice-parse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: textToProcess,
          language: voiceLang,
          availableProducts: products.map((p) => ({
            id: p.id,
            name: p.name,
            category: p.category,
            sku: p.sku,
            barcode: p.barcode,
            mrp: p.mrp,
            purchasePrice: p.purchasePrice,
            shelfLifeDays: p.shelfLifeDays,
          })),
        }),
      });

      const json = await res.json();

      if (json.ok && json.data) {
        const d = json.data;
        const matched = products.find((p) => p.id === d.matchedProductId);
        const today = new Date().toISOString().slice(0, 10);
        const productName = d.productName || matched?.name || textToProcess.slice(0, 30);
        const category = (matched?.category || 'Daily Essentials') as ProductCategory;
        const matchedImage = resolveProductImage(productName, category);

        onProceed({
          ...draft,
          sourceMethod: 'voice',
          matchedProductId: matched?.id,
          name: productName,
          category,
          quantity: d.quantity ? Number(d.quantity) : 10,
          costPrice: d.costPrice || matched?.purchasePrice || 25,
          sellingPrice: matched?.sellingPrice || (d.costPrice ? Math.round(d.costPrice * 1.25) : 30),
          mrp: matched?.mrp || (d.costPrice ? Math.round(d.costPrice * 1.3) : 35),
          mfgDate: d.mfgDate || today,
          expiryDate: d.expiryDate || addDaysIso(new Date(), matched?.shelfLifeDays || 180),
          batchNo: d.batchNo || `BN-VOICE-${Date.now().toString().slice(-6)}`,
          imageUrl: matchedImage,
          imagePreview: matchedImage,
        });
        toast.success('Spoken details and product image extracted!');
        return;
      }
    } catch {
      // Fallback
    }

    // Local client-side parser fallback
    const parsed = parseSentenceIntake(textToProcess, products);
    const today = new Date().toISOString().slice(0, 10);
    const matched = parsed.matchedProduct;
    const productName = matched?.name || parsed.productNameQuery || 'Spoken Product';
    const category = (matched?.category || 'Daily Essentials') as ProductCategory;
    const matchedImage = resolveProductImage(productName, category);

    onProceed({
      ...draft,
      sourceMethod: 'voice',
      matchedProductId: matched?.id,
      name: productName,
      category,
      quantity: parsed.quantity > 0 ? parsed.quantity : 10,
      costPrice: parsed.unitPrice || matched?.purchasePrice || 25,
      sellingPrice: matched?.sellingPrice || (parsed.unitPrice ? Math.round(parsed.unitPrice * 1.25) : 30),
      mrp: matched?.mrp || (parsed.unitPrice ? Math.round(parsed.unitPrice * 1.3) : 35),
      mfgDate: today,
      expiryDate: addDaysIso(new Date(), matched?.shelfLifeDays || 180),
      batchNo: `BN-VOICE-${Date.now().toString().slice(-6)}`,
      imageUrl: matchedImage,
      imagePreview: matchedImage,
    });
    toast.success('Spoken details parsed! Please verify.');
    setIsProcessing(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -12 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      {/* Top Bar */}
      <div className="flex items-center justify-between border-b border-gray-100 pb-4 dark:border-neutral-800">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-neutral-700 dark:text-gray-300 dark:hover:bg-neutral-800"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to methods
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight text-gray-950 dark:text-white">
                Add using Voice
              </h2>
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-950/80 dark:text-blue-300">
                AI Powered
              </span>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-neutral-800"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Language Selector */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-gray-50 p-3.5 dark:bg-neutral-900">
        <div className="flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-gray-300">
          <Volume2 className="h-4 w-4 text-blue-600" />
          <span>Speech Language:</span>
        </div>
        <div className="flex gap-1.5">
          {[
            { id: 'en-IN' as const, label: 'English' },
            { id: 'kn-IN' as const, label: 'ಕನ್ನಡ (Kannada)' },
            { id: 'hi-IN' as const, label: 'हिन्दी (Hindi)' },
          ].map((lang) => (
            <button
              key={lang.id}
              type="button"
              onClick={() => setVoiceLang(lang.id)}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                voiceLang === lang.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white text-gray-700 hover:bg-gray-100 dark:bg-neutral-800 dark:text-gray-300 dark:hover:bg-neutral-700'
              }`}
            >
              {lang.label}
            </button>
          ))}
        </div>
      </div>

      {/* Center Interactive Microphone Card */}
      <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50/30 p-8 text-center dark:border-blue-900/60 dark:bg-blue-950/10">
        <div className="relative">
          {isListening && (
            <motion.div
              animate={{ scale: [1, 1.4, 1], opacity: [0.7, 0, 0.7] }}
              transition={{ repeat: Infinity, duration: 1.6 }}
              className="absolute inset-0 rounded-full bg-blue-500/30"
            />
          )}
          <button
            type="button"
            onClick={toggleListening}
            className={`relative flex h-20 w-20 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105 active:scale-95 ${
              isListening
                ? 'bg-red-500 text-white shadow-red-500/25 animate-pulse'
                : 'bg-blue-600 text-white shadow-blue-600/25 hover:bg-blue-700'
            }`}
          >
            {isListening ? <MicOff className="h-8 w-8" /> : <Mic className="h-8 w-8" />}
          </button>
        </div>

        <p className="mt-4 text-sm font-semibold text-gray-900 dark:text-white">
          {isListening ? 'Listening... Speak clearly into your mic' : 'Click to start speaking'}
        </p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          State product name, quantity, and price naturally (e.g. "Add 20 packets of milk at ₹54")
        </p>
      </div>

      {/* Spoken Transcript Area */}
      <div className="space-y-2">
        <label className="flex items-center justify-between text-xs font-semibold text-gray-700 dark:text-gray-300">
          <span>Captured Transcript</span>
          {transcript && (
            <button
              type="button"
              onClick={() => setTranscript('')}
              className="text-[11px] font-normal text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              Clear
            </button>
          )}
        </label>
        <textarea
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="Your spoken words will appear here. You can also edit or type directly..."
          rows={3}
          className="w-full rounded-2xl border border-gray-200 bg-white p-3.5 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
        />
      </div>

      {/* Quick Test Voice Prompts */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">
          Quick test shortcuts:
        </p>
        <div className="flex flex-wrap gap-2">
          {sampleVoicePhrases.map((phrase) => (
            <button
              key={phrase.label}
              type="button"
              onClick={() => setTranscript(phrase.text)}
              className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 transition hover:border-blue-300 hover:bg-blue-50/50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-gray-300 dark:hover:border-blue-700"
            >
              <Sparkles className="mr-1.5 inline h-3 w-3 text-blue-500" />
              {phrase.label}
            </button>
          ))}
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex items-center justify-between border-t border-gray-100 pt-4 dark:border-neutral-800">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button
          onClick={handleProcessVoice}
          disabled={!transcript.trim() || isProcessing}
          className="gap-2 bg-blue-600 hover:bg-blue-700 focus-visible:ring-blue-600"
        >
          {isProcessing ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" /> Processing with AI...
            </>
          ) : (
            <>
              Review Product Details <ChevronRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </motion.div>
  );
}

/* -------------------------------------------------------------------------- */
/* 3. DEDICATED WORKFLOW: Text Based                                          */
/* -------------------------------------------------------------------------- */

interface TextWorkflowProps {
  intlLocale: string;
  products: Product[];
  suppliers: Array<{ id: string; name: string }>;
  draft: ProductDraft;
  onBack: () => void;
  onClose: () => void;
  onProceed: (updatedDraft: ProductDraft) => void;
}

function TextWorkflow({
  intlLocale,
  products,
  suppliers,
  draft,
  onBack,
  onClose,
  onProceed,
}: TextWorkflowProps) {
  const [form, setForm] = useState({
    name: draft.name,
    category: draft.category,
    sku: draft.sku,
    barcode: draft.barcode,
    quantity: String(draft.quantity || 10),
    costPrice: String(draft.costPrice || 25),
    sellingPrice: String(draft.sellingPrice || 30),
    mfgDate: draft.mfgDate,
    expiryDate: draft.expiryDate,
    batchNo: draft.batchNo,
    supplierId: draft.supplierId || suppliers[0]?.id || '',
    matchedProductId: draft.matchedProductId || '',
  });

  // Dynamically match photography as the user enters product title
  const previewImage = useMemo(() => {
    return resolveProductImage(form.name, form.category, draft.imageUrl);
  }, [form.name, form.category, draft.imageUrl]);

  const handleSelectExisting = (productId: string) => {
    const matched = products.find((p) => p.id === productId);
    if (matched) {
      setForm((prev) => ({
        ...prev,
        matchedProductId: matched.id,
        name: matched.name,
        category: matched.category,
        sku: matched.sku,
        barcode: matched.barcode,
        costPrice: String(matched.purchasePrice),
        sellingPrice: String(matched.sellingPrice),
        supplierId: matched.supplierId || prev.supplierId,
      }));
    }
  };

  const handleGenerateSku = () => {
    const prefix = form.name ? form.name.slice(0, 3).toUpperCase() : 'SKU';
    setForm((prev) => ({
      ...prev,
      sku: `${prefix}-${Math.floor(100 + Math.random() * 899)}`,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Please enter a product name.');
      return;
    }
    const qty = Number(form.quantity);
    if (!qty || qty <= 0) {
      toast.error('Please enter a valid quantity.');
      return;
    }
    const cost = Number(form.costPrice) || 0;
    const sell = Number(form.sellingPrice) || 0;
    if (sell <= 0) {
      toast.error('Please enter a valid selling price.');
      return;
    }

    const resolvedPhoto = resolveProductImage(form.name, form.category);

    onProceed({
      ...draft,
      sourceMethod: 'text',
      matchedProductId: form.matchedProductId || undefined,
      name: form.name.trim(),
      category: form.category,
      sku: form.sku.trim(),
      barcode: form.barcode.trim(),
      quantity: qty,
      costPrice: cost,
      sellingPrice: sell,
      mrp: Math.max(sell, Math.round(sell * 1.1)),
      mfgDate: form.mfgDate,
      expiryDate: form.expiryDate,
      batchNo: form.batchNo || `BN-${Date.now().toString().slice(-6)}`,
      supplierId: form.supplierId,
      imageUrl: resolvedPhoto,
      imagePreview: resolvedPhoto,
    });
  };

  return (
    <motion.form
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -12 }}
      transition={{ duration: 0.2 }}
      onSubmit={handleSubmit}
      className="space-y-6"
    >
      {/* Top Bar */}
      <div className="flex items-center justify-between border-b border-gray-100 pb-4 dark:border-neutral-800">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-neutral-700 dark:text-gray-300 dark:hover:bg-neutral-800"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to methods
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight text-gray-950 dark:text-white">
                Add using Text
              </h2>
              <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-700 dark:bg-purple-950/80 dark:text-purple-300">
                Manual Entry
              </span>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-neutral-800"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Live Image Match Banner */}
      <div className="flex items-center gap-3 rounded-2xl border border-purple-100 bg-purple-50/40 p-3 dark:border-purple-950/40 dark:bg-purple-950/20">
        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-purple-200 bg-white dark:border-purple-900/60 dark:bg-neutral-900">
          <img src={previewImage} alt="Matched photography" className="h-full w-full object-cover" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-purple-950 dark:text-purple-200">
              Matched Photography
            </span>
            <span className="rounded-full bg-purple-100 px-1.5 py-0.2 text-[10px] font-semibold text-purple-700 dark:bg-purple-900 dark:text-purple-300">
              Auto-Linked
            </span>
          </div>
          <p className="truncate text-xs text-gray-500 dark:text-gray-400">
            {form.name.trim() ? `Image auto-linked to "${form.name}"` : 'Type product name to auto-link accurate store photography'}
          </p>
        </div>
      </div>

      {/* Quick Link to Catalog (Optional) */}
      <div className="rounded-2xl bg-gray-50 p-4 dark:bg-neutral-900 border border-gray-100 dark:border-neutral-800">
        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
          Or restock an existing item from catalog (optional):
        </label>
        <select
          value={form.matchedProductId}
          onChange={(e) => handleSelectExisting(e.target.value)}
          className="mt-1.5 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-xs font-medium text-gray-900 outline-none focus:border-purple-400 focus:ring-4 focus:ring-purple-500/10 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
        >
          <option value="">-- New Product (Not in catalog yet) --</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.sku}) — Current price: ₹{p.sellingPrice}
            </option>
          ))}
        </select>
      </div>

      {/* Main Form Fields */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200">
            Product Item Name *
          </label>
          <input
            required
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Amul Taaza Milk 1L, Fortune Sunflower Oil, Maggi Noodles"
            className="mt-1.5 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition focus:border-purple-400 focus:ring-4 focus:ring-purple-500/10 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200">
            Category
          </label>
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value as ProductCategory })}
            className="mt-1.5 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition focus:border-purple-400 focus:ring-4 focus:ring-purple-500/10 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
          >
            {PRODUCT_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200">
            Quantity to Add (Units) *
          </label>
          <input
            required
            type="number"
            min={1}
            value={form.quantity}
            onChange={(e) => setForm({ ...form, quantity: e.target.value })}
            placeholder="10"
            className="mt-1.5 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition focus:border-purple-400 focus:ring-4 focus:ring-purple-500/10 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200">
            Purchase Cost Price (₹)
          </label>
          <input
            type="number"
            min={0}
            step="0.01"
            value={form.costPrice}
            onChange={(e) => setForm({ ...form, costPrice: e.target.value })}
            placeholder="25.00"
            className="mt-1.5 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition focus:border-purple-400 focus:ring-4 focus:ring-purple-500/10 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200">
            Selling Price (₹) *
          </label>
          <input
            required
            type="number"
            min={0}
            step="0.01"
            value={form.sellingPrice}
            onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })}
            placeholder="30.00"
            className="mt-1.5 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition focus:border-purple-400 focus:ring-4 focus:ring-purple-500/10 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
          />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200">
              SKU (Stock Keeping Unit)
            </label>
            <button
              type="button"
              onClick={handleGenerateSku}
              className="text-[11px] font-semibold text-purple-600 hover:text-purple-700 dark:text-purple-400"
            >
              Generate
            </button>
          </div>
          <input
            type="text"
            value={form.sku}
            onChange={(e) => setForm({ ...form, sku: e.target.value })}
            placeholder="e.g. DAI-001"
            className="mt-1.5 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition focus:border-purple-400 focus:ring-4 focus:ring-purple-500/10 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200">
            Batch Number
          </label>
          <input
            type="text"
            value={form.batchNo}
            onChange={(e) => setForm({ ...form, batchNo: e.target.value })}
            placeholder="BN-1002"
            className="mt-1.5 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition focus:border-purple-400 focus:ring-4 focus:ring-purple-500/10 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200">
            Manufacturing Date
          </label>
          <input
            type="date"
            value={form.mfgDate}
            onChange={(e) => setForm({ ...form, mfgDate: e.target.value })}
            className="mt-1.5 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition focus:border-purple-400 focus:ring-4 focus:ring-purple-500/10 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200">
            Expiry Date
          </label>
          <input
            type="date"
            value={form.expiryDate}
            onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
            className="mt-1.5 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition focus:border-purple-400 focus:ring-4 focus:ring-purple-500/10 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
          />
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex items-center justify-between border-t border-gray-100 pt-4 dark:border-neutral-800">
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button
          type="submit"
          className="gap-2 bg-purple-600 hover:bg-purple-700 focus-visible:ring-purple-600"
        >
          Review Product Details <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </motion.form>
  );
}

/* -------------------------------------------------------------------------- */
/* 4. DEDICATED WORKFLOW: Photo Based                                         */
/* -------------------------------------------------------------------------- */

interface PhotoWorkflowProps {
  intlLocale: string;
  products: Product[];
  draft: ProductDraft;
  onBack: () => void;
  onClose: () => void;
  onProceed: (updatedDraft: ProductDraft) => void;
}

function PhotoWorkflow({
  intlLocale,
  products,
  draft,
  onBack,
  onClose,
  onProceed,
}: PhotoWorkflowProps) {
  const [imagePreview, setImagePreview] = useState<string | null>(draft.imagePreview ?? null);
  const [isScanning, setIsScanning] = useState(false);
  const [identifiedName, setIdentifiedName] = useState(draft.name);
  const [identifiedCat, setIdentifiedCat] = useState<ProductCategory>(draft.category);
  const [identifiedMfg, setIdentifiedMfg] = useState(draft.mfgDate);
  const [identifiedExp, setIdentifiedExp] = useState(draft.expiryDate);
  const [identifiedCost, setIdentifiedCost] = useState(draft.costPrice || 25);
  const [identifiedMrp, setIdentifiedMrp] = useState(draft.mrp || 30);
  const [identifiedBatch, setIdentifiedBatch] = useState(draft.batchNo);
  const [quantity, setQuantity] = useState(String(draft.quantity || 10));
  const [confidence, setConfidence] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = async (file: File) => {
    setIsScanning(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string;
      setImagePreview(dataUrl);

      try {
        const apiLocale = intlLocale ? intlLocale.slice(0, 2) : 'en';
        const res = await fetch(`/${apiLocale}/api/ai/scan-pack`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: dataUrl,
            mimeType: file.type || 'image/jpeg',
            availableProducts: products.map((p) => ({
              id: p.id,
              name: p.name,
              category: p.category,
              sku: p.sku,
              barcode: p.barcode,
              mrp: p.mrp,
              purchasePrice: p.purchasePrice,
              shelfLifeDays: p.shelfLifeDays,
            })),
          }),
        });

        const json = await res.json();

        if (json.ok && json.data) {
          const d = json.data;
          const matched = products.find((p) => p.id === d.matchedProductId);
          const name = d.productName || matched?.name || file.name.replace(/\.[^/.]+$/, '');
          const cat = (matched?.category || d.category || 'Daily Essentials') as ProductCategory;

          setIdentifiedName(name);
          setIdentifiedCat(cat);
          setIdentifiedMfg(d.mfgDate || new Date().toISOString().slice(0, 10));
          setIdentifiedExp(d.expiryDate || addDaysIso(new Date(), 180));
          setIdentifiedCost(d.costPrice || matched?.purchasePrice || 25);
          setIdentifiedMrp(d.mrp || (d.costPrice ? Math.round(d.costPrice * 1.25) : 30));
          setIdentifiedBatch(d.batchNo || `BN-${Date.now().toString().slice(-6)}`);
          setConfidence(d.confidence || 95);
          setIsScanning(false);
          toast.success('AI identified product details from packaging!');
          return;
        }
      } catch {
        // Fallback
      }

      // Local fallback for quick offline recognition
      const lower = file.name.toLowerCase();
      const matched = products.find((p) =>
        lower.includes(p.name.toLowerCase().split(' ')[0])
      );
      setIdentifiedName(matched?.name || file.name.replace(/\.[^/.]+$/, ''));
      setIdentifiedCat(matched?.category || 'Daily Essentials');
      setIdentifiedMfg(new Date().toISOString().slice(0, 10));
      setIdentifiedExp(addDaysIso(new Date(), 180));
      setIdentifiedCost(matched?.purchasePrice || 25);
      setIdentifiedMrp(matched?.mrp || 30);
      setIdentifiedBatch(`BN-${Date.now().toString().slice(-6)}`);
      setConfidence(88);
      setIsScanning(false);
      toast.success('Packaging loaded! Please verify the details.');
    };
    reader.readAsDataURL(file);
  };

  const handleSelectPreset = (preset: SamplePreset) => {
    setIsScanning(true);
    setImagePreview(preset.imageUrl);

    setTimeout(() => {
      setIdentifiedName(preset.name);
      setIdentifiedCat(preset.category);
      setIdentifiedMfg(preset.mfgDate);
      setIdentifiedExp(preset.expiryDate);
      setIdentifiedCost(preset.costPrice);
      setIdentifiedMrp(preset.mrp);
      setIdentifiedBatch(preset.batchNo);
      setConfidence(98);
      setIsScanning(false);
      toast.success(`Pack preset loaded: ${preset.name}`);
    }, 300);
  };

  const handleProceed = () => {
    if (!imagePreview && !identifiedName.trim()) {
      toast.error('Please capture/upload a product photo first.');
      return;
    }
    const qty = Number(quantity);
    if (!qty || qty <= 0) {
      toast.error('Please enter a valid stock quantity.');
      return;
    }

    const matched = products.find((p) =>
      p.name.toLowerCase().includes(identifiedName.toLowerCase())
    );

    // Ensure the correct image URL is set
    const photoUrl = imagePreview || resolveProductImage(identifiedName, identifiedCat);

    onProceed({
      ...draft,
      sourceMethod: 'photo',
      matchedProductId: matched?.id,
      name: identifiedName.trim() || 'Scanned Product',
      category: identifiedCat,
      quantity: qty,
      costPrice: identifiedCost,
      sellingPrice: identifiedMrp,
      mrp: identifiedMrp,
      mfgDate: identifiedMfg,
      expiryDate: identifiedExp,
      batchNo: identifiedBatch,
      imagePreview: photoUrl,
      imageUrl: photoUrl,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -12 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      {/* Top Bar */}
      <div className="flex items-center justify-between border-b border-gray-100 pb-4 dark:border-neutral-800">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-neutral-700 dark:text-gray-300 dark:hover:bg-neutral-800"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to methods
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight text-gray-950 dark:text-white">
                Add using Photo
              </h2>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300">
                AI Powered
              </span>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-neutral-800"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) processFile(file);
        }}
      />

      {/* Main Upload / Camera View */}
      {!imagePreview ? (
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files?.[0];
            if (file) processFile(file);
          }}
          className="group flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50/70 p-8 text-center transition hover:border-emerald-500 hover:bg-emerald-50/20 dark:border-neutral-700 dark:bg-neutral-900/60 dark:hover:border-emerald-600"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 transition group-hover:scale-105 dark:bg-emerald-950/60 dark:text-emerald-400">
            <Camera className="h-7 w-7" />
          </div>
          <p className="mt-4 text-sm font-bold text-gray-950 dark:text-white">
            Take a product photo or upload packaging image
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Supports camera capture, PNG, JPG, or WEBP. Gemini AI will auto-read MFD, EXP, and price.
          </p>
          <div className="mt-4">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400"
            >
              <Upload className="h-3.5 w-3.5" /> Browse Image or Snap Photo
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-gray-900 shadow-md dark:border-neutral-800">
            <img
              src={imagePreview}
              alt="Scanned Packaging"
              className="max-h-64 w-full object-contain"
            />
            {isScanning && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-950/70 p-4 text-white backdrop-blur-xs">
                <RefreshCw className="h-8 w-8 animate-spin text-emerald-400" />
                <p className="mt-3 text-sm font-semibold">Gemini AI is analyzing packaging...</p>
                <p className="text-xs text-gray-300">Reading product name, MFD, EXP, and MRP</p>
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                setImagePreview(null);
                setConfidence(null);
              }}
              className="absolute right-3 top-3 rounded-lg bg-black/60 p-1.5 text-white backdrop-blur-sm hover:bg-black/80"
              title="Retake photo"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* AI Recognition Summary Box */}
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                <Sparkles className="h-4 w-4 text-emerald-600" />
                AI Recognized Attributes
              </span>
              {confidence && (
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                  {confidence}% confidence
                </span>
              )}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl bg-white p-2.5 dark:bg-neutral-900">
                <span className="text-[10px] text-gray-400">Product</span>
                <p className="truncate text-xs font-bold text-gray-900 dark:text-white">
                  {identifiedName || '—'}
                </p>
              </div>
              <div className="rounded-xl bg-white p-2.5 dark:bg-neutral-900">
                <span className="text-[10px] text-gray-400">MFD</span>
                <p className="text-xs font-bold text-gray-900 dark:text-white">{identifiedMfg || '—'}</p>
              </div>
              <div className="rounded-xl bg-white p-2.5 dark:bg-neutral-900">
                <span className="text-[10px] text-gray-400">EXP Date</span>
                <p className="text-xs font-bold text-red-600 dark:text-red-400">
                  {identifiedExp || '—'}
                </p>
              </div>
              <div className="rounded-xl bg-white p-2.5 dark:bg-neutral-900">
                <span className="text-[10px] text-gray-400">Pack MRP</span>
                <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  ₹{identifiedMrp || '—'}
                </p>
              </div>
            </div>
          </div>

          {/* Quantity Input (Packaging doesn't know carton quantity) */}
          <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-200">
              Quantity Received in this Batch *
            </label>
            <p className="text-[11px] text-gray-500">
              Enter how many units or packets arrived at your store.
            </p>
            <input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="mt-2 h-10 w-full max-w-xs rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm font-bold text-gray-900 outline-none focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
            />
          </div>
        </div>
      )}

      {/* Quick Test Packets with real photography */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">
          Or test with sample packaging presets:
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {SAMPLE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => handleSelectPreset(preset)}
              className="flex items-center gap-2.5 rounded-xl border border-gray-200 bg-white p-2 text-left transition hover:border-emerald-300 hover:bg-emerald-50/40 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-emerald-700"
            >
              <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                <img src={preset.imageUrl} alt={preset.name} className="h-full w-full object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-gray-900 dark:text-white">
                  {preset.name}
                </p>
                <p className="text-[10px] text-gray-400">₹{preset.mrp} MRP</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex items-center justify-between border-t border-gray-100 pt-4 dark:border-neutral-800">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button
          onClick={handleProceed}
          disabled={!imagePreview || isScanning}
          className="gap-2 bg-emerald-600 hover:bg-emerald-700 focus-visible:ring-emerald-600"
        >
          Review Product Details <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </motion.div>
  );
}

/* -------------------------------------------------------------------------- */
/* 5. COMMON PRODUCT REVIEW SCREEN: Verify & Edit Before Saving                */
/* -------------------------------------------------------------------------- */

interface CommonProductReviewProps {
  intlLocale: string;
  draft: ProductDraft;
  suppliers: Array<{ id: string; name: string }>;
  onBack: () => void;
  onClose: () => void;
  onUpdateDraft: (updates: Partial<ProductDraft>) => void;
  onConfirm: () => void;
}

function CommonProductReview({
  intlLocale,
  draft,
  suppliers,
  onBack,
  onClose,
  onUpdateDraft,
  onConfirm,
}: CommonProductReviewProps) {
  const [showPhotoPicker, setShowPhotoPicker] = useState(false);

  const marginPercent = useMemo(() => {
    if (draft.sellingPrice && draft.costPrice) {
      const margin = ((draft.sellingPrice - draft.costPrice) / draft.sellingPrice) * 100;
      return Math.round(margin * 10) / 10;
    }
    return 0;
  }, [draft.sellingPrice, draft.costPrice]);

  const daysRemaining = useMemo(() => {
    if (draft.expiryDate) {
      return daysUntil(draft.expiryDate);
    }
    return 180;
  }, [draft.expiryDate]);

  const resolvedImage = useMemo(() => {
    return draft.imageUrl || draft.imagePreview || resolveProductImage(draft.name, draft.category);
  }, [draft.imageUrl, draft.imagePreview, draft.name, draft.category]);

  const sourceLabels: Record<WorkflowMethod, { label: string; color: string; icon: any }> = {
    voice: {
      label: 'Added using Voice',
      color: 'bg-blue-50 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300 ring-blue-500/20',
      icon: Mic,
    },
    text: {
      label: 'Added using Text',
      color: 'bg-purple-50 text-purple-700 dark:bg-purple-950/80 dark:text-purple-300 ring-purple-500/20',
      icon: Keyboard,
    },
    photo: {
      label: 'Added using Photo',
      color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 ring-emerald-500/20',
      icon: Camera,
    },
  };

  const currentSource = sourceLabels[draft.sourceMethod];
  const SourceIcon = currentSource.icon;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      {/* Top Bar */}
      <div className="flex items-center justify-between border-b border-gray-100 pb-4 dark:border-neutral-800">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-neutral-700 dark:text-gray-300 dark:hover:bg-neutral-800"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to edit
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight text-gray-950 dark:text-white">
                Verify & Review Product
              </h2>
              <span
                className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ring-inset ${currentSource.color}`}
              >
                <SourceIcon className="h-3 w-3" />
                {currentSource.label}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              Verify all extracted fields and product photography before saving to store inventory.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-neutral-800"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Visual Product Photography Card with Interactive Picker */}
      <div className="rounded-2xl border border-gray-200/90 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900 shadow-sm">
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="relative h-24 w-28 shrink-0 overflow-hidden rounded-2xl border border-gray-200 bg-gray-100 shadow-inner dark:border-neutral-700 dark:bg-neutral-800">
            <img
              src={resolvedImage}
              alt={draft.name || 'Product'}
              className="h-full w-full object-cover"
            />
          </div>
          <div className="flex-1 text-center sm:text-left min-w-0">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <span className="text-xs font-bold text-gray-900 dark:text-white">
                Assigned Product Photography
              </span>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 ring-1 ring-emerald-500/20">
                Correct Image Linked
              </span>
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 truncate">
              {draft.name.trim() ? `Accurate image assigned for "${draft.name}"` : 'Accurate image preview'}
            </p>
            <div className="mt-2.5 flex justify-center sm:justify-start">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowPhotoPicker(!showPhotoPicker)}
                className="gap-1.5 text-xs h-7 px-2.5"
              >
                <ImageIcon className="h-3 w-3" />
                {showPhotoPicker ? 'Close Photo Gallery' : 'Change Photo'}
              </Button>
            </div>
          </div>
        </div>

        {/* Expandable Image Gallery to select any product photo */}
        <AnimatePresence>
          {showPhotoPicker && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mt-4 pt-4 border-t border-gray-100 dark:border-neutral-800 overflow-hidden"
            >
              <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2.5">
                Select from catalogue photography:
              </p>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 max-h-48 overflow-y-auto p-1">
                {PRODUCT_IMAGES_CATALOGUE.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onUpdateDraft({ imageUrl: item.url, imagePreview: item.url });
                      setShowPhotoPicker(false);
                      toast.success(`Image updated to ${item.name}`);
                    }}
                    className={`group relative aspect-square overflow-hidden rounded-xl border transition ${
                      resolvedImage === item.url
                        ? 'border-emerald-500 ring-2 ring-emerald-500/20'
                        : 'border-gray-200 hover:border-gray-300 dark:border-neutral-700'
                    }`}
                  >
                    <img src={item.url} alt={item.name} className="h-full w-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-1 text-center">
                      <span className="text-[9px] font-bold text-white leading-tight">
                        {item.name}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Summary Highlight Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-gray-200/80 bg-gray-50/70 p-3.5 dark:border-neutral-800 dark:bg-neutral-900">
          <span className="text-[11px] font-medium text-gray-500">Stock Quantity</span>
          <p className="mt-1 text-lg font-bold text-emerald-600 dark:text-emerald-400">
            +{draft.quantity} <span className="text-xs font-normal text-gray-400">units</span>
          </p>
        </div>
        <div className="rounded-2xl border border-gray-200/80 bg-gray-50/70 p-3.5 dark:border-neutral-800 dark:bg-neutral-900">
          <span className="text-[11px] font-medium text-gray-500">Selling Price</span>
          <p className="mt-1 text-lg font-bold text-gray-950 dark:text-white">
            {formatINR(draft.sellingPrice, intlLocale)}
          </p>
        </div>
        <div className="rounded-2xl border border-gray-200/80 bg-gray-50/70 p-3.5 dark:border-neutral-800 dark:bg-neutral-900">
          <span className="text-[11px] font-medium text-gray-500">Gross Margin</span>
          <p className="mt-1 text-lg font-bold text-blue-600 dark:text-blue-400">
            {marginPercent > 0 ? `+${marginPercent}%` : '0%'}
          </p>
        </div>
        <div className="rounded-2xl border border-gray-200/80 bg-gray-50/70 p-3.5 dark:border-neutral-800 dark:bg-neutral-900">
          <span className="text-[11px] font-medium text-gray-500">Shelf Life</span>
          <p
            className={`mt-1 text-lg font-bold ${
              daysRemaining <= 15 ? 'text-amber-600' : 'text-gray-950 dark:text-white'
            }`}
          >
            {daysRemaining} <span className="text-xs font-normal text-gray-400">days</span>
          </p>
        </div>
      </div>

      {/* Editable Fields Grid */}
      <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <h3 className="text-sm font-bold text-gray-950 dark:text-white">
          Product & Batch Specifications
        </h3>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200">
              Product Item Name
            </label>
            <input
              type="text"
              value={draft.name}
              onChange={(e) => {
                const newName = e.target.value;
                onUpdateDraft({
                  name: newName,
                  imageUrl: resolveProductImage(newName, draft.category),
                });
              }}
              className="mt-1 h-10 w-full rounded-xl border border-gray-200 bg-gray-50/60 px-3 text-sm font-semibold text-gray-900 outline-none focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200">
              Category
            </label>
            <select
              value={draft.category}
              onChange={(e) => {
                const newCat = e.target.value as ProductCategory;
                onUpdateDraft({
                  category: newCat,
                  imageUrl: resolveProductImage(draft.name, newCat),
                });
              }}
              className="mt-1 h-10 w-full rounded-xl border border-gray-200 bg-gray-50/60 px-3 text-sm text-gray-900 outline-none focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
            >
              {PRODUCT_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200">
              Quantity to Receive (Units) *
            </label>
            <input
              type="number"
              min={1}
              value={draft.quantity}
              onChange={(e) => onUpdateDraft({ quantity: Number(e.target.value) || 0 })}
              className="mt-1 h-10 w-full rounded-xl border border-emerald-300 bg-emerald-50/40 px-3 text-sm font-bold text-emerald-950 outline-none focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200">
              Purchase Cost Price (₹)
            </label>
            <input
              type="number"
              step="0.01"
              value={draft.costPrice}
              onChange={(e) => onUpdateDraft({ costPrice: Number(e.target.value) || 0 })}
              className="mt-1 h-10 w-full rounded-xl border border-gray-200 bg-gray-50/60 px-3 text-sm text-gray-900 outline-none focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200">
              Selling Price / MRP (₹)
            </label>
            <input
              type="number"
              step="0.01"
              value={draft.sellingPrice}
              onChange={(e) =>
                onUpdateDraft({
                  sellingPrice: Number(e.target.value) || 0,
                  mrp: Number(e.target.value) || 0,
                })
              }
              className="mt-1 h-10 w-full rounded-xl border border-gray-200 bg-gray-50/60 px-3 text-sm font-bold text-gray-900 outline-none focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200">
              Batch Number
            </label>
            <input
              type="text"
              value={draft.batchNo}
              onChange={(e) => onUpdateDraft({ batchNo: e.target.value })}
              className="mt-1 h-10 w-full rounded-xl border border-gray-200 bg-gray-50/60 px-3 text-sm text-gray-900 outline-none focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200">
              SKU
            </label>
            <input
              type="text"
              value={draft.sku}
              onChange={(e) => onUpdateDraft({ sku: e.target.value })}
              className="mt-1 h-10 w-full rounded-xl border border-gray-200 bg-gray-50/60 px-3 text-sm text-gray-900 outline-none focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200">
              Manufacturing Date (MFD)
            </label>
            <input
              type="date"
              value={draft.mfgDate}
              onChange={(e) => onUpdateDraft({ mfgDate: e.target.value })}
              className="mt-1 h-10 w-full rounded-xl border border-gray-200 bg-gray-50/60 px-3 text-sm text-gray-900 outline-none focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200">
              Expiry Date (EXP)
            </label>
            <input
              type="date"
              value={draft.expiryDate}
              onChange={(e) => onUpdateDraft({ expiryDate: e.target.value })}
              className="mt-1 h-10 w-full rounded-xl border border-gray-200 bg-gray-50/60 px-3 text-sm text-gray-900 outline-none focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
            />
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex items-center justify-between border-t border-gray-100 pt-4 dark:border-neutral-800">
        <Button variant="outline" onClick={onBack}>
          Back to Edit
        </Button>
        <Button
          onClick={onConfirm}
          className="gap-2 bg-emerald-600 px-6 font-bold shadow-lg shadow-emerald-600/15 hover:bg-emerald-700 focus-visible:ring-emerald-600"
        >
          <CheckCircle2 className="h-4 w-4" /> Confirm & Save to Inventory
        </Button>
      </div>
    </motion.div>
  );
}
