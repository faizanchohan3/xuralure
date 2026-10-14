// Seed catalog: vehicles + generated parts inventory.
// Deterministic so the catalog is stable between restarts.

const VEHICLES = {
  Acura: ['MDX', 'RDX', 'TLX', 'ILX', 'TL'],
  BMW: ['3 Series', '5 Series', 'X3', 'X5', 'X1'],
  Buick: ['Enclave', 'Encore', 'LaCrosse', 'Regal'],
  Cadillac: ['Escalade', 'CTS', 'SRX', 'XT5'],
  Chevrolet: ['Silverado 1500', 'Malibu', 'Equinox', 'Tahoe', 'Impala', 'Cruze', 'Camaro'],
  Chrysler: ['300', 'Pacifica', 'Town & Country', '200'],
  Dodge: ['Ram 1500', 'Charger', 'Challenger', 'Durango', 'Grand Caravan', 'Journey'],
  Ford: ['F-150', 'Explorer', 'Escape', 'Fusion', 'Focus', 'Mustang', 'Edge', 'Expedition'],
  GMC: ['Sierra 1500', 'Yukon', 'Acadia', 'Terrain'],
  Honda: ['Accord', 'Civic', 'CR-V', 'Pilot', 'Odyssey', 'Fit'],
  Hyundai: ['Elantra', 'Sonata', 'Santa Fe', 'Tucson', 'Accent'],
  Infiniti: ['G37', 'Q50', 'QX60', 'QX80'],
  Jeep: ['Grand Cherokee', 'Wrangler', 'Cherokee', 'Liberty', 'Compass'],
  Kia: ['Optima', 'Sorento', 'Soul', 'Sportage', 'Forte'],
  Lexus: ['RX 350', 'ES 350', 'GX 460', 'IS 250'],
  Mazda: ['Mazda3', 'Mazda6', 'CX-5', 'CX-9'],
  'Mercedes-Benz': ['C-Class', 'E-Class', 'GLE', 'ML350'],
  Nissan: ['Altima', 'Rogue', 'Sentra', 'Maxima', 'Pathfinder', 'Frontier', 'Murano'],
  Subaru: ['Outback', 'Forester', 'Impreza', 'Legacy'],
  Toyota: ['Camry', 'Corolla', 'RAV4', 'Tacoma', 'Tundra', 'Highlander', 'Sienna', 'Prius'],
  Volkswagen: ['Jetta', 'Passat', 'Tiguan', 'Golf'],
  Volvo: ['XC90', 'XC60', 'S60']
};

const USED_CATEGORIES = [
  { id: 'engine', name: 'Engines', icon: 'engine', base: 1450, spread: 2200, warranty: 12 },
  { id: 'transmission', name: 'Transmissions', icon: 'gear', base: 900, spread: 1500, warranty: 12 },
  { id: 'alternator', name: 'Alternators', icon: 'bolt', base: 85, spread: 160, warranty: 6 },
  { id: 'starter', name: 'Starters', icon: 'bolt', base: 70, spread: 140, warranty: 6 },
  { id: 'ac-compressor', name: 'AC Compressors', icon: 'snow', base: 140, spread: 260, warranty: 6 },
  { id: 'radiator', name: 'Radiators', icon: 'grid', base: 90, spread: 180, warranty: 6 },
  { id: 'ecu', name: 'Engine Computers (ECU)', icon: 'chip', base: 120, spread: 300, warranty: 6 },
  { id: 'headlight', name: 'Headlights', icon: 'light', base: 75, spread: 320, warranty: 3 },
  { id: 'tail-light', name: 'Tail Lights', icon: 'light', base: 45, spread: 160, warranty: 3 },
  { id: 'mirror', name: 'Side Mirrors', icon: 'mirror', base: 55, spread: 190, warranty: 3 },
  { id: 'door', name: 'Doors', icon: 'door', base: 180, spread: 360, warranty: 3 },
  { id: 'bumper', name: 'Bumpers', icon: 'car', base: 130, spread: 300, warranty: 3 },
  { id: 'wheel', name: 'Wheels & Rims', icon: 'wheel', base: 85, spread: 240, warranty: 3 },
  { id: 'axle', name: 'Axles & Drive Shafts', icon: 'axle', base: 90, spread: 260, warranty: 6 },
  { id: 'transfer-case', name: 'Transfer Cases', icon: 'gear', base: 350, spread: 700, warranty: 12 },
  { id: 'steering', name: 'Steering Racks & Pumps', icon: 'wheel', base: 110, spread: 280, warranty: 6 }
];

// New aftermarket parts (demo). Brand names are fictional placeholders.
// Each part: [name, base price, price spread, short description]
const NEW_CATEGORIES = [
  { id: 'brakes', name: 'Brakes', icon: 'wheel', warranty: 24, parts: [
    ['Ceramic Brake Pad Set — Front', 32, 45, 'Low-dust ceramic compound with shims and hardware for quiet, smooth stops.'],
    ['Ceramic Brake Pad Set — Rear', 28, 40, 'Low-dust ceramic compound with shims and hardware for quiet, smooth stops.'],
    ['Drilled & Slotted Brake Rotor Pair', 89, 120, 'Coated rotors resist rust and help shed heat during repeated hard braking.'],
    ['Brake Caliper with Bracket', 54, 70, 'Remanufactured to OE specs, pressure-tested, with new seals and boots.']] },
  { id: 'suspension', name: 'Suspension', icon: 'axle', warranty: 24, parts: [
    ['Complete Strut Assembly — Front', 79, 90, 'Pre-assembled with spring and mount for a faster, safer install.'],
    ['Shock Absorber Pair — Rear', 58, 70, 'Twin-tube gas design restores ride comfort and handling.'],
    ['Lower Control Arm with Ball Joint', 44, 60, 'Stamped-steel arm with pre-installed bushings and a greaseable ball joint.'],
    ['Sway Bar Link Kit', 19, 25, 'Heavy-duty links with hardware to cure clunks over bumps.']] },
  { id: 'exhaust', name: 'Exhaust', icon: 'axle', warranty: 12, parts: [
    ['Direct-Fit Catalytic Converter', 189, 260, 'Bolt-on design built to federal emissions standards (not legal in CA/NY).'],
    ['Exhaust Manifold Kit with Gaskets', 95, 130, 'Cast-iron manifold with gaskets and hardware included.'],
    ['Stainless Steel Muffler', 64, 90, 'Corrosion-resistant stainless body with a factory-like sound.']] },
  { id: 'filters', name: 'Filters & Maintenance', icon: 'engine', warranty: 12, parts: [
    ['Engine Air Filter', 12, 14, 'High-capacity pleated media traps dirt while keeping airflow high.'],
    ['Cabin Air Filter with Carbon', 11, 13, 'Activated-carbon layer reduces odors and dust in the cabin.'],
    ['Oil Filter — Synthetic Media', 7, 8, 'Synthetic blend media rated for extended oil-change intervals.'],
    ['Fuel Filter', 15, 20, 'Fine-micron element protects injectors from contaminants.']] },
  { id: 'ignition', name: 'Ignition & Electrical', icon: 'bolt', warranty: 24, parts: [
    ['Iridium Spark Plug Set', 29, 40, 'Long-life iridium tips for a strong, consistent spark.'],
    ['Ignition Coil Pack', 34, 50, 'Tested for output and heat resistance to stop misfires.'],
    ['Battery Cable Kit', 24, 30, 'Pure copper cables with corrosion-resistant terminals.']] },
  { id: 'sensors', name: 'Sensors', icon: 'chip', warranty: 24, parts: [
    ['Oxygen Sensor — Upstream', 36, 50, 'Direct-fit connector with anti-seize pre-applied to the threads.'],
    ['ABS Wheel Speed Sensor', 22, 30, 'Restores ABS and traction control; plug-and-play install.'],
    ['Mass Air Flow Sensor', 68, 90, 'Calibrated for accurate air metering and a smooth idle.']] },
  { id: 'cooling', name: 'Cooling System', icon: 'snow', warranty: 24, parts: [
    ['Water Pump with Gasket', 46, 60, 'Precision-machined impeller and sealed bearing for long service life.'],
    ['Thermostat with Housing', 27, 35, 'Opens at the OE temperature for proper warm-up and fuel economy.'],
    ['Radiator Cooling Fan Assembly', 96, 120, 'Complete fan, motor and shroud — plugs straight into the factory harness.']] }
];
const BRANDS = ['Torqline', 'Brakeon', 'Voltrix', 'CoolFlow', 'Stridex', 'FiltraPro', 'Kestrel Motorworks', 'NovaDrive'];

const CATEGORIES = [...USED_CATEGORIES, ...NEW_CATEGORIES.map(({ parts, ...c }) => c)];

// Small deterministic PRNG (mulberry32)
function rng(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildProducts() {
  const r = rng(20261014);
  const pick = (arr) => arr[Math.floor(r() * arr.length)];
  const makes = Object.keys(VEHICLES);
  const grades = ['A', 'A', 'A', 'B', 'B', 'C'];
  const conditions = { A: 'Excellent — low miles, fully tested', B: 'Good — normal wear, tested', C: 'Fair — cosmetic wear, tested' };
  const engines = ['1.8L I4', '2.0L I4', '2.4L I4', '2.5L I4', '3.0L V6', '3.5L V6', '3.6L V6', '5.0L V8', '5.3L V8', '5.7L V8'];
  const sides = ['Driver (Left)', 'Passenger (Right)'];
  const products = [];
  let n = 1000;

  for (const cat of USED_CATEGORIES) {
    const count = cat.id === 'engine' || cat.id === 'transmission' ? 16 : 10;
    for (let i = 0; i < count; i++) {
      const make = pick(makes);
      const model = pick(VEHICLES[make]);
      const yStart = 2004 + Math.floor(r() * 17);
      const yEnd = Math.min(2025, yStart + 1 + Math.floor(r() * 4));
      const grade = pick(grades);
      const gradeFactor = grade === 'A' ? 1 : grade === 'B' ? 0.82 : 0.66;
      const price = Math.round((cat.base + r() * cat.spread) * gradeFactor) + 0.99;
      const miles = ['engine', 'transmission', 'transfer-case', 'axle'].includes(cat.id)
        ? Math.round((25 + r() * 110) * 1000) : null;
      const spec = {};
      if (['engine', 'transmission', 'ecu'].includes(cat.id)) spec.engine = pick(engines);
      if (cat.id === 'transmission') spec.type = pick(['Automatic', 'Automatic', 'CVT', 'Manual']);
      if (['headlight', 'tail-light', 'mirror', 'door'].includes(cat.id)) spec.side = pick(sides);
      if (cat.id === 'wheel') spec.size = pick(['16"', '17"', '18"', '20"']);
      if (cat.id === 'door') spec.position = pick(['Front', 'Rear']);
      if (cat.id === 'bumper') spec.position = pick(['Front', 'Rear']);
      const id = 'XP' + (n++);
      products.push({
        id,
        sku: `${cat.id.slice(0, 3).toUpperCase()}-${make.slice(0, 2).toUpperCase()}${yStart % 100}-${id.slice(2)}`,
        category: cat.id,
        categoryName: cat.name,
        icon: cat.icon,
        title: `${yStart}-${yEnd} ${make} ${model} ${cat.name.replace(/s$/, '').replace(/ \(ECU\)/, '').replace('Wheels & Rim', 'Wheel').replace('Axles & Drive Shaft', 'Axle').replace('Steering Racks & Pump', 'Steering Rack')}${spec.side ? ' — ' + spec.side : ''}`,
        make, model, yearFrom: yStart, yearTo: yEnd,
        grade, condition: conditions[grade],
        price, listPrice: Math.round(price * (1.35 + r() * 0.4)) + 0.99,
        miles, spec,
        warrantyMonths: cat.warranty,
        stock: Math.floor(r() * 6),
        shipping: price > 400 ? 'Freight — free' : 'Ground — free',
        updatedAt: Date.now()
      });
    }
  }

  // New aftermarket parts: each part type in 4 vehicle fitments
  for (const cat of NEW_CATEGORIES) {
    for (const [name, base, spread, blurb] of cat.parts) {
      for (let i = 0; i < 4; i++) {
        const make = pick(makes);
        const model = pick(VEHICLES[make]);
        const yStart = 2008 + Math.floor(r() * 14);
        const yEnd = Math.min(2025, yStart + 2 + Math.floor(r() * 5));
        const brand = pick(BRANDS);
        const price = Math.round(base + r() * spread) + 0.99;
        const id = 'XP' + (n++);
        products.push({
          id,
          sku: `${brand.slice(0, 2).toUpperCase()}-${cat.id.slice(0, 3).toUpperCase()}${Math.floor(r() * 90000) + 10000}`,
          category: cat.id, categoryName: cat.name, icon: cat.icon, brand,
          title: `${brand} ${name} for ${yStart}-${yEnd} ${make} ${model}`,
          make, model, yearFrom: yStart, yearTo: yEnd,
          grade: null, condition: 'New',
          price, listPrice: r() < 0.55 ? Math.round(price * (1.15 + r() * 0.25)) + 0.99 : null,
          miles: null, spec: {},
          description: `${blurb}\n\nFits ${yStart}-${yEnd} ${make} ${model}. Brand-new part, ships in original packaging. Confirm fitment with your part number or VIN before installing.`,
          warrantyMonths: cat.warranty,
          stock: Math.floor(r() * 25),
          shipping: 'Ground — free',
          updatedAt: Date.now()
        });
      }
    }
  }
  return products;
}

module.exports = { VEHICLES, CATEGORIES, buildProducts };
