import {
  useEffect,
  useMemo,
  useState
} from "react";

import { Wallet, Tags, Truck, Leaf } from "lucide-react";

import DashboardSidebar from "../components/dashboard/DashboardSidebar";
import DashboardStatCard from "../components/dashboard/DashboardStatCard";
import RecentActivityCard from "../components/dashboard/RecentActivityCard";
import ListingCard from "../components/dashboard/ListingCard";
import ScrapLockerPreview from "../components/dashboard/ScrapLockerPreview";
import GreenImpactCard from "../components/dashboard/GreenImpactCard";

import SectionHeader from "../components/ui/SectionHeader";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";

import {
  useAuth
} from "../contexts/AuthContext";

import {
  getNearbyPickups,
  getKabadiwalaPickups,
  getKabadiwalaStats,
  getRoutePlan,
  acceptPickup,
  advancePickup
} from "../services/pickupService";


/*
 * ------------------------------------------------
 * EXISTING CONSUMER DATA
 * ------------------------------------------------
 *
 * Kept unchanged so the normal consumer dashboard
 * still looks like your submitted frontend.
 */

const consumerStats = [
  {
    value: "₹18,450",
    label: "Total value recovered",
    icon: Wallet,
    tone: "hero"
  },

  {
    value: "3",
    label: "Active listings",
    icon: Tags
  },

  {
    value: "1",
    label: "Pickup scheduled",
    icon: Truck
  },

  {
    value: "8.4 kg",
    label: "E-waste diverted",
    icon: Leaf
  }
];


const recentActivity = [
  {
    product:
      "Lenovo IdeaPad Gaming 3",

    status:
      "Components currently being listed",

    detail:
      "Your device is being broken into high-demand parts for resale.",

    estimate:
      "₹15,800"
  },

  {
    product:
      "Redmi Note 10",

    status:
      "Scrap pickup scheduled",

    detail:
      "Pickup is confirmed for tomorrow evening.",

    estimate:
      "Tomorrow 4–6 PM"
  }
];


const listings = [
  {
    product:
      "Lenovo IdeaPad Gaming 3",

    askingPrice:
      "₹15,800",

    views:
      "120",

    offers:
      "4",

    status:
      "Active"
  },

  {
    product:
      "Dell Inspiron 5515",

    askingPrice:
      "₹9,200",

    views:
      "72",

    offers:
      "2",

    status:
      "Review"
  },

  {
    product:
      "iPhone 12",

    askingPrice:
      "₹11,400",

    views:
      "98",

    offers:
      "5",

    status:
      "Active"
  }
];


function formatCurrency(
  value
) {
  return `₹${Number(
    value || 0
  ).toLocaleString(
    "en-IN"
  )}`;
}


function prettyStatus(
  value
) {
  return String(
    value || ""
  )
    .replaceAll(
      "_",
      " "
    )
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase()
    );
}


function getNextActionLabel(
  status
) {
  switch (status) {
    case "accepted":
      return "Start Route";

    case "en_route":
      return "Mark Collected";

    case "collected":
      return "Complete Pickup";

    default:
      return null;
  }
}


/*
 * ------------------------------------------------
 * CONSUMER DASHBOARD
 * ------------------------------------------------
 */

function ConsumerDashboard() {
  return (
    <>
      <div className="page-intro">

        <div className="eyebrow">
          My Punarchakra
        </div>

        <h1>
          Your circular economy overview
        </h1>

        <p>
          Track your recovered value,
          active listings, pickups,
          and sustainability impact
          in one place.
        </p>

      </div>


      <section className="dashboard-stats grid grid-4">

        {consumerStats.map(
          (stat) => (

            <DashboardStatCard
              key={stat.label}
              value={stat.value}
              label={stat.label}
              icon={stat.icon}
              tone={stat.tone}
            />

          )
        )}

      </section>


      <section className="section dashboard-panel-grid">

        <div>

          <SectionHeader
            title="Recent activity"
            description="What’s happening with your listings and pickups right now."
          />


          <div className="recent-activity-list">

            {recentActivity.map(
              (activity) => (

                <RecentActivityCard
                  key={
                    activity.product
                  }
                  product={
                    activity.product
                  }
                  status={
                    activity.status
                  }
                  detail={
                    activity.detail
                  }
                  estimate={
                    activity.estimate
                  }
                />

              )
            )}

          </div>

        </div>


        <div>

          <SectionHeader
            title="Scrap locker preview"
            description="Add more scrap weight to unlock free pickup."
          />

          <ScrapLockerPreview
            currentKg={6.8}
            goalKg={10}
            message="Add 3.2 kg more to unlock free pickup."
          />

        </div>

      </section>


      <section className="section">

        <SectionHeader
          title="Active listings"
          description="Your current listings at a glance."
        />


        <div className="listing-grid">

          {listings.map(
            (listing) => (

              <ListingCard
                key={
                  listing.product
                }
                product={
                  listing.product
                }
                askingPrice={
                  listing.askingPrice
                }
                views={
                  listing.views
                }
                offers={
                  listing.offers
                }
                status={
                  listing.status
                }
              />

            )
          )}

        </div>

      </section>


      <section className="section">

        <GreenImpactCard
          recovered="12.4 kg"
          reused="8.1 kg"
          recycled="3.4 kg"
          refurbished="0.9 kg"
          score="742"
          label="Circular Champion"
        />

      </section>
    </>
  );
}


/*
 * ------------------------------------------------
 * KABADIWALA DASHBOARD
 * ------------------------------------------------
 *
 * Same /dashboard route.
 *
 * Only rendered when:
 *
 * user.role === "kabadiwala"
 */

function KabadiwalaDashboard({
  user
}) {
  /*
   * Use real account ID when available.
   *
   * Email fallback means the demo still
   * works even if your auth response calls
   * the ID something different.
   */
  const kabadiwalaId =
    user?.id ||
    user?._id ||
    user?.email ||
    "kabadiwala-demo";


  const location =
    user?.location ||
    "Delhi";


  const [
    nearbyPickups,
    setNearbyPickups
  ] = useState([]);


  const [
    myPickups,
    setMyPickups
  ] = useState([]);


  const [
    stats,
    setStats
  ] = useState(null);


  const [
    routePlan,
    setRoutePlan
  ] = useState(null);


  const [
    loading,
    setLoading
  ] = useState(true);


  const [
    activeActionId,
    setActiveActionId
  ] = useState(null);


  const [
    error,
    setError
  ] = useState("");


  /*
   * Load all dashboard data from
   * Task G backend.
   */
  async function loadKabadiwalaDashboard(
    silent = false
  ) {
    if (!silent) {
      setLoading(true);
    }

    try {
      const [
        nearbyResponse,
        pickupResponse,
        statsResponse,
        routeResponse
      ] =
        await Promise.all([
          getNearbyPickups(
            location,
            8
          ),

          getKabadiwalaPickups(
            kabadiwalaId
          ),

          getKabadiwalaStats(
            kabadiwalaId,
            location
          ),

          getRoutePlan(
            kabadiwalaId,
            location
          )
        ]);


      setNearbyPickups(
        Array.isArray(
          nearbyResponse
        )
          ? nearbyResponse
          : []
      );


      setMyPickups(
        Array.isArray(
          pickupResponse
        )
          ? pickupResponse
          : []
      );


      setStats(
        statsResponse ||
        null
      );


      setRoutePlan(
        routeResponse ||
        null
      );


      setError("");

    } catch (err) {
      console.error(
        "Kabadiwala dashboard error:",
        err
      );

      setError(
        err.message ||
        "Unable to load Kabadiwala operations."
      );

    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }


  /*
   * Initial load.
   */
  useEffect(() => {
    loadKabadiwalaDashboard();
  }, [
    kabadiwalaId,
    location
  ]);


  /*
   * Refresh every 5 seconds.
   *
   * Same REST-polling approach used
   * for auctions.
   */
  useEffect(() => {
    const timer =
      window.setInterval(
        () => {
          loadKabadiwalaDashboard(
            true
          );
        },
        5000
      );

    return () =>
      window.clearInterval(
        timer
      );
  }, [
    kabadiwalaId,
    location
  ]);


  /*
   * Accept available pickup.
   */
  async function handleAccept(
    pickup
  ) {
    setActiveActionId(
      pickup.id
    );

    setError("");

    try {
      await acceptPickup(
        pickup.id,
        {
          id:
            kabadiwalaId,

          name:
            user?.name ||
            "Kabadiwala"
        }
      );

      /*
       * Refresh immediately.
       *
       * The pickup should disappear
       * from Nearby and appear under
       * My Pickups.
       */
      await loadKabadiwalaDashboard(
        true
      );

    } catch (err) {
      setError(
        err.message ||
        "Unable to accept pickup."
      );

    } finally {
      setActiveActionId(
        null
      );
    }
  }


  /*
   * accepted
   *    ↓
   * en_route
   *    ↓
   * collected
   *    ↓
   * completed
   */
  async function handleAdvance(
    pickup
  ) {
    setActiveActionId(
      pickup.id
    );

    setError("");

    try {
      await advancePickup(
        pickup.id
      );

      await loadKabadiwalaDashboard(
        true
      );

    } catch (err) {
      setError(
        err.message ||
        "Unable to update pickup."
      );

    } finally {
      setActiveActionId(
        null
      );
    }
  }


  /*
   * Keep the same four-stat layout
   * that DashboardPage already used.
   */
  const dashboardStats =
    useMemo(
      () => [
        {
          value:
            formatCurrency(
              stats?.earnings
            ),

          label:
            "Today's Earnings"
        },

        {
          value:
            String(
              stats
                ?.available_pickups ??
              nearbyPickups.length
            ),

          label:
            "Available Pickups"
        },

        {
          value:
            formatCurrency(
              stats
                ?.inventory_value
            ),

          label:
            "Inventory Value"
        },

        {
          value:
            stats
              ?.suggested_material ||
            "—",

          label:
            "Suggested Material"
        }
      ],
      [
        stats,
        nearbyPickups.length
      ]
    );


  if (loading) {
    return (
      <>
        <div className="page-intro">

          <div className="eyebrow">
            Kabadiwala operations
          </div>

          <h1>
            Overview
          </h1>

        </div>

        <Card>
          Loading pickup operations...
        </Card>
      </>
    );
  }


  return (
    <>
      <div className="page-intro">

        <div className="eyebrow">
          Kabadiwala operations
        </div>

        <h1>
          Overview
        </h1>

        <p>
          Accept nearby opportunities,
          manage active collections,
          and plan your pickup route.
        </p>

      </div>


      {error ? (
        <Card>
          <p>
            {error}
          </p>
        </Card>
      ) : null}


      {/*
       * ---------------------------
       * STATS
       * ---------------------------
       */}

      <section className="dashboard-stats grid grid-4">

        {dashboardStats.map(
          (stat) => (

            <DashboardStatCard
              key={
                stat.label
              }
              value={
                stat.value
              }
              label={
                stat.label
              }
            />

          )
        )}

      </section>


      {/*
       * ---------------------------
       * NEARBY PICKUPS
       * ---------------------------
       */}

      <section className="section">

        <SectionHeader
          eyebrow="PICKUP MARKET"
          title="Nearby opportunities"
          description="Available pickup requests ranked by distance."
        />


        {nearbyPickups.length ===
        0 ? (

          <Card>
            <p>
              No nearby pickup
              requests are available
              right now.
            </p>
          </Card>

        ) : (

          <div className="grid grid-3">

            {nearbyPickups
              .slice(0, 6)
              .map(
                (pickup) => (

                  <Card
                    key={
                      pickup.id
                    }
                    className="route-card"
                  >

                    <div className="eyebrow">

                      {pickup.distance_km ??
                        "—"}{" "}
                      km away

                    </div>


                    <h3>
                      {
                        pickup.material
                      }
                    </h3>


                    <p>
                      {
                        pickup.location
                      }
                    </p>


                    <div
                      className="metric"
                      style={{
                        marginTop: 12
                      }}
                    >

                      {formatCurrency(
                        pickup.estimated_value
                      )}

                    </div>


                    <p>
                      Quantity:{" "}
                      {pickup.quantity ||
                        1}
                    </p>


                    <Button
                      variant="primary"
                      disabled={
                        activeActionId ===
                        pickup.id
                      }
                      onClick={() =>
                        handleAccept(
                          pickup
                        )
                      }
                    >

                      {activeActionId ===
                      pickup.id
                        ? "Accepting..."
                        : "Accept Pickup"}

                    </Button>

                  </Card>

                )
              )}

          </div>

        )}

      </section>


      {/*
       * ---------------------------
       * ASSIGNED PICKUPS
       * ---------------------------
       */}

      <section className="section">

        <SectionHeader
          eyebrow="ACTIVE JOBS"
          title="My pickups"
          description="Move accepted jobs through the collection process."
        />


        {myPickups.length ===
        0 ? (

          <Card>
            <p>
              You have not accepted
              any pickups yet.
            </p>
          </Card>

        ) : (

          <div className="grid grid-3">

            {myPickups.map(
              (pickup) => {
                const actionLabel =
                  getNextActionLabel(
                    pickup.status
                  );

                return (

                  <Card
                    key={
                      pickup.id
                    }
                    className="route-card"
                  >

                    <div className="eyebrow">

                      {prettyStatus(
                        pickup.status
                      )}

                    </div>


                    <h3>
                      {
                        pickup.material
                      }
                    </h3>


                    <p>
                      {
                        pickup.location
                      }
                    </p>


                    <p>
                      Seller:{" "}
                      {pickup.seller
                        ?.name ||
                        "Seller"}
                    </p>


                    <strong>
                      {formatCurrency(
                        pickup.estimated_value
                      )}
                    </strong>


                    {actionLabel ? (

                      <div
                        style={{
                          marginTop: 14
                        }}
                      >

                        <Button
                          variant="primary"
                          disabled={
                            activeActionId ===
                            pickup.id
                          }
                          onClick={() =>
                            handleAdvance(
                              pickup
                            )
                          }
                        >

                          {activeActionId ===
                          pickup.id
                            ? "Updating..."
                            : actionLabel}

                        </Button>

                      </div>

                    ) : (

                      <div
                        className="eyebrow"
                        style={{
                          marginTop: 14
                        }}
                      >

                        Completed

                      </div>

                    )}

                  </Card>

                );
              }
            )}

          </div>

        )}

      </section>


      {/*
       * ---------------------------
       * ROUTE PLANNER
       * ---------------------------
       */}

      <section className="section">

        <SectionHeader
          eyebrow="ROUTE PLANNER"
          title="Suggested collection route"
          description="A lightweight route plan for your accepted pickups."
        />


        {!routePlan ||
        !Array.isArray(
          routePlan.stops
        ) ||
        routePlan.stops.length ===
          0 ? (

          <Card>
            <p>
              Accept a pickup to
              generate your collection
              route.
            </p>
          </Card>

        ) : (

          <Card>

            <div className="eyebrow">
              {routePlan.route_name ||
                "Collection route"}
            </div>


            <h3>

              {routePlan.total_stops ||
                routePlan.stops.length}{" "}

              pickup{" "}

              {(routePlan.total_stops ||
                routePlan.stops.length) ===
              1
                ? "stop"
                : "stops"}

            </h3>


            <p>

              Approx.{" "}

              {routePlan
                .estimated_distance_km ??
                "—"}{" "}

              km

            </p>


            <div className="recent-activity-list">

              {routePlan.stops.map(
                (stop) => (

                  <div
                    key={
                      stop.pickup_id
                    }
                    className="card"
                    style={{
                      padding: 14
                    }}
                  >

                    <strong>

                      Stop {stop.stop}:{" "}

                      {
                        stop.location
                      }

                    </strong>


                    <p>

                      {
                        stop.material
                      }

                      {" • "}

                      {
                        stop.distance_km
                      }{" "}

                      km

                    </p>


                    <span className="eyebrow">

                      {prettyStatus(
                        stop.status
                      )}

                    </span>

                  </div>

                )
              )}

            </div>

          </Card>

        )}

      </section>

    </>
  );
}


/*
 * ------------------------------------------------
 * SINGLE DASHBOARD ROUTE
 * ------------------------------------------------
 */

export default function DashboardPage() {
  const {
    user
  } = useAuth();


  const isKabadiwala =
    user?.role ===
    "kabadiwala";


  return (
    <main className="dashboard-page container section">

      <div className="dashboard-layout">

        <DashboardSidebar />


        <div className="dashboard-content">

          {isKabadiwala ? (

            <KabadiwalaDashboard
              user={
                user
              }
            />

          ) : (

            <ConsumerDashboard />

          )}

        </div>

      </div>

    </main>
  );
}