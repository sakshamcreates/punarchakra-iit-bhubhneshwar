const aiDecisionService = require("../services/aiDecisionService");
const mlService = require("../services/mlService");

// --------------------------------------------------
// MobileNet label -> Task C canonical category
// --------------------------------------------------
const ML_CATEGORY_MAP = {
  Mobile: "phone",
  Television: "television",
  "Washing Machine": "washing_machine",
  Microwave: "microwave",
  Battery: "battery",
  PCB: "pcb",
  Keyboard: "keyboard",
  Mouse: "mouse",
  Printer: "printer",
  Player: "player",
};

// --------------------------------------------------
// Normalize a manually selected frontend category
// --------------------------------------------------
const USER_CATEGORY_MAP = {
  mobile: "phone",
  phone: "phone",
  smartphone: "phone",

  television: "television",
  tv: "television",

  washing_machine: "washing_machine",
  "washing machine": "washing_machine",
  washingmachine: "washing_machine",

  microwave: "microwave",

  battery: "battery",
  batteries: "battery",

  pcb: "pcb",
  motherboard: "pcb",
  circuit_board: "pcb",
  "circuit board": "pcb",

  keyboard: "keyboard",

  mouse: "mouse",

  printer: "printer",

  player: "player",
  media_player: "player",
  "media player": "player",
};

const normalizeCategory = (value) => {
  if (!value || typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();

  return USER_CATEGORY_MAP[normalized] || normalized;
};

// --------------------------------------------------
// Parse number helper
// --------------------------------------------------
const parseOptionalNumber = (value) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : undefined;
};

// --------------------------------------------------
// Demand score
//
// 0-100 indication of demand pressure.
//
// Higher demand + lower supply => higher score.
// --------------------------------------------------
const calculateDemandScore = (demand, supply) => {
  if (
    typeof demand !== "number" ||
    typeof supply !== "number" ||
    !Number.isFinite(demand) ||
    !Number.isFinite(supply)
  ) {
    return null;
  }

  if (demand < 0 || supply < 0) {
    return null;
  }

  if (demand === 0 && supply === 0) {
    return 50;
  }

  const total = demand + supply;

  if (total === 0) {
    return 50;
  }

  const ratio = demand / total;

  return Math.max(
    0,
    Math.min(100, Math.round(ratio * 100))
  );
};

exports.evaluate = async (req, res, next) => {
  try {
    console.log("====================================");
    console.log("AI EVALUATION REQUEST");
    console.log("FILE:", req.file?.originalname);
    console.log("BODY:", req.body);
    console.log("====================================");

    // --------------------------------------------------
    // 1. USER CATEGORY
    //
    // User choice ALWAYS has priority.
    // --------------------------------------------------

    const userCategory = normalizeCategory(req.body.category);

    let detectedCategory = userCategory;
    let categorySource = userCategory ? "user" : null;

    let classification = null;
    let mlDetectedCategory = null;
    let marketPrediction = null;

    // --------------------------------------------------
    // 2. RUN MOBILENET
    //
    // Run even if user selected category because the
    // classification is still useful metadata.
    //
    // But DO NOT override user category.
    // --------------------------------------------------

    if (req.file) {
      try {
        classification = await mlService.classifyEWaste(req.file);

        console.log(
          "MOBILENET CLASSIFICATION:",
          classification
        );

        const rawCategory =
          classification?.data?.material ||
          classification?.material ||
          classification?.data?.category ||
          classification?.category ||
          null;

        if (rawCategory) {
          mlDetectedCategory =
            ML_CATEGORY_MAP[rawCategory] ||
            normalizeCategory(rawCategory);
        }

        // ML is fallback only
        if (!detectedCategory && mlDetectedCategory) {
          detectedCategory = mlDetectedCategory;
          categorySource = "ml";
        }

        console.log("RAW ML CATEGORY:", rawCategory);
        console.log(
          "NORMALIZED ML CATEGORY:",
          mlDetectedCategory
        );
      } catch (error) {
        console.error(
          "MOBILENET ERROR:",
          error.message
        );

        classification = {
          status: "unavailable",
          error: error.message,
        };
      }
    }

    // --------------------------------------------------
    // 3. CATEGORY VALIDATION
    // --------------------------------------------------

    if (
      !detectedCategory ||
      typeof detectedCategory !== "string"
    ) {
      return res.status(400).json({
        success: false,

        message:
          "Could not determine product category. Select a category or upload a recognizable image.",

        ml: {
          classification,
          detectedCategory: mlDetectedCategory,
        },
      });
    }

    console.log(
      "FINAL CATEGORY:",
      detectedCategory,
      "SOURCE:",
      categorySource
    );

    // --------------------------------------------------
    // 4. PARSE CONDITION
    // --------------------------------------------------

    let condition = req.body.condition || {};

    if (typeof condition === "string") {
      try {
        condition = JSON.parse(condition);
      } catch (error) {
        console.warn(
          "Invalid condition JSON:",
          condition
        );

        condition = {};
      }
    }

    if (
      !condition ||
      typeof condition !== "object" ||
      Array.isArray(condition)
    ) {
      condition = {};
    }

    // --------------------------------------------------
    // 5. PARSE MARKET NUMBERS
    // --------------------------------------------------

    const historicalPrice =
      parseOptionalNumber(
        req.body.historical_price
      );

    const month =
      parseOptionalNumber(req.body.month);

    const demand =
      parseOptionalNumber(req.body.demand);

    const supply =
      parseOptionalNumber(req.body.supply);

    // --------------------------------------------------
    // 6. DEMAND SCORE
    // --------------------------------------------------

    const demandScore =
      calculateDemandScore(demand, supply);

    // --------------------------------------------------
    // 7. RANDOM FOREST PRICE PREDICTION
    // --------------------------------------------------

    const hasMarketData =
      historicalPrice !== undefined &&
      Boolean(req.body.location) &&
      month !== undefined &&
      demand !== undefined &&
      supply !== undefined;

    if (hasMarketData) {
      // RF predicts MATERIAL price.
      //
      // Prefer explicit material.
      // For material categories such as battery / pcb,
      // category can act as fallback.
      const materialForPriceModel =
        req.body.material ||
        (["battery", "pcb"].includes(
          detectedCategory
        )
          ? detectedCategory
          : null);

      if (materialForPriceModel) {
        try {
          marketPrediction =
            await mlService.predictPrice({
              material: materialForPriceModel,

              historical_price:
                historicalPrice,

              location: req.body.location,

              month,

              demand,

              supply,
            });

          console.log(
            "RANDOM FOREST PREDICTION:",
            marketPrediction
          );
        } catch (error) {
          console.error(
            "PRICE MODEL ERROR:",
            error.message
          );

          marketPrediction = {
            status: "unavailable",
            error: error.message,
          };
        }
      } else {
        marketPrediction = {
          status: "skipped",

          reason:
            "Material was not supplied. Device category and material category are intentionally kept separate.",
        };
      }
    } else {
      marketPrediction = {
        status: "skipped",

        reason:
          "historical_price, location, month, demand and supply are required for market price prediction.",
      };
    }

    // --------------------------------------------------
    // 8. CREATE CLEAN TASK C INPUT
    // --------------------------------------------------

    const evaluationInput = {
      ...req.body,

      category: detectedCategory,

      condition,

      historical_price: historicalPrice,

      month,

      demand,

      supply,

      demand_score: demandScore,

      marketPrediction,
    };

    console.log(
      "TASK C INPUT:",
      evaluationInput
    );

    // --------------------------------------------------
    // 9. RUN TASK C
    // --------------------------------------------------

    const decision =
      aiDecisionService.evaluate(
        evaluationInput
      );

    // --------------------------------------------------
    // 10. FINAL RESPONSE
    // --------------------------------------------------

    return res.status(200).json({
      success: true,

      data: {
        ...decision,

        demand_score: demandScore,

        categoryDecision: {
          finalCategory: detectedCategory,

          source: categorySource,

          userCategory:
            userCategory || null,

          mlCategory:
            mlDetectedCategory || null,

          overridden:
            Boolean(
              userCategory &&
                mlDetectedCategory &&
                userCategory !==
                  mlDetectedCategory
            ),
        },

        ml: {
          classification,

          marketPrediction,
        },
      },
    });
  } catch (error) {
    console.error(
      "AI EVALUATION FAILED:",
      error
    );

    next(error);
  }
};