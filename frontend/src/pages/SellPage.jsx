import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  ClipboardCheck,
  GitBranch,
  IndianRupee,
  ScanSearch,
  Sparkles,
  UploadCloud,
} from "lucide-react";

import Button from "../components/ui/Button";
import SellFlowRail from "../components/sell/SellFlowRail";
import UploadStep from "../components/sell/UploadStep";
import UnderstandingStep from "../components/sell/UnderstandingStep";
import ConditionStep from "../components/sell/ConditionStep";
import ValuationStep from "../components/sell/ValuationStep";
import ResolutionPathsStep from "../components/sell/ResolutionPathsStep";
import ReadyToResolveStep from "../components/sell/ReadyToResolveStep";

import { deviceCategories } from "../data/sellFlowMockData";
import { fileToDataUrl } from "../utils/fileToImageInput";
import { classifyItemImage, evaluateItem } from "../services/aiDecisionService";
import { createListing } from "../services/listingService";
import { resolveItem } from "../services/agentService";
import { useAuth } from "../contexts/AuthContext";

const FLOW_STEPS = [
  { id: "upload", label: "Upload Device", icon: UploadCloud },
  { id: "understand", label: "Device Understanding", icon: ScanSearch },
  { id: "condition", label: "Condition", icon: ClipboardCheck },
  { id: "valuation", label: "Valuation", icon: IndianRupee },
  { id: "paths", label: "Resolution Paths", icon: GitBranch },
  { id: "resolve", label: "Start Resolution", icon: Sparkles },
];

const SALE_TYPE_BY_ROUTE = {
  auction: "auction",
  parts: "parts",
  scrap: "scrap",
  donate: "donation",
};

function getRouteValue(route, valuation = {}) {
  if (route === "parts") return Number(valuation.partsValue || 0);
  if (route === "auction") {
    return Math.round((Number(valuation.auctionMin || 0) + Number(valuation.auctionMax || 0)) / 2);
  }
  if (route === "scrap") return Number(valuation.scrapValue || 0);
  return Number(valuation.wholeValue || 0);
}

export default function SellPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  const [stepIndex, setStepIndex] = useState(0);
  const [images, setImages] = useState([]);
  const [category, setCategory] = useState("laptop");

  const [understandingStatus, setUnderstandingStatus] = useState("idle"); // idle | processing | done
  const [understandingError, setUnderstandingError] = useState(null);
  const [device, setDevice] = useState({ brand: "", series: "", year: "", categoryLabel: "", confidence: 0 });

  const [condition, setCondition] = useState({});

  // Real /api/ai/evaluate result — replaces the old local mock evaluation.
  const [evaluation, setEvaluation] = useState(null);
  const [evaluationStatus, setEvaluationStatus] = useState("idle"); // idle | loading | done | error
  const [evaluationError, setEvaluationError] = useState(null);

  const [starting, setStarting] = useState(false);
  const [resolutionError, setResolutionError] = useState(null);

  const currentStepId = FLOW_STEPS[stepIndex].id;

  function handleFilesSelected(files) {
    const nextImages = files.map((file) => ({
      id: `${file.name}-${file.lastModified}-${Math.random().toString(16).slice(2)}`,
      name: file.name,
      preview: URL.createObjectURL(file),
      file,
    }));
    setImages((prev) => [...prev, ...nextImages]);
  }

  function handleRemoveImage(imageId) {
    setImages((prev) => {
      const target = prev.find((image) => image.id === imageId);
      if (target) URL.revokeObjectURL(target.preview);
      return prev.filter((image) => image.id !== imageId);
    });
  }

  // Step 2: real MobileNet classification via POST /api/ml/classify
  // (aiDecisionService.classifyItemImage -> apiClient -> backend -> ML
  // service). The backend only returns a material/category + confidence —
  // it does not detect brand/model, so those stay editable inputs for the
  // user rather than being invented here.
  async function handleStartAnalysis() {
    const primaryFile = images[0]?.file;

    if (!primaryFile) {
      setUnderstandingError("Upload a photo before running device understanding.");
      return;
    }

    setUnderstandingStatus("processing");
    setUnderstandingError(null);

    try {
      const result = await classifyItemImage(primaryFile);

      const detectedCategoryId =
        result.category && deviceCategories.some((option) => option.id === result.category)
          ? result.category
          : null;

      if (detectedCategoryId) {
        setCategory(detectedCategoryId);
      }

      const categoryMeta = deviceCategories.find(
        (option) => option.id === (detectedCategoryId || category)
      );

      setDevice((prev) => ({
        ...prev,
        categoryLabel: categoryMeta?.label || result.rawCategory || prev.categoryLabel,
        confidence: result.confidencePercent ?? prev.confidence,
      }));

      setUnderstandingStatus("done");
    } catch (error) {
      setUnderstandingError(error.message || "Could not analyze this image. Try again.");
      setUnderstandingStatus("idle");
    }
  }

  function handleDeviceFieldChange(key, value) {
    setDevice((prev) => ({ ...prev, [key]: value }));
  }

  function handleConditionChange(key, value) {
    setCondition((prev) => ({ ...prev, [key]: value }));
  }

  // Step 4: real valuation via POST /api/ai/evaluate (aiDecisionService ->
  // aiController -> aiDecisionService.evaluate on the backend). Runs once,
  // when the user leaves the Condition step, rather than being recomputed
  // locally on every keystroke like the old mock did.
  async function runEvaluation() {
    setEvaluationStatus("loading");
    setEvaluationError(null);

    try {
      const result = await evaluateItem({
        image: images[0]?.file,
        category,
        brand: device.brand,
        model: device.series,
        location: user?.location || "Delhi",
        condition,
      });

      setEvaluation(result);
      setEvaluationStatus("done");
    } catch (error) {
      setEvaluationError(error.message || "Could not evaluate this device right now.");
      setEvaluationStatus("error");
    }
  }

  function canContinue() {
    if (currentStepId === "upload") return images.length > 0;
    if (currentStepId === "understand") return understandingStatus === "done";
    if (currentStepId === "valuation") return evaluationStatus === "done";
    return true;
  }

  function goNext() {
    if (stepIndex >= FLOW_STEPS.length - 1) return;

    const nextStepId = FLOW_STEPS[stepIndex + 1].id;

    if (nextStepId === "valuation" && evaluationStatus !== "loading") {
      runEvaluation();
    }

    setStepIndex((prev) => prev + 1);
  }

  function goBack() {
    if (stepIndex > 0) setStepIndex((prev) => prev - 1);
  }

  // Step 6: "Start Resolution" — creates the real listing (POST
  // /api/listings), starts the real agent session for it (POST
  // /api/agent/resolve/:itemId), persists the session id using the same
  // localStorage convention AgentResolutionPage reads on load, then hands
  // off to that page, which drives the rest of the resolution (inspect ->
  // evaluate -> decide -> execute -> observe -> replan -> verify ->
  // complete) entirely from real backend state.
  async function handleStartResolution() {
    if (!isAuthenticated) {
      setResolutionError("Please sign in before starting the resolution agent.");
      navigate("/auth");
      return;
    }

    if (!evaluation) return;

    setStarting(true);
    setResolutionError(null);

    const route = evaluation.recommendation?.route || "whole";
    const saleType = SALE_TYPE_BY_ROUTE[route] || "fixed";
    const price = getRouteValue(route, evaluation.valuation);

    try {
      // Persist the ACTUAL uploaded photo bytes (a data: URL), not the
      // `image.preview` blob: URL used for the in-page preview. A blob:
      // URL only lives as long as this tab's document does, so sending
      // it to the backend as "the listing image" is what produces the
      // broken-image icon everywhere downstream (Agent Resolution,
      // marketplace, a page refresh, ...) reads listing.images later —
      // it's a dead reference the moment this page unloads. The data:
      // URL embeds the real image, so it keeps working anywhere the
      // listing record itself is read, including after a refresh and
      // in the agent's own inspection step (see
      // AgentResolutionPage.driveForward / backend agentTools.js
      // resolveInspectionImage, which now replays this same photo into
      // inspect_item automatically).
      const imageDataUrls = images.length
        ? await Promise.all(images.map((image) => fileToDataUrl(image.file)))
        : [];

      const listing = await createListing({
        category,
        subcategory: route === "parts" ? "component" : category,
        brand: evaluation.detectedItem?.brand || device.brand || "Punarchakra",
        model: evaluation.detectedItem?.model || device.series || "Device",
        condition: evaluation.condition?.label || "Good",
        description: evaluation.recommendation?.reason || "Listed from the Punarchakra sell flow.",
        images: imageDataUrls.length
          ? imageDataUrls
          : ["https://via.placeholder.com/400?text=Punarchakra+Listing"],
        price,
        location: evaluation.marketSignals?.location || user?.location || "Delhi",
        sale_type: saleType,
        status: "active",
      });

      const session = await resolveItem(listing.id);

      if (session?.agentSessionId) {
        try {
          window.localStorage.setItem(`revalue_agent_session_${listing.id}`, session.agentSessionId);
        } catch {
          // localStorage may be unavailable (private browsing) — the agent
          // page will still work, it just won't resume across reloads.
        }
      }

      const query = session?.agentSessionId ? `?session=${session.agentSessionId}` : "";
      navigate(`/agent/${listing.id}${query}`);
    } catch (error) {
      setResolutionError(error.message || "Could not start the resolution agent right now.");
    } finally {
      setStarting(false);
    }
  }

  function renderStep() {
    switch (currentStepId) {
      case "upload":
        return (
          <UploadStep
            images={images}
            onFilesSelected={handleFilesSelected}
            onRemoveImage={handleRemoveImage}
            category={category}
            onCategoryChange={setCategory}
          />
        );
      case "understand":
        return (
          <UnderstandingStep
            status={understandingStatus}
            onStartAnalysis={handleStartAnalysis}
            device={device}
            category={category}
            onDeviceFieldChange={handleDeviceFieldChange}
            error={understandingError}
          />
        );
      case "condition":
        return <ConditionStep category={category} condition={condition} onConditionChange={handleConditionChange} />;
      case "valuation":
        return <ValuationStep evaluation={evaluation} status={evaluationStatus} error={evaluationError} onRetry={runEvaluation} />;
      case "paths":
        return evaluation ? <ResolutionPathsStep evaluation={evaluation} /> : null;
      case "resolve":
        return evaluation ? (
          <ReadyToResolveStep
            device={device}
            evaluation={evaluation}
            onStartResolution={handleStartResolution}
            starting={starting}
            error={resolutionError}
          />
        ) : null;
      default:
        return null;
    }
  }

  const isLastStep = stepIndex === FLOW_STEPS.length - 1;

  return (
    <main className="container section sell-v2">
      <div className="page-intro">
        <div className="eyebrow">Sell / Resolve a device</div>
        <h1>Guide your device to its best resolution.</h1>
        <p>
          Upload photos, confirm the device, share its condition, and preview the valuation and recovery paths the
          resolution agent will act on.
        </p>
      </div>

      <SellFlowRail steps={FLOW_STEPS} currentIndex={stepIndex} />

      {renderStep()}

      {!isLastStep && (
        <div className="wizard-actions">
          <Button variant="secondary" onClick={goBack} icon={<ArrowLeft size={16} />} iconPosition="left" disabled={stepIndex === 0}>
            Back
          </Button>
          <Button
            variant="primary"
            onClick={goNext}
            icon={<ArrowRight size={16} />}
            iconPosition="right"
            disabled={!canContinue()}
          >
            {currentStepId === "valuation" && evaluationStatus === "loading" ? "Evaluating…" : "Continue"}
          </Button>
        </div>
      )}

      {isLastStep && (
        <div className="wizard-actions">
          <Button variant="secondary" onClick={goBack} icon={<ArrowLeft size={16} />} iconPosition="left">
            Back
          </Button>
        </div>
      )}
    </main>
  );
}
