const matchingRepository =
  require("../data/matchingRepository");


const WEIGHTS = {
  priceFit: 0.30,
  demand: 0.25,
  rating: 0.20,
  quantity: 0.15,
  distance: 0.10
};


const CITY_DISTANCE_KM = {
  delhi: {
    delhi: 0,
    gurgaon: 30,
    noida: 25,
    ghaziabad: 28,
    faridabad: 32
  },

  gurgaon: {
    delhi: 30,
    gurgaon: 0,
    noida: 45,
    ghaziabad: 50,
    faridabad: 35
  },

  noida: {
    delhi: 25,
    gurgaon: 45,
    noida: 0,
    ghaziabad: 18,
    faridabad: 30
  },

  ghaziabad: {
    delhi: 28,
    gurgaon: 50,
    noida: 18,
    ghaziabad: 0,
    faridabad: 45
  },

  faridabad: {
    delhi: 32,
    gurgaon: 35,
    noida: 30,
    ghaziabad: 45,
    faridabad: 0
  }
};


function clamp(value, min = 0, max = 100) {
  return Math.min(
    Math.max(value, min),
    max
  );
}


function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}


function normalizeCondition(value) {
  const condition =
    normalizeText(value);

  const conditionMap = {
    excellent: "excellent",
    "very good": "excellent",

    good: "good",

    fair: "fair",
    average: "fair",

    poor: "poor",
    damaged: "poor",
    broken: "poor",

    scrap: "scrap",
    dead: "scrap",
    "non-functional": "scrap"
  };

  return (
    conditionMap[condition] ||
    condition ||
    "fair"
  );
}


function getDistanceKm(
  sellerLocation,
  buyerLocation
) {
  const seller =
    normalizeText(sellerLocation);

  const buyer =
    normalizeText(buyerLocation);

  if (!seller || !buyer) {
    return 50;
  }

  if (seller === buyer) {
    return 0;
  }

  const knownDistance =
    CITY_DISTANCE_KM[seller]?.[buyer];

  if (
    knownDistance !== undefined
  ) {
    return knownDistance;
  }

  /*
   * Unknown city pair.
   *
   * We do not pretend we know the exact
   * distance, so use a neutral fallback.
   *
   * Later replace this with Google Maps,
   * Mapbox, PostGIS, etc.
   */
  return 50;
}


function calculateDistanceFit(
  sellerLocation,
  buyerLocation
) {
  const distanceKm =
    getDistanceKm(
      sellerLocation,
      buyerLocation
    );

  /*
   * 0 km     -> 100
   * 25 km    -> 75
   * 50 km    -> 50
   * 100+ km  -> 0
   */

  const score =
    clamp(
      100 - distanceKm
    );

  return {
    score,
    distanceKm
  };
}


function calculatePriceFit(
  listingPrice,
  buyer
) {
  const price =
    Number(listingPrice);

  /*
   * No price supplied.
   * Give neutral score rather than
   * destroying otherwise valid matches.
   */
  if (
    !Number.isFinite(price) ||
    price <= 0
  ) {
    return 60;
  }

  const min =
    Number(buyer.minPrice || 0);

  const max =
    Number(
      buyer.maxPrice ||
      Number.MAX_SAFE_INTEGER
    );

  if (
    price >= min &&
    price <= max
  ) {
    return 100;
  }


  if (price < min) {
    const difference =
      min - price;

    const percentage =
      difference /
      Math.max(min, 1);

    return clamp(
      100 -
        percentage * 60
    );
  }


  const difference =
    price - max;

  const percentage =
    difference /
    Math.max(max, 1);

  return clamp(
    100 -
      percentage * 100
  );
}


function calculateDemandScore(
  buyer,
  category
) {
  const normalizedCategory =
    normalizeText(category);

  const value =
    Number(
      buyer.demand?.[
        normalizedCategory
      ]
    );

  if (
    Number.isFinite(value)
  ) {
    return clamp(value);
  }

  return 50;
}


function calculateRatingScore(
  rating
) {
  const value =
    Number(rating);

  if (
    !Number.isFinite(value)
  ) {
    return 50;
  }

  /*
   * Rating 5/5 -> 100
   */

  return clamp(
    (value / 5) * 100
  );
}


function calculateQuantityScore(
  quantity,
  buyer
) {
  const requestedQuantity =
    Number(quantity || 1);

  const min =
    Number(
      buyer.minQuantity || 1
    );

  const max =
    Number(
      buyer.maxQuantity ||
      Number.MAX_SAFE_INTEGER
    );


  if (
    requestedQuantity >= min &&
    requestedQuantity <= max
  ) {
    return 100;
  }


  if (
    requestedQuantity < min
  ) {
    return clamp(
      (
        requestedQuantity /
        min
      ) * 100
    );
  }


  return clamp(
    (
      max /
      requestedQuantity
    ) * 100
  );
}


function calculateConditionFit(
  condition,
  buyer
) {
  const normalizedCondition =
    normalizeCondition(
      condition
    );

  if (
    buyer.acceptedConditions.includes(
      normalizedCondition
    )
  ) {
    return 100;
  }

  /*
   * Condition is used as an eligibility /
   * compatibility check instead of giving
   * it another major score weight.
   */

  const hierarchy = [
    "excellent",
    "good",
    "fair",
    "poor",
    "scrap"
  ];

  const requestedIndex =
    hierarchy.indexOf(
      normalizedCondition
    );

  const nearestAccepted =
    buyer.acceptedConditions
      .map(
        (accepted) =>
          hierarchy.indexOf(
            accepted
          )
      )
      .filter(
        (index) =>
          index >= 0
      );


  if (
    requestedIndex === -1 ||
    nearestAccepted.length === 0
  ) {
    return 50;
  }


  const distance =
    Math.min(
      ...nearestAccepted.map(
        (index) =>
          Math.abs(
            requestedIndex -
              index
          )
      )
    );


  if (distance === 1) {
    return 55;
  }

  return 0;
}


function scoreBuyer(
  input,
  buyer
) {
  const priceFit =
    calculatePriceFit(
      input.price,
      buyer
    );


  const demand =
    calculateDemandScore(
      buyer,
      input.category
    );


  const rating =
    calculateRatingScore(
      buyer.rating
    );


  const quantity =
    calculateQuantityScore(
      input.quantity,
      buyer
    );


  const distanceResult =
    calculateDistanceFit(
      input.location,
      buyer.location
    );


  const conditionFit =
    calculateConditionFit(
      input.condition,
      buyer
    );


  /*
   * Core weighted matching score.
   */

  let score =
    priceFit *
      WEIGHTS.priceFit +

    demand *
      WEIGHTS.demand +

    rating *
      WEIGHTS.rating +

    quantity *
      WEIGHTS.quantity +

    distanceResult.score *
      WEIGHTS.distance;


  /*
   * Condition is a compatibility modifier.
   *
   * Completely incompatible condition:
   * heavy penalty.
   */

  if (conditionFit === 0) {
    score *= 0.45;
  } else if (
    conditionFit < 100
  ) {
    score *= 0.8;
  }


  return {
    buyer,

    score:
      Math.round(
        clamp(score) * 100
      ) / 100,

    breakdown: {
      priceFit:
        Math.round(priceFit),

      distanceFit:
        Math.round(
          distanceResult.score
        ),

      buyerDemand:
        Math.round(demand),

      rating:
        Math.round(rating),

      quantityMatch:
        Math.round(quantity),

      conditionFit:
        Math.round(conditionFit)
    },

    distanceKm:
      distanceResult.distanceKm
  };
}


function buildReasons(match) {
  const reasons = [];

  const {
    breakdown,
    distanceKm
  } = match;


  if (
    breakdown.priceFit >= 85
  ) {
    reasons.push(
      "Strong price fit"
    );
  }


  if (
    breakdown.buyerDemand >=
    80
  ) {
    reasons.push(
      "High buyer demand"
    );
  }


  if (
    breakdown.quantityMatch >=
    90
  ) {
    reasons.push(
      "Quantity matches buyer capacity"
    );
  }


  if (
    breakdown.rating >= 90
  ) {
    reasons.push(
      "Highly rated buyer"
    );
  }


  if (distanceKm <= 10) {
    reasons.push(
      "Very close to seller"
    );
  } else if (
    distanceKm <= 30
  ) {
    reasons.push(
      "Nearby buyer"
    );
  }


  if (
    breakdown.conditionFit ===
    100
  ) {
    reasons.push(
      "Buyer accepts this condition"
    );
  }


  return reasons;
}


function findMatches(input) {
  const category =
    normalizeText(
      input.category
    );


  const buyers =
    matchingRepository
      .getAllBuyers();


  /*
   * Stage 1:
   * Remove buyers that do not deal
   * with this category at all.
   */

  const eligibleBuyers =
    buyers.filter(
      (buyer) =>
        buyer.categories.includes(
          category
        )
    );


  /*
   * Stage 2:
   * Score each candidate.
   */

  const scored =
    eligibleBuyers
      .map(
        (buyer) =>
          scoreBuyer(
            {
              ...input,
              category
            },
            buyer
          )
      )


      /*
       * Very poor matches aren't useful.
       */
      .filter(
        (match) =>
          match.score >= 25
      )


      /*
       * Highest score first.
       */
      .sort(
        (a, b) =>
          b.score - a.score
      );


  const limit =
    Math.min(
      Math.max(
        Number(input.limit) || 10,
        1
      ),
      50
    );


  return {
    query: {
      listingId:
        input.listingId ||
        null,

      category,

      location:
        input.location,

      quantity:
        Number(
          input.quantity || 1
        ),

      condition:
        normalizeCondition(
          input.condition
        ),

      price:
        Number(
          input.price || 0
        )
    },

    totalCandidates:
      buyers.length,

    eligibleCandidates:
      eligibleBuyers.length,

    matches:
      scored
        .slice(0, limit)
        .map(
          (
            match,
            index
          ) => ({
            rank:
              index + 1,

            matchScore:
              match.score,

            id:
              match.buyer.id,

            type:
              match.buyer.type,

            name:
              match.buyer.name,

            location:
              match.buyer.location,

            distanceKm:
              match.distanceKm,

            rating:
              match.buyer.rating,

            demandScore:
              match.breakdown
                .buyerDemand,

            breakdown:
              match.breakdown,

            reasons:
              buildReasons(
                match
              )
          })
        )
  };
}


module.exports = {
  findMatches
};