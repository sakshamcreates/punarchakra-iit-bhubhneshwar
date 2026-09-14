const pickupRepository =
  require("../data/pickupRepository");


const VALID_STATUSES = [
  "available",
  "accepted",
  "en_route",
  "collected",
  "completed"
];


const NEXT_STATUS = {
  accepted:
    "en_route",

  en_route:
    "collected",

  collected:
    "completed"
};


const CITY_DISTANCE_KM = {
  delhi: {
    delhi: 2.1,
    noida: 18,
    gurgaon: 28,
    ghaziabad: 24,
    faridabad: 30
  },

  noida: {
    delhi: 18,
    noida: 1.4,
    gurgaon: 40,
    ghaziabad: 15,
    faridabad: 28
  },

  gurgaon: {
    delhi: 28,
    noida: 40,
    gurgaon: 2.3,
    ghaziabad: 48,
    faridabad: 32
  },

  ghaziabad: {
    delhi: 24,
    noida: 15,
    gurgaon: 48,
    ghaziabad: 1.8,
    faridabad: 42
  },

  faridabad: {
    delhi: 30,
    noida: 28,
    gurgaon: 32,
    ghaziabad: 42,
    faridabad: 2
  }
};


function normalizeLocation(
  value
) {
  return String(
    value || ""
  )
    .trim()
    .toLowerCase();
}


function getDistance(
  from,
  to
) {
  const source =
    normalizeLocation(from);

  const destination =
    normalizeLocation(to);

  if (
    !source ||
    !destination
  ) {
    return 50;
  }

  if (
    source === destination
  ) {
    return (
      CITY_DISTANCE_KM[
        source
      ]?.[
        destination
      ] || 2
    );
  }

  return (
    CITY_DISTANCE_KM[
      source
    ]?.[
      destination
    ] || 50
  );
}


function createPickup(data) {
  if (!data.seller) {
    throw new Error(
      "seller is required"
    );
  }

  if (!data.location) {
    throw new Error(
      "location is required"
    );
  }

  if (!data.material) {
    throw new Error(
      "material is required"
    );
  }

  const estimatedValue =
    Number(
      data.estimated_value
    );

  if (
    !Number.isFinite(
      estimatedValue
    ) ||
    estimatedValue < 0
  ) {
    throw new Error(
      "estimated_value must be a valid number"
    );
  }

  return pickupRepository
    .createPickup({
      seller:
        data.seller,

      location:
        data.location,

      material:
        data.material,

      estimated_value:
        estimatedValue,

      quantity:
        data.quantity || 1
    });
}


function getPickup(id) {
  const pickup =
    pickupRepository
      .getPickupById(id);

  if (!pickup) {
    const error =
      new Error(
        "Pickup request not found"
      );

    error.statusCode =
      404;

    throw error;
  }

  return pickup;
}


function getNearbyPickups(
  location,
  limit = 20
) {
  if (!location) {
    throw new Error(
      "location is required"
    );
  }

  const pickups =
    pickupRepository
      .getAllPickups()
      .filter(
        (pickup) =>
          pickup.status ===
          "available"
      )
      .map(
        (pickup) => ({
          ...pickup,

          distance_km:
            getDistance(
              location,
              pickup.location
            )
        })
      )
      .sort(
        (a, b) =>
          a.distance_km -
          b.distance_km
      );

  return pickups.slice(
    0,
    Math.min(
      Number(limit) || 20,
      50
    )
  );
}


function acceptPickup(
  pickupId,
  kabadiwala
) {
  const pickup =
    getPickup(
      pickupId
    );

  if (
    pickup.status !==
    "available"
  ) {
    const error =
      new Error(
        "Pickup is no longer available"
      );

    error.statusCode =
      409;

    throw error;
  }

  if (
    !kabadiwala ||
    !kabadiwala.id
  ) {
    throw new Error(
      "kabadiwala is required"
    );
  }

  return pickupRepository
    .updatePickup(
      pickupId,
      {
        kabadiwala,
        status:
          "accepted"
      }
    );
}


function updatePickupStatus(
  pickupId,
  status
) {
  const pickup =
    getPickup(
      pickupId
    );

  if (
    !VALID_STATUSES.includes(
      status
    )
  ) {
    const error =
      new Error(
        "Invalid pickup status"
      );

    error.statusCode =
      400;

    throw error;
  }

  if (
    status ===
    "available"
  ) {
    const error =
      new Error(
        "Accepted pickup cannot return to available"
      );

    error.statusCode =
      400;

    throw error;
  }

  const expected =
    NEXT_STATUS[
      pickup.status
    ];

  if (
    expected &&
    status !== expected
  ) {
    const error =
      new Error(
        `Pickup must move from ${pickup.status} to ${expected}`
      );

    error.statusCode =
      400;

    throw error;
  }

  if (
    pickup.status ===
    "completed"
  ) {
    const error =
      new Error(
        "Pickup is already completed"
      );

    error.statusCode =
      400;

    throw error;
  }

  return pickupRepository
    .updatePickup(
      pickupId,
      {
        status
      }
    );
}


function advancePickupStatus(
  pickupId
) {
  const pickup =
    getPickup(
      pickupId
    );

  const next =
    NEXT_STATUS[
      pickup.status
    ];

  if (!next) {
    const error =
      new Error(
        "Pickup cannot be advanced further"
      );

    error.statusCode =
      400;

    throw error;
  }

  return updatePickupStatus(
    pickupId,
    next
  );
}


function getKabadiwalaPickups(
  kabadiwalaId
) {
  return pickupRepository
    .getKabadiwalaPickups(
      kabadiwalaId
    );
}


function getSellerPickups(
  sellerId
) {
  return pickupRepository
    .getSellerPickups(
      sellerId
    );
}


/*
 * Mock route optimisation.
 *
 * We are NOT pretending this is
 * Google Maps optimisation.
 *
 * We simply produce a predefined,
 * distance-sorted route.
 */
function getOptimizedRoute(
  kabadiwalaId,
  origin
) {
  const assigned =
    getKabadiwalaPickups(
      kabadiwalaId
    )
      .filter(
        (pickup) =>
          pickup.status !==
          "completed"
      )
      .map(
        (pickup) => ({
          ...pickup,

          distance_km:
            getDistance(
              origin,
              pickup.location
            )
        })
      )
      .sort(
        (a, b) =>
          a.distance_km -
          b.distance_km
      );

  const stops =
    assigned.map(
      (
        pickup,
        index
      ) => ({
        stop:
          index + 1,

        pickup_id:
          pickup.id,

        location:
          pickup.location,

        material:
          pickup.material,

        estimated_value:
          pickup.estimated_value,

        status:
          pickup.status,

        distance_km:
          pickup.distance_km
      })
    );

  return {
    origin,

    route_name:
      assigned.length >
      1
        ? "Optimized collection route"
        : "Direct pickup route",

    total_stops:
      stops.length,

    estimated_distance_km:
      Number(
        stops
          .reduce(
            (
              total,
              stop
            ) =>
              total +
              stop.distance_km,
            0
          )
          .toFixed(1)
      ),

    stops
  };
}


function getKabadiwalaStats(
  kabadiwalaId,
  location
) {
  const assigned =
    getKabadiwalaPickups(
      kabadiwalaId
    );

  const completed =
    assigned.filter(
      (pickup) =>
        pickup.status ===
        "completed"
    );

  const active =
    assigned.filter(
      (pickup) =>
        pickup.status !==
        "completed"
    );

  const nearby =
    getNearbyPickups(
      location,
      100
    );

  const earnings =
    completed.reduce(
      (
        total,
        pickup
      ) =>
        total +
        Number(
          pickup.estimated_value ||
          0
        ),
      0
    );

  const inventoryValue =
    assigned
      .filter(
        (pickup) =>
          pickup.status ===
            "collected" ||
          pickup.status ===
            "completed"
      )
      .reduce(
        (
          total,
          pickup
        ) =>
          total +
          Number(
            pickup.estimated_value ||
            0
          ),
        0
      );

  return {
    earnings,

    available_pickups:
      nearby.length,

    active_pickups:
      active.length,

    completed_pickups:
      completed.length,

    inventory_value:
      inventoryValue,

    suggested_material:
      nearby.length
        ? nearby[0].material
        : "No nearby demand"
  };
}


module.exports = {
  createPickup,
  getPickup,
  getNearbyPickups,
  acceptPickup,
  updatePickupStatus,
  advancePickupStatus,
  getKabadiwalaPickups,
  getSellerPickups,
  getOptimizedRoute,
  getKabadiwalaStats
};