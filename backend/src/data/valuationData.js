const CATEGORY_SYNONYMS = {
  laptop: ['laptop', 'notebook', 'laptop computer'],

  phone: [
    'phone',
    'smartphone',
    'mobile',
    'mobile phone'
  ],

  television: [
    'television',
    'tv',
    'smart tv',
    'led tv',
    'lcd tv'
  ],

  washing_machine: [
    'washing machine',
    'washing_machine',
    'washer'
  ],

  microwave: [
    'microwave',
    'microwave oven'
  ],

  battery: [
    'battery',
    'cell',
    'batteries'
  ],

  pcb: [
    'pcb',
    'printed circuit board',
    'circuit board',
    'motherboard'
  ],

  keyboard: [
    'keyboard',
    'computer keyboard'
  ],

  mouse: [
    'mouse',
    'computer mouse'
  ],

  printer: [
    'printer',
    'printing machine'
  ],

  player: [
    'player',
    'media player',
    'dvd player',
    'cd player'
  ],

  ssd: [
    'ssd',
    'solid state drive'
  ],

  ram: [
    'ram',
    'memory',
    'memory module'
  ],

  gpu: [
    'gpu',
    'graphics card',
    'video card'
  ]
};


// --------------------------------------------------
// Base resale markets
//
// These are Task C baseline estimates.
// ML market prediction is handled separately.
// --------------------------------------------------

const BASE_MARKETS = {
  laptop: {
    label: 'Laptop',
    base: 15000,

    brands: {
      dell: 14000,
      hp: 13000,
      apple: 23000,
      lenovo: 13500
    },

    models: {
      'dell latitude 5420': 14500,
      'macbook pro 14': 26000,
      'hp elitebook 840': 13000,
      'lenovo thinkpad x1 carbon': 17000
    }
  },

  phone: {
    label: 'Phone',
    base: 9000,

    brands: {
      samsung: 9500,
      apple: 22000,
      oneplus: 12000,
      xiaomi: 7000
    },

    models: {
      'iphone 12': 18000,
      'iphone 14': 24000,
      'samsung galaxy s21': 14000,
      'oneplus 9': 11000
    }
  },

  television: {
    label: 'Television',
    base: 8500,

    brands: {
      samsung: 10000,
      lg: 9500,
      sony: 12000,
      xiaomi: 7000
    },

    models: {}
  },

  washing_machine: {
    label: 'Washing Machine',
    base: 7500,

    brands: {
      lg: 8500,
      samsung: 8500,
      whirlpool: 7000,
      bosch: 10000
    },

    models: {}
  },

  microwave: {
    label: 'Microwave',
    base: 3500,

    brands: {
      lg: 4000,
      samsung: 4000,
      panasonic: 4200,
      ifb: 3800
    },

    models: {}
  },

  battery: {
    label: 'Battery',
    base: 1400,

    models: {
      'laptop battery': 1300,
      'phone battery': 900
    }
  },

  pcb: {
    label: 'PCB',
    base: 1800,

    models: {}
  },

  keyboard: {
    label: 'Keyboard',
    base: 800,

    brands: {
      logitech: 1200,
      dell: 700,
      hp: 700,
      lenovo: 750
    },

    models: {}
  },

  mouse: {
    label: 'Mouse',
    base: 500,

    brands: {
      logitech: 900,
      dell: 450,
      hp: 450,
      lenovo: 500
    },

    models: {}
  },

  printer: {
    label: 'Printer',
    base: 5000,

    brands: {
      hp: 5200,
      canon: 5000,
      epson: 5800,
      brother: 5500
    },

    models: {}
  },

  player: {
    label: 'Media Player',
    base: 1500,

    brands: {
      sony: 1800,
      samsung: 1600,
      lg: 1500,
      philips: 1500
    },

    models: {}
  },

  ssd: {
    label: 'SSD',
    base: 3000,

    models: {
      '512gb ssd': 3200,
      '256gb ssd': 1800,
      '1tb ssd': 5200
    }
  },

  ram: {
    label: 'RAM',
    base: 1600,

    models: {
      '16gb ram': 1700,
      '8gb ram': 900
    }
  },

  gpu: {
    label: 'GPU',
    base: 12000,

    models: {
      'rtx 3060': 18000,
      'gtx 1660': 11000
    }
  }
};


// --------------------------------------------------
// Demand by location
// --------------------------------------------------

const DEMAND_BY_LOCATION = {
  delhi: 'high',
  mumbai: 'high',
  bangalore: 'high',
  bengaluru: 'high',
  chennai: 'medium',
  kolkata: 'low'
};


const LOCATION_MULTIPLIER = {
  delhi: 1.05,
  mumbai: 1.05,
  bangalore: 1.03,
  bengaluru: 1.03,
  chennai: 1.0,
  kolkata: 0.97
};


const DEMAND_MULTIPLIER = {
  high: 1.12,
  medium: 1.0,
  low: 0.9
};


// --------------------------------------------------
// Minimum demand level by product category
// --------------------------------------------------

const CATEGORY_DEMAND_FLOOR = {
  laptop: 'high',
  phone: 'high',

  television: 'medium',
  washing_machine: 'medium',
  microwave: 'medium',

  battery: 'high',
  pcb: 'high',

  keyboard: 'medium',
  mouse: 'medium',

  printer: 'medium',
  player: 'low',

  ssd: 'medium',
  ram: 'medium',
  gpu: 'medium'
};


// --------------------------------------------------
// Recoverable components
// --------------------------------------------------

const PARTS_BY_CATEGORY = {
  laptop: [
    {
      name: 'SSD',
      base: 2800,
      conditionFactor: {
        excellent: 1.0,
        good: 0.92,
        fair: 0.75,
        poor: 0.5
      }
    },

    {
      name: 'RAM',
      base: 1700,
      conditionFactor: {
        excellent: 1.0,
        good: 0.88,
        fair: 0.7,
        poor: 0.45
      }
    },

    {
      name: 'Battery',
      base: 1200,
      conditionFactor: {
        excellent: 1.0,
        good: 0.85,
        fair: 0.6,
        poor: 0.35
      }
    },

    {
      name: 'Screen',
      base: 2000,
      conditionFactor: {
        excellent: 1.0,
        good: 0.9,
        fair: 0.65,
        poor: 0.4
      }
    }
  ],


  phone: [
    {
      name: 'Battery',
      base: 900,
      conditionFactor: {
        excellent: 1.0,
        good: 0.88,
        fair: 0.65,
        poor: 0.4
      }
    },

    {
      name: 'Display',
      base: 1800,
      conditionFactor: {
        excellent: 1.0,
        good: 0.9,
        fair: 0.7,
        poor: 0.4
      }
    },

    {
      name: 'Camera Module',
      base: 1200,
      conditionFactor: {
        excellent: 1.0,
        good: 0.9,
        fair: 0.7,
        poor: 0.45
      }
    }
  ],


  television: [
    {
      name: 'Display Panel',
      base: 3500,
      conditionFactor: {
        excellent: 1.0,
        good: 0.85,
        fair: 0.55,
        poor: 0.2
      }
    },

    {
      name: 'Main Board',
      base: 1800,
      conditionFactor: {
        excellent: 1.0,
        good: 0.9,
        fair: 0.7,
        poor: 0.4
      }
    },

    {
      name: 'Power Supply Board',
      base: 1200,
      conditionFactor: {
        excellent: 1.0,
        good: 0.88,
        fair: 0.65,
        poor: 0.4
      }
    },

    {
      name: 'Speakers',
      base: 500,
      conditionFactor: {
        excellent: 1.0,
        good: 0.85,
        fair: 0.65,
        poor: 0.4
      }
    }
  ],


  washing_machine: [
    {
      name: 'Motor',
      base: 2200,
      conditionFactor: {
        excellent: 1.0,
        good: 0.9,
        fair: 0.65,
        poor: 0.35
      }
    },

    {
      name: 'Control Board',
      base: 1600,
      conditionFactor: {
        excellent: 1.0,
        good: 0.88,
        fair: 0.65,
        poor: 0.35
      }
    },

    {
      name: 'Drum Assembly',
      base: 1700,
      conditionFactor: {
        excellent: 1.0,
        good: 0.85,
        fair: 0.6,
        poor: 0.3
      }
    }
  ],


  microwave: [
    {
      name: 'Magnetron',
      base: 1300,
      conditionFactor: {
        excellent: 1.0,
        good: 0.9,
        fair: 0.6,
        poor: 0.3
      }
    },

    {
      name: 'Transformer',
      base: 900,
      conditionFactor: {
        excellent: 1.0,
        good: 0.9,
        fair: 0.7,
        poor: 0.4
      }
    },

    {
      name: 'Control Board',
      base: 700,
      conditionFactor: {
        excellent: 1.0,
        good: 0.85,
        fair: 0.6,
        poor: 0.3
      }
    }
  ],


  battery: [
    {
      name: 'Battery Cells',
      base: 900,
      conditionFactor: {
        excellent: 1.0,
        good: 0.88,
        fair: 0.6,
        poor: 0.3
      }
    }
  ],


  pcb: [
    {
      name: 'PCB Board',
      base: 1400,
      conditionFactor: {
        excellent: 1.0,
        good: 0.9,
        fair: 0.7,
        poor: 0.45
      }
    },

    {
      name: 'Recoverable Components',
      base: 800,
      conditionFactor: {
        excellent: 1.0,
        good: 0.88,
        fair: 0.65,
        poor: 0.45
      }
    }
  ],


  keyboard: [
    {
      name: 'Controller Board',
      base: 250,
      conditionFactor: {
        excellent: 1.0,
        good: 0.85,
        fair: 0.6,
        poor: 0.3
      }
    },

    {
      name: 'Key Switches',
      base: 300,
      conditionFactor: {
        excellent: 1.0,
        good: 0.85,
        fair: 0.6,
        poor: 0.3
      }
    }
  ],


  mouse: [
    {
      name: 'Sensor',
      base: 180,
      conditionFactor: {
        excellent: 1.0,
        good: 0.85,
        fair: 0.6,
        poor: 0.3
      }
    },

    {
      name: 'Controller Board',
      base: 150,
      conditionFactor: {
        excellent: 1.0,
        good: 0.85,
        fair: 0.6,
        poor: 0.3
      }
    }
  ],


  printer: [
    {
      name: 'Print Head',
      base: 1700,
      conditionFactor: {
        excellent: 1.0,
        good: 0.85,
        fair: 0.6,
        poor: 0.3
      }
    },

    {
      name: 'Motor Assembly',
      base: 900,
      conditionFactor: {
        excellent: 1.0,
        good: 0.88,
        fair: 0.65,
        poor: 0.35
      }
    },

    {
      name: 'Control Board',
      base: 1100,
      conditionFactor: {
        excellent: 1.0,
        good: 0.88,
        fair: 0.65,
        poor: 0.35
      }
    }
  ],


  player: [
    {
      name: 'Optical Drive',
      base: 500,
      conditionFactor: {
        excellent: 1.0,
        good: 0.85,
        fair: 0.6,
        poor: 0.3
      }
    },

    {
      name: 'Main Board',
      base: 550,
      conditionFactor: {
        excellent: 1.0,
        good: 0.85,
        fair: 0.6,
        poor: 0.3
      }
    }
  ],


  ssd: [
    {
      name: 'SSD Core',
      base: 2800,
      conditionFactor: {
        excellent: 1.0,
        good: 0.88,
        fair: 0.7,
        poor: 0.45
      }
    }
  ],


  ram: [
    {
      name: 'RAM Module',
      base: 1500,
      conditionFactor: {
        excellent: 1.0,
        good: 0.85,
        fair: 0.65,
        poor: 0.35
      }
    }
  ],


  gpu: [
    {
      name: 'GPU Chip',
      base: 10000,
      conditionFactor: {
        excellent: 1.0,
        good: 0.88,
        fair: 0.7,
        poor: 0.45
      }
    },

    {
      name: 'Cooling Assembly',
      base: 2200,
      conditionFactor: {
        excellent: 1.0,
        good: 0.9,
        fair: 0.7,
        poor: 0.4
      }
    }
  ]
};


// --------------------------------------------------
// Guaranteed scrap value
// --------------------------------------------------

const SCRAP_BASE = {
  laptop: 2200,
  phone: 1000,

  television: 1500,
  washing_machine: 2200,
  microwave: 800,

  battery: 400,
  pcb: 900,

  keyboard: 150,
  mouse: 80,

  printer: 700,
  player: 250,

  ssd: 800,
  ram: 500,
  gpu: 1600
};


// --------------------------------------------------
// Approximate repair cost
// --------------------------------------------------

const REPAIR_BASE = {
  laptop: 1800,
  phone: 1000,

  television: 2200,
  washing_machine: 1800,
  microwave: 900,

  battery: 600,
  pcb: 700,

  keyboard: 300,
  mouse: 200,

  printer: 1400,
  player: 600,

  ssd: 700,
  ram: 500,
  gpu: 1300
};


// --------------------------------------------------
// Route labels
// --------------------------------------------------

const ROUTE_LABELS = {
  whole: 'Sell Whole',

  parts: 'Sell as Components',

  repair_and_sell:
    'Repair and Sell',

  auction: 'Auction',

  scrap: 'Scrap',

  donate: 'Donate'
};


module.exports = {
  CATEGORY_SYNONYMS,

  BASE_MARKETS,

  DEMAND_BY_LOCATION,

  LOCATION_MULTIPLIER,

  DEMAND_MULTIPLIER,

  CATEGORY_DEMAND_FLOOR,

  PARTS_BY_CATEGORY,

  SCRAP_BASE,

  REPAIR_BASE,

  ROUTE_LABELS
};