const buyers = [
  {
    id: "consumer-001",
    type: "consumer",
    name: "Rahul Sharma",
    location: "Delhi",

    categories: [
      "laptop",
      "phone",
      "ssd",
      "ram",
      "gpu"
    ],

    minPrice: 500,
    maxPrice: 45000,

    minQuantity: 1,
    maxQuantity: 3,

    acceptedConditions: [
      "excellent",
      "good",
      "fair"
    ],

    rating: 4.5,

    demand: {
      laptop: 82,
      phone: 88,
      ssd: 76,
      ram: 72,
      gpu: 80
    }
  },


  {
    id: "kabadiwala-001",
    type: "kabadiwala",
    name: "Green Scrap Delhi",
    location: "Delhi",

    categories: [
      "laptop",
      "phone",
      "television",
      "washing_machine",
      "microwave",
      "battery",
      "pcb",
      "keyboard",
      "mouse",
      "printer",
      "player",
      "ssd",
      "ram",
      "gpu"
    ],

    minPrice: 100,
    maxPrice: 30000,

    minQuantity: 1,
    maxQuantity: 100,

    acceptedConditions: [
      "excellent",
      "good",
      "fair",
      "poor",
      "scrap"
    ],

    rating: 4.7,

    demand: {
      laptop: 78,
      phone: 80,
      television: 72,
      washing_machine: 70,
      microwave: 65,
      battery: 92,
      pcb: 95,
      keyboard: 58,
      mouse: 55,
      printer: 68,
      player: 55,
      ssd: 82,
      ram: 84,
      gpu: 86
    }
  },


  {
    id: "business-001",
    type: "business",
    name: "TechRenew Enterprises",
    location: "Gurgaon",

    categories: [
      "laptop",
      "phone",
      "ssd",
      "ram",
      "gpu"
    ],

    minPrice: 3000,
    maxPrice: 100000,

    minQuantity: 5,
    maxQuantity: 500,

    acceptedConditions: [
      "excellent",
      "good",
      "fair"
    ],

    rating: 4.8,

    demand: {
      laptop: 94,
      phone: 86,
      ssd: 90,
      ram: 88,
      gpu: 84
    }
  },


  {
    id: "repair-001",
    type: "repair_shop",
    name: "Delhi Device Repair Hub",
    location: "Delhi",

    categories: [
      "laptop",
      "phone",
      "television",
      "printer",
      "ssd",
      "ram",
      "gpu",
      "keyboard",
      "mouse"
    ],

    minPrice: 200,
    maxPrice: 25000,

    minQuantity: 1,
    maxQuantity: 30,

    acceptedConditions: [
      "good",
      "fair",
      "poor"
    ],

    rating: 4.6,

    demand: {
      laptop: 92,
      phone: 90,
      television: 74,
      printer: 76,
      ssd: 88,
      ram: 86,
      gpu: 90,
      keyboard: 62,
      mouse: 60
    }
  },


  {
    id: "recycler-001",
    type: "recycler",
    name: "EcoCycle Recycling",
    location: "Noida",

    categories: [
      "laptop",
      "phone",
      "television",
      "washing_machine",
      "microwave",
      "battery",
      "pcb",
      "keyboard",
      "mouse",
      "printer",
      "player"
    ],

    minPrice: 50,
    maxPrice: 20000,

    minQuantity: 1,
    maxQuantity: 1000,

    acceptedConditions: [
      "excellent",
      "good",
      "fair",
      "poor",
      "scrap"
    ],

    rating: 4.9,

    demand: {
      laptop: 70,
      phone: 76,
      television: 84,
      washing_machine: 88,
      microwave: 78,
      battery: 98,
      pcb: 96,
      keyboard: 68,
      mouse: 65,
      printer: 82,
      player: 68
    }
  },


  {
    id: "kabadiwala-002",
    type: "kabadiwala",
    name: "Noida E-Waste Collection",
    location: "Noida",

    categories: [
      "laptop",
      "phone",
      "battery",
      "pcb",
      "printer",
      "television"
    ],

    minPrice: 100,
    maxPrice: 35000,

    minQuantity: 1,
    maxQuantity: 150,

    acceptedConditions: [
      "excellent",
      "good",
      "fair",
      "poor",
      "scrap"
    ],

    rating: 4.4,

    demand: {
      laptop: 80,
      phone: 82,
      battery: 96,
      pcb: 94,
      printer: 72,
      television: 75
    }
  }
];


function getAllBuyers() {
  return buyers.map((buyer) => ({
    ...buyer,
    categories: [...buyer.categories],
    acceptedConditions: [...buyer.acceptedConditions],
    demand: { ...buyer.demand }
  }));
}


function getBuyerById(id) {
  const buyer = buyers.find(
    (candidate) => candidate.id === id
  );

  if (!buyer) {
    return null;
  }

  return {
    ...buyer,
    categories: [...buyer.categories],
    acceptedConditions: [...buyer.acceptedConditions],
    demand: { ...buyer.demand }
  };
}


module.exports = {
  getAllBuyers,
  getBuyerById
};