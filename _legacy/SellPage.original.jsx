import {
  useEffect,
  useState
} from "react";

import {
  useNavigate
} from "react-router-dom";

import {
  ArrowLeft,
  ArrowRight,
  Camera,
  CheckCircle2,
  CircleDashed,
  Sparkles,
  Trash2,
  UploadCloud
} from "lucide-react";

import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import SectionHeader from "../components/ui/SectionHeader";

import {
  classifyItemImage,
  evaluateItem
} from "../services/aiDecisionService";

import {
  useAuth
} from "../contexts/AuthContext";


const steps = [
  {
    id: 1,
    title: "Upload Photos",
    subtitle:
      "Add images that show the device clearly."
  },

  {
    id: 2,
    title: "Identify Device",
    subtitle:
      "Let AI suggest a likely match and confirm it."
  },

  {
    id: 3,
    title: "Condition Assessment",
    subtitle:
      "Share the state of the device and its parts."
  },

  {
    id: 4,
    title: "AI Analysis",
    subtitle:
      "We prepare a concise summary for the next step."
  },

  {
    id: 5,
    title: "Recommendation",
    subtitle:
      "Review the path we would recommend next."
  },
];


const questionSets = {
  laptop: [
    {
      key: "powersOn",
      label: "Does it power on?",
      type: "select",
      options: [
        "Yes",
        "No",
        "Sometimes"
      ]
    },

    {
      key: "displayCondition",
      label: "Display condition",
      type: "select",
      options: [
        "Excellent",
        "Good",
        "Cracked",
        "Non-functional"
      ]
    },

    {
      key: "batteryCondition",
      label: "Battery condition",
      type: "select",
      options: [
        "Good",
        "Fair",
        "Weak",
        "Needs replacement"
      ]
    },

    {
      key: "ram",
      label: "RAM",
      type: "select",
      options: [
        "4 GB",
        "8 GB",
        "16 GB",
        "32 GB"
      ]
    },

    {
      key: "storage",
      label: "Storage",
      type: "select",
      options: [
        "128 GB",
        "256 GB",
        "512 GB",
        "1 TB"
      ]
    },

    {
      key: "chargerIncluded",
      label: "Charger included?",
      type: "select",
      options: [
        "Yes",
        "No",
        "Partially"
      ]
    },

    {
      key: "physicalDamage",
      label: "Physical damage?",
      type: "select",
      options: [
        "None",
        "Minor",
        "Moderate",
        "Severe"
      ]
    }
  ],

  phone: [
    {
      key: "powersOn",
      label: "Does it power on?",
      type: "select",
      options: [
        "Yes",
        "No",
        "Sometimes"
      ]
    },

    {
      key: "screenCondition",
      label: "Screen condition",
      type: "select",
      options: [
        "Excellent",
        "Good",
        "Cracked",
        "Unresponsive"
      ]
    },

    {
      key: "batteryHealth",
      label: "Battery health",
      type: "select",
      options: [
        "Excellent",
        "Good",
        "Fair",
        "Poor"
      ]
    },

    {
      key: "cameraWorking",
      label: "Camera working?",
      type: "select",
      options: [
        "Yes",
        "No",
        "Partially"
      ]
    },

    {
      key: "storage",
      label: "Storage",
      type: "select",
      options: [
        "64 GB",
        "128 GB",
        "256 GB",
        "512 GB"
      ]
    },

    {
      key: "networkLocked",
      label: "Network locked?",
      type: "select",
      options: [
        "No",
        "Yes",
        "Unknown"
      ]
    },

    {
      key: "physicalDamage",
      label: "Physical damage?",
      type: "select",
      options: [
        "None",
        "Minor",
        "Moderate",
        "Severe"
      ]
    }
  ],

  battery: [
    {
      key: "batteryType",
      label: "Battery type",
      type: "select",
      options: [
        "Li-ion",
        "Li-polymer",
        "Lead-acid",
        "Other"
      ]
    },

    {
      key: "capacity",
      label: "Capacity",
      type: "select",
      options: [
        "High",
        "Medium",
        "Low",
        "Unknown"
      ]
    },

    {
      key: "swollen",
      label: "Shows swelling?",
      type: "select",
      options: [
        "No",
        "Slightly",
        "Yes"
      ]
    },

    {
      key: "chargerIncluded",
      label: "Charger included?",
      type: "select",
      options: [
        "Yes",
        "No",
        "Partially"
      ]
    },

    {
      key: "physicalDamage",
      label: "Physical damage?",
      type: "select",
      options: [
        "None",
        "Minor",
        "Moderate",
        "Severe"
      ]
    }
  ]
};


const genericQuestions = [
  {
    key: "powersOn",
    label: "Does it work / power on?",
    type: "select",
    options: [
      "Yes",
      "No",
      "Sometimes"
    ]
  },

  {
    key: "physicalDamage",
    label: "Physical condition",
    type: "select",
    options: [
      "None",
      "Minor",
      "Moderate",
      "Severe"
    ]
  }
];


export default function SellPage() {
  const navigate = useNavigate();

  const {
    user
  } = useAuth();

  const [
    currentStep,
    setCurrentStep
  ] = useState(1);

  const [
    sellItem,
    setSellItem
  ] = useState({
    images: [],

    category: "laptop",

    device: {
      name: "",
      brand: "",
      series: "",
      year: "",
      confidence: 0,
      category: "Laptop"
    },

    specs: {
      processor: "",
      ram: "",
      storage: ""
    },

    condition: {}
  });

  const [
    categoryTouched,
    setCategoryTouched
  ] = useState(false);

  const [
    aiDetected,
    setAiDetected
  ] = useState(false);

  const [
    mlDetection,
    setMlDetection
  ] = useState(null);

  const [
    detecting,
    setDetecting
  ] = useState(false);

  const [
    manualEdit,
    setManualEdit
  ] = useState(false);

  const [
    analysisState,
    setAnalysisState
  ] = useState({
    index: 0,
    completed: [],
    complete: false
  });

  const [
    analysisProgress,
    setAnalysisProgress
  ] = useState(0);

  const [
    transitioning,
    setTransitioning
  ] = useState(false);

  const [
    error,
    setError
  ] = useState("");


  const milestoneSteps = [
    "Identifying device",
    "Checking condition",
    "Estimating resale demand",
    "Evaluating component demand",
    "Comparing repair economics",
    "Checking auction demand",
    "Calculating scrap value"
  ];


  const metrics = [
    {
      label: "Market Demand",
      value: "HIGH",
      strength: 92
    },

    {
      label: "Repairability",
      value: "MEDIUM",
      strength: 64
    },

    {
      label: "Parts Value",
      value: "HIGH",
      strength: 88
    },

    {
      label: "Scrap Value",
      value: "LOW",
      strength: 32
    }
  ];


  const currentQuestions =
    questionSets[
      sellItem.category
    ] ||
    genericQuestions;


  function handleImageUpload(event) {
    const files =
      Array.from(
        event.target.files || []
      );

    if (!files.length) {
      return;
    }

    const nextImages =
      files.map((file) => ({
        id:
          `${file.name}-${file.lastModified}`,

        name:
          file.name,

        preview:
          URL.createObjectURL(file),

        file
      }));

    setSellItem(
      (prev) => ({
        ...prev,

        images: [
          ...prev.images,
          ...nextImages
        ]
      })
    );

    event.target.value = "";
  }


  function removeImage(imageId) {
    setSellItem(
      (prev) => {
        const target =
          prev.images.find(
            (image) =>
              image.id === imageId
          );

        if (target) {
          URL.revokeObjectURL(
            target.preview
          );
        }

        return {
          ...prev,

          images:
            prev.images.filter(
              (image) =>
                image.id !== imageId
            )
        };
      }
    );
  }


  async function handleDetection() {
    setError("");

    const firstImage =
      sellItem.images[0]?.file;

    if (!firstImage) {
      setError(
        "Upload at least one image before running AI detection."
      );

      return;
    }

    setDetecting(true);

    try {
      const result =
        await classifyItemImage(
          firstImage
        );

      setMlDetection(result);

      /*
       * If the user never manually changed
       * the category selector, we allow ML
       * to fill it automatically.
       *
       * If user DID select a category,
       * their choice remains authoritative.
       */
      setSellItem(
        (prev) => {
          const detectedCategory =
            result.category;

          const finalCategory =
            !categoryTouched &&
            detectedCategory
              ? detectedCategory
              : prev.category;

          return {
            ...prev,

            category:
              finalCategory,

            device: {
              ...prev.device,

              name:
                result.rawCategory ||
                prev.device.name,

              confidence:
                result.confidencePercent ||
                0,

              category:
                result.rawCategory ||
                prev.device.category
            }
          };
        }
      );

      setAiDetected(true);

      setManualEdit(false);
    } catch (err) {
      setError(
        err.message ||
        "AI detection failed."
      );
    } finally {
      setDetecting(false);
    }
  }


  function updateField(
    group,
    key,
    value
  ) {
    setSellItem(
      (prev) => ({
        ...prev,

        [group]: {
          ...prev[group],
          [key]: value
        }
      })
    );
  }


  function updateCondition(
    key,
    value
  ) {
    setSellItem(
      (prev) => ({
        ...prev,

        condition: {
          ...prev.condition,
          [key]: value
        }
      })
    );
  }


  function nextStep() {
    if (
      currentStep <
      steps.length
    ) {
      setCurrentStep(
        (prev) =>
          prev + 1
      );
    }
  }


  function prevStep() {
    if (currentStep > 1) {
      setCurrentStep(
        (prev) =>
          prev - 1
      );
    }
  }


  useEffect(() => {
    if (currentStep !== 4) {
      return undefined;
    }

    let isMounted = true;

    const timers = [];

    setAnalysisState({
      index: 0,
      completed: [],
      complete: false
    });

    setAnalysisProgress(0);

    setTransitioning(false);

    setError("");


    milestoneSteps.forEach(
      (step, index) => {
        const timer =
          window.setTimeout(
            () => {
              if (!isMounted) {
                return;
              }

              setAnalysisState(
                (prev) => ({
                  index:
                    index + 1,

                  completed:
                    [
                      ...prev.completed,
                      step
                    ],

                  complete:
                    false
                })
              );

              setAnalysisProgress(
                Math.min(
                  92,
                  Math.round(
                    (
                      (index + 1) /
                      milestoneSteps.length
                    ) *
                      92
                  )
                )
              );
            },
            index * 450
          );

        timers.push(timer);
      }
    );


    async function runEvaluation() {
      try {
        const payload = {
          image:
            sellItem.images[0]
              ?.file,

          category:
            sellItem.category,

          brand:
            sellItem.device
              .brand,

          model:
            sellItem.device
              .name,

          condition:
            sellItem.condition,

          location:
            user?.location ||
            "Delhi",

          userPreference:
            "balanced"
        };


        const response =
          await evaluateItem(
            payload
          );


        if (!isMounted) {
          return;
        }


        sessionStorage.setItem(
          "revalue_ai_eval",
          JSON.stringify(
            response
          )
        );


        /*
         * We keep only lightweight
         * context needed by results page.
         *
         * The blob preview continues to
         * work within the same browser
         * session.
         */
        sessionStorage.setItem(
          "revalue_sell_context",
          JSON.stringify({
            images:
              sellItem.images.map(
                (image) =>
                  image.preview
              ),

            category:
              sellItem.category,

            location:
              user?.location ||
              "Delhi"
          })
        );


        /*
         * Let the existing animation
         * remain visible for a minimum
         * duration so the UI does not
         * suddenly jump.
         */
        await new Promise(
          (resolve) =>
            window.setTimeout(
              resolve,
              3200
            )
        );


        if (!isMounted) {
          return;
        }


        setAnalysisState(
          (prev) => ({
            ...prev,
            complete: true
          })
        );

        setAnalysisProgress(100);

        setTransitioning(true);


        const navigateTimer =
          window.setTimeout(
            () => {
              if (isMounted) {
                navigate(
                  "/sell/results"
                );
              }
            },
            650
          );

        timers.push(
          navigateTimer
        );
      } catch (err) {
        if (!isMounted) {
          return;
        }

        setError(
          err.message ||
          "Unable to reach the AI evaluation service."
        );

        setAnalysisState(
          (prev) => ({
            ...prev,
            complete: false
          })
        );
      }
    }


    runEvaluation();


    return () => {
      isMounted = false;

      timers.forEach(
        (timer) =>
          window.clearTimeout(
            timer
          )
      );
    };
  }, [currentStep]);


  function renderStepContent() {
    switch (currentStep) {
      case 1:
        return (
          <Card className="wizard-panel">
            <SectionHeader
              eyebrow="Step 1"
              title="Upload photos"
              description="Add a few clear images so Punarchakra can guide you accurately."
            />

            <label className="upload-box upload-box--large">
              <input
                type="file"
                accept="image/*"
                hidden
                multiple
                onChange={
                  handleImageUpload
                }
              />

              <UploadCloud
                size={28}
              />

              <strong>
                Drop photos here or
                tap to upload
              </strong>

              <p>
                Suggested: front,
                back, damaged area,
                and model or serial
                sticker.
              </p>
            </label>


            <div className="image-preview-grid">
              {sellItem.images.map(
                (image) => (
                  <div
                    className="image-preview"
                    key={image.id}
                  >
                    <img
                      src={
                        image.preview
                      }
                      alt={
                        image.name
                      }
                    />

                    <button
                      type="button"
                      className="image-remove"
                      onClick={() =>
                        removeImage(
                          image.id
                        )
                      }
                    >
                      <Trash2
                        size={14}
                      />
                    </button>

                    <div className="image-caption">
                      {image.name}
                    </div>
                  </div>
                )
              )}
            </div>


            <div
              className="form-grid"
              style={{
                marginTop: 20
              }}
            >
              <div className="form-field">
                <label>
                  Device category
                </label>

                <select
                  value={
                    sellItem.category
                  }
                  onChange={
                    (event) => {
                      setCategoryTouched(
                        true
                      );

                      setSellItem(
                        (prev) => ({
                          ...prev,

                          category:
                            event
                              .target
                              .value
                        })
                      );
                    }
                  }
                >
                  <option value="laptop">
                    Laptop
                  </option>

                  <option value="phone">
                    Phone
                  </option>

                  <option value="battery">
                    Battery
                  </option>

                  <option value="television">
                    Television
                  </option>

                  <option value="washing_machine">
                    Washing Machine
                  </option>

                  <option value="microwave">
                    Microwave
                  </option>

                  <option value="pcb">
                    PCB
                  </option>

                  <option value="keyboard">
                    Keyboard
                  </option>

                  <option value="mouse">
                    Mouse
                  </option>

                  <option value="printer">
                    Printer
                  </option>

                  <option value="player">
                    Media Player
                  </option>

                  <option value="ssd">
                    SSD
                  </option>

                  <option value="ram">
                    RAM
                  </option>

                  <option value="gpu">
                    GPU
                  </option>
                </select>
              </div>


              <div className="form-field">
                <label>
                  What would you like
                  to do?
                </label>

                <select>
                  <option>
                    Sell it
                  </option>

                  <option>
                    Compare routes
                  </option>

                  <option>
                    Schedule scrap
                  </option>
                </select>
              </div>
            </div>
          </Card>
        );


      case 2:
        return (
          <Card className="wizard-panel">
            <SectionHeader
              eyebrow="Step 2"
              title="Identify your device"
              description="We’ll suggest a likely device from your photos, but you can confirm or update it."
            />


            {!aiDetected ? (
              <div className="empty-state">
                <CircleDashed
                  size={26}
                />

                <p>
                  No detection run
                  yet. Use the button
                  below to run AI
                  recognition from the
                  uploaded image.
                </p>
              </div>
            ) : (
              <div className="detection-card">
                <div className="detection-card__header">
                  <div>
                    <div className="eyebrow">
                      Detected
                    </div>

                    <h3>
                      {mlDetection
                        ?.rawCategory ||
                        sellItem.device
                          .name ||
                        "Device suggestion"}
                    </h3>
                  </div>

                  <div className="confidence-pill">
                    {
                      sellItem
                        .device
                        .confidence
                    }
                    % confidence
                  </div>
                </div>


                <div className="detection-card__meta">
                  <span>
                    AI category:{" "}
                    {mlDetection
                      ?.rawCategory ||
                      "Unknown"}
                  </span>

                  <span>
                    Selected category:{" "}
                    {
                      sellItem.category
                    }
                  </span>

                  <span>
                    Model: MobileNetV3
                  </span>
                </div>
              </div>
            )}


            <div
              className="form-grid"
              style={{
                marginTop: 18
              }}
            >
              <div className="form-field">
                <label>
                  Device name
                </label>

                <input
                  value={
                    sellItem.device
                      .name
                  }
                  onChange={
                    (event) =>
                      updateField(
                        "device",
                        "name",
                        event.target
                          .value
                      )
                  }
                />
              </div>


              <div className="form-field">
                <label>
                  Brand
                </label>

                <input
                  value={
                    sellItem.device
                      .brand
                  }
                  onChange={
                    (event) =>
                      updateField(
                        "device",
                        "brand",
                        event.target
                          .value
                      )
                  }
                />
              </div>


              <div className="form-field">
                <label>
                  Series
                </label>

                <input
                  value={
                    sellItem.device
                      .series
                  }
                  onChange={
                    (event) =>
                      updateField(
                        "device",
                        "series",
                        event.target
                          .value
                      )
                  }
                />
              </div>


              <div className="form-field">
                <label>
                  Likely year
                </label>

                <input
                  value={
                    sellItem.device
                      .year
                  }
                  onChange={
                    (event) =>
                      updateField(
                        "device",
                        "year",
                        event.target
                          .value
                      )
                  }
                />
              </div>


              <div className="form-field">
                <label>
                  Processor
                </label>

                <input
                  value={
                    sellItem.specs
                      .processor
                  }
                  onChange={
                    (event) =>
                      updateField(
                        "specs",
                        "processor",
                        event.target
                          .value
                      )
                  }
                />
              </div>


              <div className="form-field">
                <label>
                  RAM
                </label>

                <input
                  value={
                    sellItem.specs.ram
                  }
                  onChange={
                    (event) =>
                      updateField(
                        "specs",
                        "ram",
                        event.target
                          .value
                      )
                  }
                />
              </div>


              <div className="form-field">
                <label>
                  Storage
                </label>

                <input
                  value={
                    sellItem.specs
                      .storage
                  }
                  onChange={
                    (event) =>
                      updateField(
                        "specs",
                        "storage",
                        event.target
                          .value
                      )
                  }
                />
              </div>


              <div className="form-field">
                <label>
                  Confidence
                </label>

                <input
                  type="number"
                  value={
                    sellItem.device
                      .confidence
                  }
                  readOnly
                />
              </div>
            </div>


            <div className="wizard-actions">
              <Button
                variant="secondary"
                onClick={() =>
                  setManualEdit(
                    (prev) =>
                      !prev
                  )
                }
              >
                {manualEdit
                  ? "Use detected values"
                  : "Change device manually"}
              </Button>


              <Button
                variant="primary"
                onClick={
                  handleDetection
                }
                disabled={
                  detecting
                }
                icon={
                  <Sparkles
                    size={16}
                  />
                }
                iconPosition="left"
              >
                {detecting
                  ? "Detecting..."
                  : "Run AI detection"}
              </Button>
            </div>


            {error ? (
              <p className="page-intro__description">
                {error}
              </p>
            ) : null}
          </Card>
        );


      case 3:
        return (
          <Card className="wizard-panel">
            <SectionHeader
              eyebrow="Step 3"
              title="Condition assessment"
              description={`We’ll tailor the questions to ${sellItem.category || "your device"}.`}
            />


            <div className="question-stack">
              {currentQuestions.map(
                (question) => (
                  <div
                    className="form-field"
                    key={
                      question.key
                    }
                  >
                    <label>
                      {
                        question.label
                      }
                    </label>


                    {question.type ===
                    "select" ? (
                      <select
                        value={
                          sellItem
                            .condition[
                            question
                              .key
                          ] || ""
                        }
                        onChange={
                          (event) =>
                            updateCondition(
                              question.key,
                              event.target
                                .value
                            )
                        }
                      >
                        <option value="">
                          Select one
                        </option>

                        {question.options.map(
                          (
                            option
                          ) => (
                            <option
                              key={
                                option
                              }
                              value={
                                option
                              }
                            >
                              {
                                option
                              }
                            </option>
                          )
                        )}
                      </select>
                    ) : (
                      <input
                        value={
                          sellItem
                            .condition[
                            question
                              .key
                          ] || ""
                        }
                        onChange={
                          (event) =>
                            updateCondition(
                              question.key,
                              event.target
                                .value
                            )
                        }
                      />
                    )}
                  </div>
                )
              )}
            </div>
          </Card>
        );


      case 4:
        return (
          <Card className="wizard-panel">
            <SectionHeader
              eyebrow="Step 4"
              title="AI analysis"
              description="Running the evaluation and comparing the available selling routes."
            />


            <div className="analysis-card">
              <div className="analysis-card__header">
                <div className="analysis-icon">
                  <Sparkles
                    size={22}
                  />
                </div>

                <div>
                  <h3>
                    Reviewing your
                    listing
                  </h3>

                  <p>
                    We’re comparing
                    route fit, parts
                    value, and likely
                    demand through the
                    connected AI
                    backend.
                  </p>
                </div>
              </div>


              {error ? (
                <p className="page-intro__description">
                  {error}
                </p>
              ) : null}


              <div className="analysis-visual">
                <div
                  className="analysis-rail"
                  aria-hidden="true"
                >
                  {milestoneSteps.map(
                    (
                      step,
                      index
                    ) => {
                      const completed =
                        index <
                        analysisState
                          .completed
                          .length;

                      const active =
                        index ===
                          analysisState
                            .index -
                            1 &&
                        !analysisState
                          .complete;

                      return (
                        <div
                          key={
                            step
                          }
                          className={`analysis-node ${
                            completed
                              ? "complete"
                              : ""
                          } ${
                            active
                              ? "active"
                              : ""
                          }`}
                        >
                          <div className="analysis-node__dot" />

                          <div className="analysis-node__label">
                            {
                              step
                            }
                          </div>
                        </div>
                      );
                    }
                  )}
                </div>


                <div className="analysis-progress-shell">
                  <div className="analysis-progress-label">
                    Analysis progress
                  </div>

                  <div className="analysis-progress-track">
                    <div
                      className="analysis-progress-fill"
                      style={{
                        width:
                          `${analysisProgress}%`
                      }}
                    />
                  </div>
                </div>
              </div>


              <div className="analysis-metrics">
                {metrics.map(
                  (metric) => (
                    <div
                      key={
                        metric.label
                      }
                      className="analysis-metric"
                    >
                      <div className="analysis-metric__header">
                        <span>
                          {
                            metric.label
                          }
                        </span>

                        <strong>
                          {
                            metric.value
                          }
                        </strong>
                      </div>

                      <div className="analysis-metric__bar">
                        <span
                          style={{
                            width:
                              `${
                                analysisState
                                  .complete
                                  ? metric.strength
                                  : Math.max(
                                      10,
                                      Math.round(
                                        metric.strength *
                                          0.55
                                      )
                                    )
                              }%`
                          }}
                        />
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>


            {transitioning ? (
              <div className="analysis-transition">
                <CheckCircle2
                  size={28}
                />

                <h3>
                  Recommendation
                  ready
                </h3>

                <p>
                  Preparing your route
                  results with a
                  polished handoff.
                </p>
              </div>
            ) : null}
          </Card>
        );


      case 5:
        return (
          <Card className="wizard-panel">
            <SectionHeader
              eyebrow="Step 5"
              title="Recommendation preview"
              description="Your route recommendation is ready for review."
            />

            <div className="recommendation-preview">
              <div className="recommendation-preview__hero">
                <div>
                  <div className="eyebrow">
                    Suggested next
                    step
                  </div>

                  <h3>
                    {sellItem.device
                      .name ||
                      "Your device"}
                  </h3>

                  <p>
                    Compare resale,
                    component
                    recovery, repair
                    and scrap routes.
                  </p>
                </div>

                <div className="confidence-pill">
                  Ready for review
                </div>
              </div>


              <div className="analysis-summary">
                <div>
                  <span>
                    Category
                  </span>

                  <strong>
                    {sellItem.device
                      .category ||
                      sellItem.category}
                  </strong>
                </div>

                <div>
                  <span>
                    Processor
                  </span>

                  <strong>
                    {sellItem.specs
                      .processor ||
                      "Pending"}
                  </strong>
                </div>

                <div>
                  <span>
                    Condition notes
                  </span>

                  <strong>
                    {
                      Object.keys(
                        sellItem
                          .condition
                      ).length
                    }{" "}
                    captured
                  </strong>
                </div>
              </div>
            </div>
          </Card>
        );


      default:
        return null;
    }
  }


  return (
    <main
      className="container section"
      style={{
        maxWidth: 960
      }}
    >
      <div className="page-intro">
        <div className="eyebrow">
          Sell item
        </div>

        <h1>
          Guide your item to the
          best route.
        </h1>

        <p>
          Upload photos, confirm the
          device, answer a few
          condition questions, and
          get a polished
          recommendation
          experience.
        </p>
      </div>


      <div
        className="wizard-steps"
        aria-label="Sell item progress"
      >
        {steps.map(
          (step) => {
            const isActive =
              step.id ===
              currentStep;

            const isComplete =
              step.id <
              currentStep;

            return (
              <div
                key={step.id}
                className={`wizard-step ${
                  isActive
                    ? "active"
                    : ""
                } ${
                  isComplete
                    ? "complete"
                    : ""
                }`}
              >
                <div className="wizard-step__icon">
                  {isComplete ? (
                    <CheckCircle2
                      size={16}
                    />
                  ) : (
                    <Camera
                      size={16}
                    />
                  )}
                </div>

                <div>
                  <strong>
                    {
                      step.title
                    }
                  </strong>

                  <div>
                    {
                      step.subtitle
                    }
                  </div>
                </div>
              </div>
            );
          }
        )}
      </div>


      {renderStepContent()}


      <div className="wizard-actions">
        <Button
          variant="secondary"
          onClick={
            prevStep
          }
          icon={
            <ArrowLeft
              size={16}
            />
          }
          iconPosition="left"
          disabled={
            currentStep === 1
          }
        >
          Back
        </Button>


        {currentStep <
        steps.length ? (
          <Button
            variant="primary"
            onClick={
              nextStep
            }
            icon={
              <ArrowRight
                size={16}
              />
            }
            iconPosition="right"
          >
            Continue
          </Button>
        ) : (
          <Button
            variant="primary"
            onClick={() =>
              navigate(
                "/sell/results"
              )
            }
            icon={
              <Sparkles
                size={16}
              />
            }
            iconPosition="left"
          >
            View results
          </Button>
        )}
      </div>
    </main>
  );
}